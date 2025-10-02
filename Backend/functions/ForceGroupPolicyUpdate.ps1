param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName
)

try {
    # Force Group Policy update on the remote computer using Invoke-GPUpdate
    Invoke-GPUpdate -Computer $ComputerName -Force -ErrorAction Stop

    # Return success as JSON
    @{
        Success = $true
        Message = "Group Policy update completed successfully on $ComputerName"
        ComputerName = $ComputerName
    } | ConvertTo-Json -Compress
}
catch {
    # Return error as JSON
    @{
        Success = $false
        Message = "Error updating Group Policy on $ComputerName`: $($_.Exception.Message)"
        ComputerName = $ComputerName
    } | ConvertTo-Json -Compress
}