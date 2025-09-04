<#
.SYNOPSIS
    Advanced server monitoring and status reporting system
.DESCRIPTION
    Comprehensive server monitoring tool that provides real-time status monitoring,
    uptime tracking, and detailed system reporting for domain servers. Supports
    YAML-based configuration and automated discovery of servers based on naming schemes.
.PARAMETER Debug
    Enable debug mode for verbose output and troubleshooting
.FUNCTIONALITY
    - Server discovery based on configurable naming patterns
    - Real-time connectivity monitoring with status indicators
    - Uptime tracking and performance metrics
    - YAML configuration for domain-specific settings
    - Class-based architecture for extensibility and maintenance
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: PowerShell 5.1+, Network connectivity, YAML module
    Part of: Jarvis Helpdesk Automation System - Standalone Tools
    Usage: .\Get-ServerStatus.ps1 [-Debug]
#>

param (
    [switch]$Debug  # Parameter to enable debug mode
)

# If the Debug switch is provided, set the debug preference to 'Continue'
if ($Debug) {
    $DebugPreference = 'Continue'
}

# Clear the screen (debug-aware)
if (-not $PSBoundParameters['Debug']) { Clear-Host }

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
            $pingResult = Test-Connection -ComputerName $serverName -Count 2 -Quiet -ErrorAction Stop
            return $pingResult
        } catch {
            return $false
        }
    }

    [bool]CheckFileShareService([string]$serverName) {
        Write-Verbose "Checking file share service on server: $serverName."
        try {
            $serviceStatus = Get-Service -ComputerName $serverName -Name "LanmanServer" -ErrorAction Stop
            return $serviceStatus.Status -eq 'Running'
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
# Dictionary to store the offline duration and timestamp for each server
$offlineDurations = @{}
# Dictionary to store the time when servers come back online
$recentlyOnline = @{}

while ($true) {
    Write-Host "Checking server statuses..."
    Write-Debug "Loading servers from configuration."
    $servers = $configManager.LoadServers($serversPath)
    $onlineServers = @()
    $offlineServers = @()
    $recentlyOnlineServers = @()
    $currentTime = Get-Date
    Write-Debug "Current time: $currentTime"

    foreach ($server in $servers) {
        if (-not $DebugPreference -eq 'Continue') { Clear-Host }
        Write-Host "Checking status for server: $server"
        $status = $serverManager.CheckServerStatus($server)
        $statusText = if ($status) { "Online" } else { "Offline" }
        $color = if ($status) { "Green" } else { "Red" }

        if ($status) {
            Write-Host "$server is Online." -ForegroundColor Green
            $onlineServers += $server
            # Check if the server was recently offline
            if ($offlineDurations.ContainsKey($server)) {
                Write-Debug "$server was recently offline. Updating recently online list."
                $recentlyOnline[$server] = @{
                    TimeOnline = $currentTime
                    OfflineTimestamp = $offlineDurations[$server].Timestamp
                }
                $offlineDurations.Remove($server)
            }
            # Check file share service status
            Write-Debug "Checking file share service status for $server."
            $fileShareStatus = $serverManager.CheckFileShareService($server)
            if ($fileShareStatus) {
                Write-Host "$server : File share service is running" -ForegroundColor Green
            } else {
                Write-Host "$server : File share service is not running" -ForegroundColor Yellow
            }
            if ($debug) {
                Start-Sleep -Seconds 1
            }
        } else {
            Write-Debug "$server is Offline."
            $offlineServers += $server
            if (-not $offlineDurations.ContainsKey($server)) {
                Write-Debug "Recording offline timestamp for $server."
                $offlineDurations[$server] = @{
                    Timestamp = $currentTime
                }
            }
            $offlineDuration = ($currentTime - $offlineDurations[$server].Timestamp).TotalMinutes
            Write-Debug "$server has been offline for $offlineDuration minutes."
        }
    }

    # Calculate offline time in minutes and hours
    Write-Debug "Calculating offline durations."
    $offlineTable = @()
    foreach ($server in $offlineServers) {
        $offlineTime = ""
        $offlineTimestamp = ""
        if ($offlineDurations.ContainsKey($server)) {
            $minutes = [math]::Floor(($currentTime - $offlineDurations[$server].Timestamp).TotalMinutes)
            $hours = [math]::Floor($minutes / 60)
            $remainingMinutes = $minutes % 60
            if ($hours -gt 0) {
                $offlineTime = "$hours hours, $remainingMinutes minutes"
            } else {
                $offlineTime = "$minutes minutes"
            }
            $offlineTimestamp = $offlineDurations[$server].Timestamp
        }

        $offlineTable += [PSCustomObject]@{
            ServerName      = $server
            OfflineTime     = $offlineTime
            OfflineTimestamp = $offlineTimestamp
        }
    }

    # Find recently online servers within the last hour
    Write-Debug "Finding recently online servers within the last hour."
    $recentlyOnlineTable = @()
    $recentlyOnlineKeys = @($recentlyOnline.Keys) # Create a copy of the keys
    foreach ($server in $recentlyOnlineKeys) {
        $timeOnline = $recentlyOnline[$server].TimeOnline
        $offlineTimestamp = $recentlyOnline[$server].OfflineTimestamp
        if (($currentTime - $timeOnline).TotalMinutes -le 60) {
            $recentlyOnlineTable += [PSCustomObject]@{
                ServerName       = $server
                TimeOnline       = $timeOnline
                OfflineTimestamp = $offlineTimestamp
            }
        } else {
            Write-Debug "Removing $server from recently online list as it has been online for more than an hour."
            $recentlyOnline.Remove($server)
        }
    }
    if (-not $DebugPreference -eq 'Continue') { Clear-Host }
    # Display the last time the script was run
    Write-Host "Last run: $(Get-Date)"

    # Conditional output based on server statuses
    if ($offlineServers.Count -eq 0 -and $recentlyOnlineTable.Count -eq 0) {
        Write-Host "All servers online" -ForegroundColor Green
    } else {
        # Display the count of online servers
        Write-Host "Online Servers: $($onlineServers.Count)" -ForegroundColor Green
        Write-Host "" # Add space

        # Display the list of offline servers with their offline duration and timestamp
        Write-Host "Offline Servers:" -ForegroundColor Red
        foreach ($row in $offlineTable) {
            Write-Host "$($row.ServerName): Offline for $($row.OfflineTime) since $($row.OfflineTimestamp)" -ForegroundColor Red
        }
        Write-Host "" # Add space

        # Display the list of recently online servers within the last hour with their offline timestamp
        Write-Host "Recently Online Servers (within the last hour):" -ForegroundColor Yellow
        foreach ($row in $recentlyOnlineTable) {
            $offlineDuration = [math]::Floor(($row.TimeOnline - $row.OfflineTimestamp).TotalMinutes)
            $hours = [math]::Floor($offlineDuration / 60)
            $remainingMinutes = $offlineDuration % 60
            $offlineDurationText = if ($hours -gt 0) { "$hours hours, $remainingMinutes minutes" } else { "$offlineDuration minutes" }

            Write-Host "$($row.ServerName) Offline since: $($row.OfflineTimestamp), back online: $($row.TimeOnline), was offline for $offlineDurationText" -ForegroundColor Yellow
        }
    }
        
    Write-Host "" # Add space
    Write-Host "Next check in 10 minutes."
    $startTime = Get-Date
    $timeout = 600
    Write-Debug "Start time: $startTime"
    Write-Debug "Timeout: $timeout seconds"
    
    while ((Get-Date) -lt $startTime.AddSeconds($timeout)) {
        $currentTime = Get-Date
        Write-Debug "Current time: $currentTime"
        Write-Debug "Time remaining: $([math]::Round(($startTime.AddSeconds($timeout) - $currentTime).TotalSeconds)) seconds"
        Start-Sleep -Seconds 1
    }
    if (-not $DebugPreference -eq 'Continue') { Clear-Host }
}