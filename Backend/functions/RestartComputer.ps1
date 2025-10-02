param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName
)

try {
    # Restart the remote computer
    Restart-Computer -ComputerName $ComputerName -Force -ErrorAction Stop

    # Return success as JSON
    @{
        Success = $true
        Message = "Restart command sent to $ComputerName successfully"
        ComputerName = $ComputerName
    } | ConvertTo-Json -Compress
}
catch {
    # Return error as JSON
    @{
        Success = $false
        Message = "Error restarting $ComputerName`: $($_.Exception.Message)"
        ComputerName = $ComputerName
    } | ConvertTo-Json -Compress
}