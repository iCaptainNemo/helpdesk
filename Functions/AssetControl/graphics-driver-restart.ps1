<#
.SYNOPSIS
    Graphics driver restart function for Asset Control
.DESCRIPTION
    Restarts the graphics driver on a remote computer by disabling and re-enabling the display adapter
.NOTES
    Author: Helpdesk Team
    Version: 1.0
    Requires: Administrative privileges on target systems
#>

<#
.SYNOPSIS
    Restart graphics driver on target computer
.DESCRIPTION
    Finds the primary display adapter and restarts it by disabling and re-enabling the device
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to restart graphics driver on
.EXAMPLE
    Restart-GraphicsDriver -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Uses PnP device management to restart display adapters
#>
function Restart-GraphicsDriver {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Restarting graphics driver on computer: $computerName (requested by: $userId)"
    Write-Host "Restarting graphics driver on '$computerName'..." -ForegroundColor Cyan

    try {
        Write-Host "Attempting to connect to '$computerName'..." -ForegroundColor Cyan

        # Execute the graphics driver restart on the remote computer
        Invoke-Command -ComputerName $computerName -ErrorAction Stop -ScriptBlock {
            # This code runs on the remote machine
            Write-Host "Searching for display adapter on $env:COMPUTERNAME..."

            # Find the primary display adapter that is currently running
            $displayAdapter = Get-PnpDevice -Class 'Display' -Status 'OK'

            # If an adapter is found, restart it
            if ($displayAdapter) {
                Write-Host "Found: $($displayAdapter.FriendlyName). Restarting driver..." -ForegroundColor Yellow
                
                # Disable and then re-enable the device
                # The -Confirm:$false switch prevents PowerShell from asking for confirmation
                $displayAdapter | Disable-PnpDevice -Confirm:$false
                Start-Sleep -Seconds 1 # Brief pause to ensure device is fully disabled
                $displayAdapter | Enable-PnpDevice -Confirm:$false
                
                Write-Host "Graphics driver on $env:COMPUTERNAME has been successfully restarted!" -ForegroundColor Green
            } else {
                Write-Host "Could not find an active display adapter on $env:COMPUTERNAME." -ForegroundColor Red
            }
        }
    }
    catch {
        # Handle any errors that occurred during the remote operation
        Write-Host "An error occurred while restarting graphics driver on '$computerName'." -ForegroundColor Red
        Write-Host "Please check the computer name and ensure PowerShell Remoting is enabled on the remote machine." -ForegroundColor Red
        Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    }

    Read-Host "Press Enter to continue"
}