param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName
)

try {
    # Restart the Print Spooler service on the remote computer using Invoke-Command
    # Suppress warnings and verbose output to ensure clean JSON
    $result = Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        try {
            # Suppress all output except our return value
            Restart-Service -Name "Spooler" -Force -ErrorAction Stop -WarningAction SilentlyContinue | Out-Null
            return @{
                Success = $true
                Message = "Print Spooler service restarted successfully"
            }
        }
        catch {
            return @{
                Success = $false
                Message = $_.Exception.Message
            }
        }
    } -ErrorAction Stop -WarningAction SilentlyContinue

    # Check if the remote operation was successful
    if ($result.Success) {
        # Return success as JSON
        @{
            Success = $true
            Message = "Print Spooler service restarted on $ComputerName successfully"
            ComputerName = $ComputerName
            ServiceName = "Spooler"
            Action = "Restart"
        } | ConvertTo-Json -Compress
    }
    else {
        # Return remote error as JSON
        @{
            Success = $false
            Message = "Error restarting Print Spooler on $ComputerName`: $($result.Message)"
            ComputerName = $ComputerName
            ServiceName = "Spooler"
            Action = "Restart"
        } | ConvertTo-Json -Compress
    }
}
catch {
    # Return error as JSON
    @{
        Success = $false
        Message = "Error restarting Print Spooler on $ComputerName`: $($_.Exception.Message)"
        ComputerName = $ComputerName
        ServiceName = "Spooler"
        Action = "Restart"
    } | ConvertTo-Json -Compress
}