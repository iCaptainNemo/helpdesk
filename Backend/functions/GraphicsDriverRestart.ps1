param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName
)

try {
    # Invoke-Command runs the script block on the specified remote computer
    $result = Invoke-Command -ComputerName $ComputerName -ErrorAction Stop -ScriptBlock {
        # Find the primary display adapter that is currently running
        $displayAdapter = Get-PnpDevice -Class 'Display' -Status 'OK'

        # If an adapter is found, restart it
        if ($displayAdapter) {
            # Disable and then re-enable the device
            $displayAdapter | Disable-PnpDevice -Confirm:$false
            Start-Sleep -Seconds 1 # Brief pause to ensure the device is fully disabled
            $displayAdapter | Enable-PnpDevice -Confirm:$false

            return @{
                Success = $true
                Message = "Graphics driver restarted successfully for $($displayAdapter.FriendlyName)"
                AdapterName = $displayAdapter.FriendlyName
                ComputerName = $env:COMPUTERNAME
            }
        } else {
            return @{
                Success = $false
                Message = "Could not find an active display adapter"
                ComputerName = $env:COMPUTERNAME
            }
        }
    }

    # Convert result to JSON and output
    $result | ConvertTo-Json -Compress
}
catch {
    # Return error as JSON
    @{
        Success = $false
        Message = "Error: $($_.Exception.Message)"
        ComputerName = $ComputerName
    } | ConvertTo-Json -Compress
}