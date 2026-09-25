param (
    [string]$Servers  # Comma-separated string of server names
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

    [bool]CheckPrintSpoolerService([string]$serverName) {
        try {
            $serviceStatus = Get-Service -ComputerName $serverName -Name "Spooler" -ErrorAction Stop
            return $serviceStatus.Status -eq 'Running'
        } catch {
            return $false
        }
    }
}

# Main script logic
$serverManager = [ServerManager]::new()

# Split the comma-separated string into an array
$ServersArray = $Servers -split ','

# Check server statuses
$serverStatuses = @()
foreach ($server in $ServersArray) {
    $status = $serverManager.CheckServerStatus($server)

    # Only check services if the server answered a ping. Get-Service -ComputerName uses
    # legacy RPC/DCOM, which can take far longer than the ping timeout to fail against an
    # unreachable host — skipping it for offline servers keeps the sequential scan moving
    # instead of stalling on every unreachable machine.
    if ($status) {
        $fileShareStatus = $serverManager.CheckFileShareService($server)
        $printSpoolerStatus = $serverManager.CheckPrintSpoolerService($server)
    } else {
        $fileShareStatus = $false
        $printSpoolerStatus = $false
    }

    $serverStatuses += [PSCustomObject]@{
        ServerName = $server
        Status     = if ($status) { "Online" } else { "Offline" }
        FileShareService = if ($fileShareStatus) { "Running" } else { "Not Running" }
        PrintSpoolerService = if ($printSpoolerStatus) { "Running" } else { "Not Running" }
    }
}

# Export the result to JSON
$serverStatuses | ConvertTo-Json -Compress