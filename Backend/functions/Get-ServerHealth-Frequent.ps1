param (
    [string]$Servers  # Comma-separated string of server names to check frequently
)

# Define ServerHealthChecker class - optimized for frequent checks
class ServerHealthChecker {
    [bool]CheckServerStatus([string]$serverName) {
        try {
            # Use single ping for speed (instead of 2 pings in regular check)
            $pingResult = Test-Connection -ComputerName $serverName -Count 1 -Quiet -ErrorAction Stop
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

# Main script logic for frequent health checks
$healthChecker = [ServerHealthChecker]::new()

# Split the comma-separated string into an array
$ServersArray = $Servers -split ','

# Check server health statuses (optimized for speed)
$healthStatuses = @()
foreach ($server in $ServersArray) {
    $server = $server.Trim()  # Remove any whitespace
    if ($server -ne "") {
        $status = $healthChecker.CheckServerStatus($server)

        # Only check services if server is online (save time on offline servers)
        if ($status) {
            $fileShareStatus = $healthChecker.CheckFileShareService($server)
            $printSpoolerStatus = $healthChecker.CheckPrintSpoolerService($server)
        } else {
            $fileShareStatus = $false
            $printSpoolerStatus = $false
        }

        $healthStatuses += [PSCustomObject]@{
            ServerName = $server
            Status     = if ($status) { "Online" } else { "Offline" }
            FileShareService = if ($fileShareStatus) { "Running" } else { "Not Running" }
            PrintSpoolerService = if ($printSpoolerStatus) { "Running" } else { "Not Running" }
            CheckType = "Frequent"
            CheckTime = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    }
}

# Export the result to JSON
$healthStatuses | ConvertTo-Json -Compress