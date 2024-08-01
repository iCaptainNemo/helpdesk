param (
    [switch]$Debug  # Parameter to enable debug mode
)

# If the Debug switch is provided, set the debug preference to 'Continue'
if ($Debug) {
    $DebugPreference = 'Continue'
}

# Clear the screen
cls

# Write a debug message if debug mode is enabled
Write-Debug "Debug mode is enabled."

# Set the window title to the name of the script file
$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf

# Set the execution policy to Undefined for the current user scope
try {
    Write-Debug "Setting execution policy to Undefined for the current user scope."
    Set-ExecutionPolicy -ExecutionPolicy Undefined -Scope CurrentUser -ErrorAction Stop
    Write-Verbose "Execution policy set to Undefined for the current user scope."
} catch {
    Write-Error "Failed to set execution policy: $_"
    exit 1
}

# Import ActiveDirectory module
try {
    Write-Debug "Importing ActiveDirectory module."
    Import-Module ActiveDirectory -ErrorAction Stop
    Write-Verbose "ActiveDirectory module imported successfully."
} catch {
    Write-Error "Failed to import ActiveDirectory module: $_"
    exit 1
}

# Install the powershell-yaml module if it is not already installed
if (-not (Get-Module -ListAvailable -Name powershell-yaml)) {
    try {
        Write-Debug "Installing powershell-yaml module."
        Install-Module -Name powershell-yaml -Force -Scope CurrentUser -ErrorAction Stop
        Write-Verbose "powershell-yaml module installed successfully."
    } catch {
        Write-Error "Failed to install powershell-yaml module: $_"
        exit 1
    }
}

# Import the powershell-yaml module
try {
    Write-Debug "Importing powershell-yaml module."
    Import-Module -Name powershell-yaml -ErrorAction Stop
    Write-Verbose "powershell-yaml module imported successfully."
} catch {
    Write-Error "Failed to import powershell-yaml module: $_"
    exit 1
}

# Define ConfigurationManager class
class ConfigurationManager {
    [string]$ConfigPath

    ConfigurationManager([string]$configPath) {
        $this.ConfigPath = $configPath
    }

    [void]LoadConfig([ref]$namingScheme) {
        Write-Verbose "Loading configuration from $($this.ConfigPath)"
        if (-not (Test-Path $this.ConfigPath)) {
            Write-Verbose "Configuration file not found. Prompting user for naming scheme."
            $namingScheme.Value = Read-Host "Enter the server naming scheme (e.g., 'Server-*')"
            $this.SaveConfig($namingScheme.Value)
        } else {
            Write-Verbose "Configuration file found. Loading naming scheme."
            try {
                $yamlContent = Get-Content -Path $this.ConfigPath | ConvertFrom-Yaml -ErrorAction Stop
                $namingScheme.Value = $yamlContent.NamingScheme
                Write-Verbose "Naming scheme loaded: $($namingScheme.Value)."
            } catch {
                Write-Error "Failed to load naming scheme from configuration file: $_"
                exit 1
            }
        }
    }

    [void]SaveConfig([string]$namingScheme) {
        Write-Verbose "Saving configuration to $($this.ConfigPath)"
        try {
            $yamlContent = @{ NamingScheme = $namingScheme }
            $directory = Split-Path -Path $this.ConfigPath -Parent
            if (-not (Test-Path $directory)) {
                Write-Verbose "Creating directory $directory"
                New-Item -ItemType Directory -Path $directory -Force
            }
            $yamlContent | ConvertTo-Yaml | Out-File -FilePath $this.ConfigPath -ErrorAction Stop
            Write-Verbose "Naming scheme saved to configuration file."
        } catch {
            Write-Error "Failed to save naming scheme to configuration file: $_"
            exit 1
        }
    }

    [void]SaveServers([array]$servers, [string]$serversPath) {
        Write-Verbose "Saving servers to $serversPath"
        try {
            $yamlContent = @{ Servers = $servers }
            $directory = Split-Path -Path $serversPath -Parent
            if (-not (Test-Path $directory)) {
                Write-Verbose "Creating directory $directory"
                New-Item -ItemType Directory -Path $directory -Force
            }
            $yamlContent | ConvertTo-Yaml | Out-File -FilePath $serversPath -ErrorAction Stop
            Write-Verbose "Servers saved to configuration file."
        } catch {
            Write-Error "Failed to save servers to configuration file: $_"
            exit 1
        }
    }

    [array]LoadServers([string]$serversPath) {
        Write-Verbose "Loading servers from $serversPath"
        try {
            $yamlContent = Get-Content -Path $serversPath | ConvertFrom-Yaml -ErrorAction Stop
            return $yamlContent.Servers
        } catch {
            Write-Error "Failed to load servers from configuration file: $_"
            exit 1
        }
    }
}

# Define ServerManager class
class ServerManager {
    [bool]CheckServerStatus([string]$serverName) {
        Write-Verbose "Checking status of server: $serverName."
        try {
            $pingResult = Test-Connection -ComputerName $serverName -Count 1 -Quiet -ErrorAction Stop
            return $pingResult
        } catch {
            return $false
        }
    }

    [array]RetrieveServers([string]$namingScheme) {
        Write-Verbose "Retrieving servers from Active Directory based on the naming scheme: $namingScheme."
        try {
            $servers = Get-ADComputer -Filter "Name -like '$namingScheme'" | Select-Object -ExpandProperty Name -ErrorAction Stop
            Write-Verbose "Retrieved servers: $($servers -join ', ')."
            return $servers
        } catch {
            Write-Error "Failed to retrieve servers from Active Directory: $_"
            exit 1
        }
    }
}

# Main script logic
$configPath = "./Config/serverscheme.yaml"
$serversPath = "./Config/servers.yaml"
Write-Debug "Configuration file path: $configPath"
$configManager = [ConfigurationManager]::new($configPath)
$serverManager = [ServerManager]::new()

$namingScheme = ""
Write-Debug "Loading configuration."
$configManager.LoadConfig([ref]$namingScheme)
Write-Debug "Configuration loaded. Naming scheme: $namingScheme"

# Check if servers.yaml exists
if (-not (Test-Path $serversPath)) {
    Write-Debug "servers.yaml not found. Retrieving servers from AD."
    $servers = $serverManager.RetrieveServers($namingScheme)
    Write-Debug "Servers retrieved: $($servers -join ', ')"
    $configManager.SaveServers($servers, $serversPath)
} else {
    Write-Debug "servers.yaml found. Loading servers from file."
    $servers = $configManager.LoadServers($serversPath)
    Write-Debug "Servers loaded: $($servers -join ', ')"
}

# Dictionary to store the offline duration for each server
$offlineDurations = @{}

while ($true) {
    Write-Host "Checking server statuses..."
    $servers = $configManager.LoadServers($serversPath)
    $table = @()
    foreach ($server in $servers) {
        $status = $serverManager.CheckServerStatus($server)
        $statusText = if ($status) { "Online" } else { "Offline" }
        $color = if ($status) { "Green" } else { "Red" }

        # Update offline duration
        if (-not $status) {
            if (-not $offlineDurations.ContainsKey($server)) {
                $offlineDurations[$server] = -10 # Initialize to -10 so the first increment makes it 0
            }
            $offlineDurations[$server] += 10 # Increment by 10 minutes
        } else {
            $offlineDurations.Remove($server)
        }

        # Calculate offline time in minutes and hours
        $offlineTime = ""
        if ($offlineDurations.ContainsKey($server)) {
            $minutes = $offlineDurations[$server]
            $hours = [math]::Floor($minutes / 60)
            $remainingMinutes = $minutes % 60
            if ($hours -gt 0) {
                $offlineTime = "$hours hours, $remainingMinutes minutes"
            } else {
                $offlineTime = "$minutes minutes"
            }
        }

        $table += [PSCustomObject]@{
            ServerName  = $server
            Status      = $statusText
            OfflineTime = $offlineTime
        }
    }

    # Display the table with color formatting
    foreach ($row in $table) {
        $color = if ($row.Status -eq "Online") { "Green" } else { "Red" }
        Write-Host "$($row.ServerName):" -NoNewline
        Write-Host " $($row.Status)" -ForegroundColor $color -NoNewline
        if ($row.OfflineTime) {
            Write-Host " ($($row.OfflineTime))"
        } else {
            Write-Host ""
        }
    }

    Write-Host "Waiting for 10 minutes before the next check."
    Start-Sleep -Seconds 600
    cls
}