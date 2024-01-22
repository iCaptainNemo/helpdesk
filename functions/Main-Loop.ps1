# Main loop function
function Main-Loop {
    while ($true) {
        # If the restart flag is set, perform the '0' action and restart the loop
        if ($global:restartScript) {
            Remove-UserId -AdminConfig $AdminConfig
            Clear-Host
            $global:restartScript = $false
            return $null
        }

        # Clears the console
        Clear-Host
        
        # Get User ID before entering the main menu
        $userId = Get-UserID
        # Get AD properties for the provided User ID
        $userId = $envVars['UserID']
        $adUser = Get-ADUserProperties -userId $userId

        # Display AD properties above the menu
        Show-ADUserProperties -adUser $adUser

        # Add a line break or additional Write-Host statements for space
        Write-Host "`n"  # This adds a line break

        # Display last 10 log entries
        $result = Show-LastLogEntries -logFilePath $logFilePath
        $logTable = $result.LogTable
        $logTable | Format-List

        # Add a line break or additional Write-Host statements for space
        Write-Host "`n"  # This adds a line break

        # Main menu loop
        Write-Host "1. Unlock"
        Write-Host "2. Password Reset"
        Write-Host "3. Asset Control"
        Write-Host "0. Clear and Restart Script"

        $choice = Read-Host "Enter your choice"

        $temporaryPassword = $envVars['tempPassword']
        switch ($choice) {
            '0' {
                Remove-UserId -AdminConfig $AdminConfig
                Clear-Host
                return $null
            }
            '1' {
                # Unlock AD account on all domain controllers
                Unlock-ADAccountOnAllDomainControllers -userId $userId
            }
            '2' {
                # Password Reset submenu
                Write-Host "1. Set Temporary to $temporaryPassword"
                Write-Host "2. Set Permanent"
                Write-Host "3. Force Password Change at Next Logon"
                Write-Host "0. Cancel"

                
                $passwordChoice = Read-Host "Enter Choice"
                switch ($passwordChoice) {
                    '1' {
                        if (-not $envVars.ContainsKey('tempPassword')) {
                            Write-Host "Temporary password is not set. Please set it first."
                            break
                        }
            
                        $temporaryPassword = $envVars['tempPassword']
                        Write-Host "Setting Temporary Password for User ID: $userId to $temporaryPassword (User Must Change)"
                        try {
                            Set-ADAccountPassword -Identity $userId -Reset -NewPassword (ConvertTo-SecureString -AsPlainText $temporaryPassword -Force) -ErrorAction Stop
                            Set-ADUser -Identity $userId -ChangePasswordAtLogon $true -ErrorAction Stop
                            Write-Host "Temporary password set to $temporaryPassword. User must change the password at the next login."
                            Read-Host "Press any key to continue"
                        } catch {
                            Write-Host "Error: $_"
                        }
                        break
                    }
                    '2' {
                        # Prompt for a permanent password
                        $permanentPassword = Read-Host "Enter the permanent password for User ID: $userId"
                        Write-Host "Setting Permanent Password for User ID: $userId"
                        try {
                            Set-ADAccountPassword -Identity $userId -NewPassword (ConvertTo-SecureString -AsPlainText $permanentPassword -Force) -ErrorAction Stop
                            Set-ADUser -Identity $userId -ChangePasswordAtLogon $false -ErrorAction Stop
                            Write-Host "Permanent password set for User ID: $userId"
                            Read-Host "Press any key to continue"
                        } catch {
                            Write-Host "Error: $_"
                        }
                        break
                    }
                    '3' {
                        Write-Host "Setting User ID: $userId to change password at next logon"
                        try {
                            Set-ADUser -Identity $userId -ChangePasswordAtLogon $true -ErrorAction Stop
                            Write-Host "User ID: $userId must change the password at the next login."
                            Read-Host "Press any key to continue"
                        } catch {
                            Write-Host "Error: $_"
                        }
                        break
                    }
                    '0' {
                        # Cancel password change
                        Write-Host "Password change canceled."
                        break
                    }
                    default {
                        Write-Host "Invalid choice. Please enter either T, P, or C."
                        break
                    }
                }
            }

            '3' {
                # Asset Control submenu
                Asset-Control -userId $userId
        
                # Check if the script should be restarted
                if ($global:restartScript) {
                    # Assuming Remove-UserId is updated to work with hashtable
                    $envVars = Remove-UserId -envVars $envVars
                    $userId = $null
                    Clear-Host
                    $global:restartScript = $false
                    continue
                }
            }
        }
    }
}