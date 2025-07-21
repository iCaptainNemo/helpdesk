#requires -version 5.1

<#
.SYNOPSIS
    Helpdesk GUI - WPF Edition
.DESCRIPTION
    A native Windows desktop application for IT helpdesk operations.
    Provides tools for Active Directory management, server monitoring, and system administration.
    
    IMPORTANT: SQLite library (System.Data.SQLite.dll) is optional but recommended.
    - With SQLite: Full database features (logging, server status persistence)
    - Without SQLite: Core AD functions work, database features disabled
    
    Run .\setup-sqlite.cmd for SQLite setup instructions.
.NOTES
    Author: Helpdesk Team
    Version: 1.0
    Date: 2025-01-21
    PowerShell: Compatible with Windows PowerShell 5.1 and PowerShell 7.x
#>

param(
    [switch]$Debug = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Get script directory
$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDirectory

# Import required modules
if (-not (Get-Module -ListAvailable -Name "ActiveDirectory")) {
    Write-Error "Active Directory PowerShell module is required. Please install RSAT-AD-PowerShell feature."
    exit 1
}

Import-Module ActiveDirectory -Force

# Load SQLite assembly (you need to download System.Data.SQLite.dll to lib folder)
$SQLitePath = Join-Path $ScriptDirectory "lib\System.Data.SQLite.dll"
$Global:SQLiteAvailable = $false

if (Test-Path $SQLitePath) {
    try {
        Add-Type -LiteralPath $SQLitePath
        
        # Test if SQLite actually works by attempting a simple connection
        $testPath = Join-Path $ScriptDirectory "database\test.db"
        $testDir = Split-Path $testPath -Parent
        if (-not (Test-Path $testDir)) {
            New-Item -Path $testDir -ItemType Directory -Force | Out-Null
        }
        
        $testConnection = New-Object System.Data.SQLite.SQLiteConnection("Data Source=$testPath;Version=3;")
        $testConnection.Open()
        $testConnection.Close()
        
        # Clean up test database
        if (Test-Path $testPath) {
            Remove-Item $testPath -Force -ErrorAction SilentlyContinue
        }
        
        $Global:SQLiteAvailable = $true
        Write-Host "SQLite assembly loaded and tested successfully" -ForegroundColor Green
    }
    catch {
        Write-Warning "Failed to load or test SQLite assembly: $_"
        Write-Warning "Database features will be disabled."
        $Global:SQLiteAvailable = $false
    }
}
else {
    Write-Warning "SQLite assembly not found at: $SQLitePath"
    Write-Warning "Please download System.Data.SQLite.dll and place it in the lib folder."
    Write-Warning "Database features will be disabled."
}

# Load required .NET assemblies for WPF
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

# Initialize database
function Initialize-Database {
    $DatabasePath = Join-Path $ScriptDirectory "database\database.db"
    $DatabaseDir = Split-Path $DatabasePath -Parent
    
    # Ensure database directory exists
    if (-not (Test-Path $DatabaseDir)) {
        New-Item -Path $DatabaseDir -ItemType Directory -Force | Out-Null
    }
    
    # If SQLite is not available, just return the path for file-based logging
    if (-not $Global:SQLiteAvailable) {
        Write-Host "SQLite not available - using file-based logging in database directory" -ForegroundColor Yellow
        return $DatabasePath
    }
    
    # Check if database already exists
    if (Test-Path $DatabasePath) {
        Write-Host "Using existing database at: $DatabasePath" -ForegroundColor Green
        return $DatabasePath
    }
    
    # Create new database if it doesn't exist
    Write-Host "Creating new database at: $DatabasePath" -ForegroundColor Yellow
    
    try {
        $connectionString = "Data Source=$DatabasePath;Version=3;"
        $connection = New-Object System.Data.SQLite.SQLiteConnection($connectionString)
        $connection.Open()
        
        # Create tables
        $createTablesSQL = @"
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    user TEXT
);

CREATE TABLE IF NOT EXISTS server_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT NOT NULL,
    status TEXT NOT NULL,
    last_checked TEXT NOT NULL,
    response_time INTEGER
);

CREATE TABLE IF NOT EXISTS user_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    target_object TEXT,
    user TEXT NOT NULL,
    result TEXT
);
"@
        
        $command = New-Object System.Data.SQLite.SQLiteCommand($createTablesSQL, $connection)
        $command.ExecuteNonQuery() | Out-Null
        $connection.Close()
        
        Write-Host "Database initialized successfully" -ForegroundColor Green
        return $DatabasePath
    }
    catch {
        Write-Warning "Failed to initialize database: $_"
        Write-Warning "Database features will be disabled. Using file-based logging instead."
        return $null
    }
}

# Logging function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $user = $env:USERNAME
    $logMessage = "[$timestamp] [$Level] [$user] $Message"
    
    # Write to console
    switch ($Level) {
        "ERROR" { Write-Host $logMessage -ForegroundColor Red }
        "WARNING" { Write-Host $logMessage -ForegroundColor Yellow }
        "INFO" { Write-Host $logMessage -ForegroundColor Cyan }
        default { Write-Host $logMessage }
    }
    
    # Write to log file
    try {
        $logFile = Join-Path $ScriptDirectory "database\application.log"
        $logDir = Split-Path $logFile -Parent
        if (-not (Test-Path $logDir)) {
            New-Item -Path $logDir -ItemType Directory -Force | Out-Null
        }
        Add-Content -Path $logFile -Value $logMessage -ErrorAction SilentlyContinue
    }
    catch {
        # If file logging also fails, just continue
    }
}

# Initialize the application
Write-Host "Starting Helpdesk GUI - WPF Edition..." -ForegroundColor Green
Write-Log "Application starting"

# Initialize database
$Global:DatabasePath = Initialize-Database

# Load XAML
$XAMLPath = Join-Path $ScriptDirectory "HelpdeskGUI.xaml"
if (-not (Test-Path $XAMLPath)) {
    Write-Error "XAML file not found: $XAMLPath"
    exit 1
}

[xml]$XAML = Get-Content $XAMLPath

# Remove x:Class attribute for PowerShell compatibility
$XAML.Window.RemoveAttribute("Class")

# Create WPF window
try {
    $Reader = New-Object System.Xml.XmlNodeReader $XAML
    $Window = [Windows.Markup.XamlReader]::Load($Reader)
}
catch {
    Write-Error "Failed to load XAML: $_"
    exit 1
}

# Get references to UI controls
$SearchTextBox = $Window.FindName("SearchTextBox")
$UnlockButton = $Window.FindName("UnlockButton")
$ADObjectDataGrid = $Window.FindName("ADObjectDataGrid")
$ServerStatusDataGrid = $Window.FindName("ServerStatusDataGrid")
$DomainControllersDataGrid = $Window.FindName("DomainControllersDataGrid")
$LogsTextBox = $Window.FindName("LogsTextBox")
$ServerStatusLastUpdated = $Window.FindName("ServerStatusLastUpdated")
$DomainControllersLastUpdated = $Window.FindName("DomainControllersLastUpdated")

# Global variables
$Global:CurrentADObject = $null
$Global:LogBuffer = @()

# Event handlers
$Window.Add_Loaded({
    Write-Log "Application loaded successfully"
    $LogsTextBox.Text = "Application started at $(Get-Date)`n"
    
    # Start background tasks
    Start-BackgroundTasks
})

$Window.Add_Closing({
    Write-Log "Application closing"
})

# Title bar event handlers (for custom window chrome)
$TitleBar = $Window.FindName("TitleBar")
if ($TitleBar) {
    $TitleBar.Add_MouseLeftButtonDown({ $Window.DragMove() })
}

# Window control buttons
$CloseButton = $Window.FindName("CloseButton")
if ($CloseButton) {
    $CloseButton.Add_Click({ $Window.Close() })
}

$MinimizeButton = $Window.FindName("MinimizeButton")
if ($MinimizeButton) {
    $MinimizeButton.Add_Click({ $Window.WindowState = "Minimized" })
}

$MaximizeButton = $Window.FindName("MaximizeButton")
if ($MaximizeButton) {
    $MaximizeButton.Add_Click({ 
        if ($Window.WindowState -eq "Maximized") {
            $Window.WindowState = "Normal"
        } else {
            $Window.WindowState = "Maximized"
        }
    })
}

# Search functionality
function Search-ADObject {
    param([string]$SearchTerm)
    
    if ([string]::IsNullOrWhiteSpace($SearchTerm)) {
        [System.Windows.MessageBox]::Show("Please enter a search term", "Search Error", "OK", "Warning")
        return
    }
    
    Write-Log "Searching for AD object: $SearchTerm"
    
    try {
        # Execute the PowerShell script
        $FunctionPath = Join-Path $ScriptDirectory "functions\Get-ADObject.ps1"
        $result = & $FunctionPath $SearchTerm
        
        if ($result) {
            $adObjectData = $result | ConvertFrom-Json
            $Global:CurrentADObject = $adObjectData
            
            # Convert to array of key-value pairs for DataGrid
            $displayData = @()
            $adObjectData.PSObject.Properties | ForEach-Object {
                $value = $_.Value
                if ($value -is [array] -and $value.Count -gt 0) {
                    $value = $value -join "; "
                }
                $displayData += [PSCustomObject]@{
                    Property = $_.Name
                    Value = $value
                }
            }
            
            $ADObjectDataGrid.ItemsSource = $displayData
            
            # Enable unlock button if user is locked out
            if ($adObjectData.LockedOut -eq $true) {
                $UnlockButton.IsEnabled = $true
                Write-Log "User $SearchTerm is locked out - unlock button enabled"
            } else {
                $UnlockButton.IsEnabled = $false
            }
            
            Write-Log "Successfully retrieved AD object: $SearchTerm"
        } else {
            [System.Windows.MessageBox]::Show("No object found matching: $SearchTerm", "Search Result", "OK", "Information")
            $ADObjectDataGrid.ItemsSource = $null
            $UnlockButton.IsEnabled = $false
        }
    }
    catch {
        $errorMessage = "Error searching for AD object: $_"
        Write-Log $errorMessage "ERROR"
        [System.Windows.MessageBox]::Show($errorMessage, "Search Error", "OK", "Error")
        $ADObjectDataGrid.ItemsSource = $null
        $UnlockButton.IsEnabled = $false
    }
}

# Search button click
$SearchButton = $Window.FindName("SearchButton")
if ($SearchButton) {
    $SearchButton.Add_Click({
        Search-ADObject -SearchTerm $SearchTextBox.Text
    })
}

# Search on Enter key
$SearchTextBox.Add_KeyDown({
    if ($_.Key -eq "Return") {
        Search-ADObject -SearchTerm $SearchTextBox.Text
    }
})

# Unlock user functionality
$UnlockButton.Add_Click({
    if ($Global:CurrentADObject -and $Global:CurrentADObject.SamAccountName) {
        $username = $Global:CurrentADObject.SamAccountName
        Write-Log "Attempting to unlock user: $username"
        
        try {
            $FunctionPath = Join-Path $ScriptDirectory "functions\Unlocker.ps1"
            & $FunctionPath -UserID $username
            
            Write-Log "Successfully unlocked user: $username"
            [System.Windows.MessageBox]::Show("User $username has been unlocked", "Unlock Successful", "OK", "Information")
            
            # Refresh the AD object to show updated status
            Search-ADObject -SearchTerm $username
        }
        catch {
            $errorMessage = "Error unlocking user: $_"
            Write-Log $errorMessage "ERROR"
            [System.Windows.MessageBox]::Show($errorMessage, "Unlock Error", "OK", "Error")
        }
    }
})

# Background tasks
function Start-BackgroundTasks {
    # Refresh server status every 5 minutes
    $timer = New-Object System.Windows.Threading.DispatcherTimer
    $timer.Interval = [TimeSpan]::FromMinutes(5)
    $timer.Add_Tick({
        Update-ServerStatus
        Update-DomainControllers
    })
    $timer.Start()
    
    # Initial load
    Update-ServerStatus
    Update-DomainControllers
}

function Update-ServerStatus {
    try {
        Write-Log "Updating server status from database"
        
        if ($Global:SQLiteAvailable -and $Global:DatabasePath) {
            # Import database utilities
            . (Join-Path $ScriptDirectory "functions\DatabaseUtils.ps1")
            
            # Get servers from database
            $servers = Get-Servers -DatabasePath $Global:DatabasePath
            
            if ($servers) {
                # Test each server and update status
                foreach ($server in $servers) {
                    $serverName = $server.ServerName
                    try {
                        $ping = Test-Connection -ComputerName $serverName -Count 1 -Quiet -ErrorAction Stop
                        $newStatus = if ($ping) { "Online" } else { "Offline" }
                        
                        # Update database if status changed
                        if ($server.Status -ne $newStatus) {
                            Update-ServerStatus -DatabasePath $Global:DatabasePath -ServerName $serverName -Status $newStatus
                        }
                    }
                    catch {
                        # Update to offline if ping fails
                        if ($server.Status -ne "Offline") {
                            Update-ServerStatus -DatabasePath $Global:DatabasePath -ServerName $serverName -Status "Offline"
                        }
                    }
                }
                
                # Refresh data for display
                $serverData = Get-Servers -DatabasePath $Global:DatabasePath
                $ServerStatusDataGrid.ItemsSource = $serverData
                $ServerStatusLastUpdated.Content = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                
                Write-Log "Server status updated successfully - $($serverData.Count) servers monitored"
            } else {
                Write-Log "No servers found in database" "WARNING"
            }
        } else {
            # Fallback for when database is not available
            $FunctionPath = Join-Path $ScriptDirectory "functions\Get-ServerStatus.ps1"
            
            if (Test-Path $FunctionPath) {
                $result = & $FunctionPath
                if ($result) {
                    $ServerStatusDataGrid.ItemsSource = $result
                    $ServerStatusLastUpdated.Content = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                    Write-Log "Server status updated from PowerShell script"
                }
            } else {
                Write-Log "No server monitoring available - missing database and PowerShell script" "WARNING"
            }
        }
    }
    catch {
        Write-Log "Error updating server status: $_" "ERROR"
    }
}

function Update-DomainControllers {
    try {
        Write-Log "Updating domain controllers from database"
        
        if ($Global:SQLiteAvailable -and $Global:DatabasePath) {
            # Import database utilities
            . (Join-Path $ScriptDirectory "functions\DatabaseUtils.ps1")
            
            # Get domain controllers from database
            $domainControllers = Get-DomainControllers -DatabasePath $Global:DatabasePath
            
            if ($domainControllers) {
                # Test each DC and update status
                foreach ($dc in $domainControllers) {
                    $dcName = $dc.ControllerName
                    try {
                        $ping = Test-Connection -ComputerName $dcName -Count 1 -Quiet -ErrorAction Stop
                        $newStatus = if ($ping) { "Online" } else { "Offline" }
                        
                        # Update database if status changed
                        if ($dc.Status -ne $newStatus) {
                            Update-DomainControllerStatus -DatabasePath $Global:DatabasePath -ControllerName $dcName -Status $newStatus
                        }
                    }
                    catch {
                        # Update to offline if ping fails
                        if ($dc.Status -ne "Offline") {
                            Update-DomainControllerStatus -DatabasePath $Global:DatabasePath -ControllerName $dcName -Status "Offline"
                        }
                    }
                }
                
                # Refresh data for display
                $dcData = Get-DomainControllers -DatabasePath $Global:DatabasePath
                $DomainControllersDataGrid.ItemsSource = $dcData
                $DomainControllersLastUpdated.Content = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                
                Write-Log "Domain controllers updated successfully - $($dcData.Count) DCs monitored"
            } else {
                Write-Log "No domain controllers found in database" "WARNING"
            }
        } else {
            # Fallback for when database is not available
            $FunctionPath = Join-Path $ScriptDirectory "functions\Get-DomainControllers.ps1"
            
            if (Test-Path $FunctionPath) {
                $result = & $FunctionPath
                if ($result) {
                    $DomainControllersDataGrid.ItemsSource = $result
                    $DomainControllersLastUpdated.Content = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                    Write-Log "Domain controllers updated from PowerShell script"
                }
            } else {
                Write-Log "No DC monitoring available - missing database and PowerShell script" "WARNING"
            }
        }
    }
    catch {
        Write-Log "Error updating domain controllers: $_" "ERROR"
    }
}

# Refresh buttons
$RefreshServersButton = $Window.FindName("RefreshServersButton")
if ($RefreshServersButton) {
    $RefreshServersButton.Add_Click({ Update-ServerStatus })
}

$RefreshDomainControllersButton = $Window.FindName("RefreshDomainControllersButton")
if ($RefreshDomainControllersButton) {
    $RefreshDomainControllersButton.Add_Click({ Update-DomainControllers })
}

# Log management
function Add-LogToDisplay {
    param([string]$Message)
    
    $Global:LogBuffer += "$(Get-Date -Format 'HH:mm:ss'): $Message"
    if ($Global:LogBuffer.Count -gt 1000) {
        $Global:LogBuffer = $Global:LogBuffer[-500..-1]
    }
    
    $LogsTextBox.Text = ($Global:LogBuffer -join "`n")
    $LogsTextBox.ScrollToEnd()
}

$ClearLogsButton = $Window.FindName("ClearLogsButton")
if ($ClearLogsButton) {
    $ClearLogsButton.Add_Click({
        $Global:LogBuffer = @()
        $LogsTextBox.Text = ""
        Write-Log "Logs cleared"
    })
}

$ExportLogsButton = $Window.FindName("ExportLogsButton")
if ($ExportLogsButton) {
    $ExportLogsButton.Add_Click({
        $SaveFileDialog = New-Object Microsoft.Win32.SaveFileDialog
        $SaveFileDialog.Filter = "Text files (*.txt)|*.txt|All files (*.*)|*.*"
        $SaveFileDialog.DefaultExt = "txt"
        $SaveFileDialog.FileName = "helpdesk_logs_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
        
        if ($SaveFileDialog.ShowDialog() -eq $true) {
            $Global:LogBuffer | Out-File -FilePath $SaveFileDialog.FileName -Encoding UTF8
            Write-Log "Logs exported to: $($SaveFileDialog.FileName)"
            [System.Windows.MessageBox]::Show("Logs exported successfully", "Export Complete", "OK", "Information")
        }
    })
}

# Show the window
Write-Log "Displaying main window"
$Window.ShowDialog() | Out-Null

Write-Log "Application terminated"
