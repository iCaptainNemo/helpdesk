param (
    [string[]]$Servers  # Array of server names
)

# Import ActiveDirectory module
Import-Module ActiveDirectory -ErrorAction Stop

# Define ServerManager class
class ServerManager {
    [bool]CheckServerStatus([string]$serverName) {
        try {
            $pingResult = Test-Connection -ComputerName $serverName -Count 2 -Quiet -ErrorAction Stop
            return $pingResult
        } catch {
            return $false
        }
    }

    [bool]CheckFileShareService([string]$serverName) {
        try {
            $serviceStatus = Get-Service -ComputerName $serverName -Name "LanmanServer" -ErrorAction Stop
            return $serviceStatus.Status -eq 'Running'
        } catch {
            return $false
        }
    }
}

# Main script logic
$serverManager = [ServerManager]::new()

# Ensure $Servers is an array
if (-not ($Servers -is [array])) {
    $Servers = @($Servers)
}

# Check server statuses
$serverStatuses = @()
foreach ($server in $Servers) {
    $status = $serverManager.CheckServerStatus($server)
    $fileShareStatus = $serverManager.CheckFileShareService($server)
    $serverStatuses += [PSCustomObject]@{
        ServerName = $server
        Status     = if ($status) { "Online" } else { "Offline" }
        FileShareService = if ($fileShareStatus) { "Running" } else { "Not Running" }
    }
}

# Export the result to JSON
$serverStatuses | ConvertTo-Json -Compress