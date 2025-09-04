# This script will continuously prompt for a computer name and attempt to
# restart the graphics driver on that remote machine.

# An infinite loop to keep the script running until you decide to exit.
while ($true) {
    # Clear the screen for a fresh start each time.
    Clear-Host

    # Prompt the user to enter the name of the remote computer.
    # The -Prompt parameter provides the text for the user.
    $computerName = Read-Host -Prompt "Please enter the remote computer name (or press Enter to exit)"

    # If the user doesn't enter a name and just presses Enter,
    # the script will exit the loop and end.
    if ([string]::IsNullOrWhiteSpace($computerName)) {
        Write-Host "No computer name entered. Exiting script. Goodbye! 👋" -ForegroundColor Green
        break # This command exits the 'while' loop.
    }

    # A try...catch block is used for error handling. If Invoke-Command fails
    # (e.g., computer is offline, remoting is disabled), it won't crash the script.
    try {
        Write-Host "Attempting to connect to '$computerName'..." -ForegroundColor Cyan

        # Invoke-Command runs the script block on the specified remote computer.
        # The -ErrorAction Stop ensures that if an error occurs, it's caught by the 'catch' block.
        Invoke-Command -ComputerName $computerName -ErrorAction Stop -ScriptBlock {
            # This is the code that runs on the remote machine.
            Write-Host "Searching for the display adapter on $env:COMPUTERNAME..."

            # Find the primary display adapter that is currently running.
            $displayAdapter = Get-PnpDevice -Class 'Display' -Status 'OK'

            # If an adapter is found, restart it.
            if ($displayAdapter) {
                Write-Host "Found: $($displayAdapter.FriendlyName). Restarting driver..." -ForegroundColor Yellow
                
                # Disable and then re-enable the device. The -Confirm:$false switch
                # prevents PowerShell from asking for confirmation.
                $displayAdapter | Disable-PnpDevice -Confirm:$false
                Start-Sleep -Seconds 1 # A brief pause to ensure the device is fully disabled.
                $displayAdapter | Enable-PnpDevice -Confirm:$false
                
                Write-Host "✅ Graphics driver on $env:COMPUTERNAME has been successfully restarted!" -ForegroundColor Green
            } else {
                Write-Host "❌ Could not find an active display adapter on $env:COMPUTERNAME." -ForegroundColor Red
            }
        }
    }
    catch {
        # This block runs if any error occurred in the 'try' block.
        # $_ represents the error that was caught.
        Write-Host "An error occurred. Please check the computer name and ensure PowerShell Remoting is enabled on the remote machine." -ForegroundColor Red
        Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    }

    # Pause the script and wait for the user to press Enter before looping again.
    Read-Host "Operation complete. Press Enter to run again on another computer..."
}
