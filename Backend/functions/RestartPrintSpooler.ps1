param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName
)

try {
    # Restart the Print Spooler service on the remote computer
    Restart-Service -Name "Spooler" -ComputerName $ComputerName -Force -ErrorAction Stop

    # Return success as JSON
    @{
        Success = $true
        Message = "Print Spooler service restarted on $ComputerName successfully"
        ComputerName = $ComputerName
        ServiceName = "Spooler"
        Action = "Restart"
    } | ConvertTo-Json -Compress
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