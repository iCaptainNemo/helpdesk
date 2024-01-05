Import-Module ActiveDirectory

## Get the current user with specific properties
$AdminUser = Get-ADUser -Identity $env:USERNAME -Properties SamAccountName, Name, HomeDirectory

# Function to unlock AD account on all domain controllers
function Unlock-ADAccountOnAllDomainControllers {
    param (
        [string]$userId
    )

    $dcList = Get-ADDomainController -Filter *
    
    $jobs = foreach ($targetDC in $dcList.Name) {
        Start-Job -ScriptBlock {
            param ($userId, $targetDC)
            $error.Clear()
            Unlock-ADAccount -Identity $userId -Server $targetDC -ErrorAction SilentlyContinue -ErrorVariable unlockError
            if ($unlockError) {
                # Handle the error here. For example, you could write it to a log file.
               # Write-Host ("Error unlocking in " + $targetDC) -BackgroundColor DarkRed
            } else {
                Write-Host ("Unlocked in " + $targetDC) -BackgroundColor DarkGreen
            }
        } -ArgumentList $userId, $targetDC
    }

    # Wait for all jobs to complete
    $jobs | Wait-Job | Out-Null

    # Receive and remove completed jobs without displaying job information
    $jobs | ForEach-Object {
        Receive-Job -Job $_ | Out-Null
        Remove-Job -Job $_ | Out-Null
    }
}

$unlockedUsersCount = 0
# Function to get probable locked-out users
function Get-ProbableLockedOutUsers {
    # Search for all locked-out user accounts
    $lockedOutUsers = Search-ADAccount -LockedOut -UsersOnly

    # Iterate through all locked-out users and get additional AD properties
    $probableLockedOutUsers = foreach ($lockedOutUser in $lockedOutUsers) {
        Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties *
            }

            # Filter locked-out users whose lockoutTime is within X days of the current date, Enabled is True, PasswordExpired is False, and badPwdCount is greater than 0
            $probableLockedOutUsers = $probableLockedOutUsers | Where-Object {
                $_.AccountlockoutTime -ge (Get-Date).AddDays(-1) -and
                $_.Enabled -eq $true
            }

            return $probableLockedOutUsers
        }

        # Get the current user with specific properties
        $AdminUser = Get-ADUser -Identity $env:USERNAME -Properties SamAccountName, Name

        $restartScript = $true

    while ($restartScript) {
        # Get probable locked-out users
        $probableLockedOutUsers = Get-ProbableLockedOutUsers

            # Users who are locked out and password is expired
            $lockedoutusersB = $probableLockedOutUsers | Where-Object {
                #$_.LockedOut -eq $true -and
                $_.PasswordExpired -eq $true
            }

            # Users who are locked out and badPwdCount is 0
            $lockedoutusersC = $probableLockedOutUsers | Where-Object {
                #$_.LockedOut -eq $true -and
                $_.badPwdCount -eq 0
                #$_.badPwdCount -lt 3
            }

            # The rest of the users
            $lockedoutusersA = $probableLockedOutUsers | Where-Object {
                $_ -notin $lockedoutusersB -and
                $_ -notin $lockedoutusersC
            }
        # Display the properties of probable locked-out users
        if ($probableLockedOutUsers.Count -gt 0) {
            Write-Host "Probable locked-out users within the last 24 hours:"
            $probableLockedOutUsers | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, Enabled, LockedOut, PasswordExpired, badPwdCount, AccountLockoutTime -AutoSize
        } else {
            Write-Host "No recent locked-out users found."
        }
        # Display the properties of users in $lockedoutusersA, $lockedoutusersB, and $lockedoutusersC in separate tables
        if ($lockedoutusersA.Count -gt 0) {
            Write-Host "Locked-out users within the last 24 hours:"
            $lockedoutusersA | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, Enabled, LockedOut, PasswordExpired, badPwdCount, AccountLockoutTime -AutoSize
        }
        if ($lockedoutusersB.Count -gt 0) {
            Write-Host "Locked-out users Password Expired within the last 24 hours:"
            $lockedoutusersB | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, Enabled, LockedOut, PasswordExpired, badPwdCount, AccountLockoutTime -AutoSize
        }
        if ($lockedoutusersC.Count -gt 0) {
            Write-Host "Locked-out users No Bad password attempts within the last 24 hours:"
            $lockedoutusersC | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, Enabled, LockedOut, PasswordExpired, badPwdCount, AccountLockoutTime -AutoSize
        }

        # Display the menu for unlocking accounts
        Write-Host "Unlock Account Menu:"
        Write-Host "1. Unlock All Users"
        Write-Host "2. Unlock All With Password Expired"
        Write-Host "3. Unlock Users BP = 0"
        Write-Host "4. Auto Unlock Users With Password Expired"
        Write-Host "5. Auto Unlock Users BP = 0"
        Write-Host "0. Exit"

        $choice = Read-Host "Select an option"

        # Process user's choice
        switch ($choice) {
            1 {
                Clear-Host
                $jobs = @()
                $failedUserIds = @()
        
                foreach ($user in $probableLockedOutUsers) {
                    # Skip if the user ID is in the failedUserIds array
                    if ($failedUserIds -contains $user.SamAccountName) {
                        continue
                    }
        
                    $job = Start-Job -ScriptBlock {
                        param ($userId)
                        try {
                            Unlock-ADAccount -Identity $userId -Confirm:$false
                            Write-Host ("User $userId unlocked.") -BackgroundColor DarkGreen
                        } catch {
                            $errormsg = "Failed to unlock $userId. Error: $_"
                            Write-Host $errormsg -ForegroundColor White -BackgroundColor Red
        
                            # Add the failed user ID to the array
                            $failedUserIds += $userId
                        }
                    } -ArgumentList $user.SamAccountName
        
                    $jobs += $job
                }
        
                # Wait for all jobs to complete
                $jobs | Wait-Job | Out-Null
        
                # Receive and remove completed jobs without displaying job information
                $jobs | ForEach-Object {
                    $result = Receive-Job -Job $_ | Out-Null
                    Remove-Job -Job $_ | Out-Null
                    if ($result -eq $null) {
                        $unlockedUsersCount++
                    }
                }
        
                Write-Host "$unlockedUsersCount user(s) unlocked."
            }

            2 {
                Clear-Host
                $jobs = @()

                foreach ($user in $probableLockedOutUsers) {
                    $job = Start-Job -ScriptBlock {
                        param ($userId)
                        $user = Get-ADUser -Identity $userId -Properties LockedOut, PasswordExpired
                        if ($user.LockedOut -and $user.PasswordExpired) {
                            try {
                                Unlock-ADAccount -Identity $userId -Confirm:$false
                                Write-Host ("User $userId unlocked.") -BackgroundColor DarkGreen
                            } catch {
                                $errormsg = "Failed to unlock $userId. Error: $_"
                                Write-Host $errormsg -ForegroundColor White -BackgroundColor Red
                            }
                        }
                    } -ArgumentList $user.SamAccountName

                    $jobs += $job
                }

                # Wait for all jobs to complete
                $jobs | Wait-Job | Out-Null

                # Receive and remove completed jobs without displaying job information
                $jobs | ForEach-Object {
                    $result = Receive-Job -Job $_ | Out-Null
                    Remove-Job -Job $_ | Out-Null
                    if ($result -eq $null) {
                        $unlockedUsersCount++
                    }
                }

                Write-Host "$unlockedUsersCount user(s) unlocked."
            }
            3 {
                Clear-Host
                $jobs = @()

                foreach ($user in $probableLockedOutUsers) {
                    $job = Start-Job -ScriptBlock {
                        param ($userId)
                        $user = Get-ADUser -Identity $userId -Properties LockedOut, BadPwdCount
                        if ($user.LockedOut -and $user.BadPwdCount -eq 0) {
                            try {
                                Unlock-ADAccount -Identity $userId -Confirm:$false
                                Write-Host ("User $userId unlocked.") -BackgroundColor DarkGreen
                            } catch {
                                $errormsg = "Failed to unlock $userId. Error: $_"
                                Write-Host $errormsg -ForegroundColor White -BackgroundColor Red
                            }
                        }
                    } -ArgumentList $user.SamAccountName

                    $jobs += $job
                }

                # Wait for all jobs to complete
                $jobs | Wait-Job | Out-Null

                # Receive and remove completed jobs without displaying job information
                $jobs | ForEach-Object {
                    $result = Receive-Job -Job $_ | Out-Null
                    Remove-Job -Job $_ | Out-Null
                    if ($result -eq $null) {
                        $unlockedUsersCount++
                    }
                }

                Write-Host "$unlockedUsersCount user(s) unlocked."
            }
            4 {
                # Prompt user for refresh interval
                do {
                    $refreshInterval = Read-Host "Enter the refresh interval in minutes (e.g., 1, 5, 10):"
                    $refreshInterval = [int]$refreshInterval
                } while ($refreshInterval -le 0)

                # Auto Unlock at specified refresh interval
                do {
                    # Clear-Host
                    # Write-Host "Auto Unlocking every $refreshInterval minutes. Press Ctrl+C to stop."
                    Start-Sleep -Seconds (60 * $refreshInterval)

                    # Get probable locked-out users
                    $probableLockedOutUsers = Get-ProbableLockedOutUsers

                    # Auto Unlock logic similar to Option 1
                    # Clear-Host
                    $unlockedUsersCount = 0
                    $jobs = @()

                    foreach ($user in $probableLockedOutUsers) {
                        $job = Start-Job -ScriptBlock {
                            param ($userId)
                            $user = Get-ADUser -Identity $userId -Properties LockedOut, PasswordExpired
                            if ($user.LockedOut -and $user.PasswordExpired) {
                                try {
                                    Unlock-ADAccount -Identity $userId -Confirm:$false
                                    Write-Host ("User $userId unlocked.") -BackgroundColor DarkGreen
                                } catch {
                                    $errormsg = "Failed to unlock $userId. Error: $_"
                                    Write-Host $errormsg -ForegroundColor White -BackgroundColor Red
                                }
                            }
                        } -ArgumentList $user.SamAccountName

                        $jobs += $job
                    }

                    # Wait for all jobs to complete
                    $jobs | Wait-Job | Out-Null

                    # Receive and remove completed jobs without displaying job information
                    $jobs | ForEach-Object {
                        $result = Receive-Job -Job $_ | Out-Null
                        Remove-Job -Job $_ | Out-Null
                        if ($result -eq $null) {
                            $unlockedUsersCount++
                        }
                    }

                    Write-Host "$unlockedUsersCount user(s) unlocked."

                } while ($true)
            }
            5 {
                # Prompt user for refresh interval
                do {
                    $refreshInterval = Read-Host "Enter the refresh interval in minutes (e.g., 1, 5, 10):"
                    $refreshInterval = [int]$refreshInterval
                } while ($refreshInterval -le 0)

                # Auto Unlock at specified refresh interval
                do {
                    # Clear-Host
                    # Write-Host "Auto Unlocking every $refreshInterval minutes. Press Ctrl+C to stop."
                    Start-Sleep -Seconds (60 * $refreshInterval)

                    # Get probable locked-out users
                    $probableLockedOutUsers = Get-ProbableLockedOutUsers

                    # Auto Unlock logic similar to Option 1
                    # Clear-Host
                    $jobs = @()

                    foreach ($user in $probableLockedOutUsers) {
                        $job = Start-Job -ScriptBlock {
                            param ($userId)
                            $user = Get-ADUser -Identity $userId -Properties LockedOut, BadPwdCount
                            if ($user.LockedOut -and $user.BadPwdCount -eq 0) {
                                try {
                                    Unlock-ADAccount -Identity $userId -Confirm:$false
                                    Write-Host ("User $userId unlocked.") -BackgroundColor DarkGreen
                                } catch {
                                    $errormsg = "Failed to unlock $userId. Error: $_"
                                    Write-Host $errormsg -ForegroundColor White -BackgroundColor Red
                                }
                            }
                        } -ArgumentList $user.SamAccountName

                        $jobs += $job
                    }

                    # Wait for all jobs to complete
                    $jobs | Wait-Job | Out-Null

                    # Receive and remove completed jobs without displaying job information
                    $jobs | ForEach-Object {
                        $result = Receive-Job -Job $_ | Out-Null
                        Remove-Job -Job $_ | Out-Null
                        if ($result -eq $null) {
                            $unlockedUsersCount++
                        }
                    }

                    Write-Host "$unlockedUsersCount user(s) unlocked."

                } while ($true)
            }

            0 {
                # Set $restartScript to $false to exit the loop and restart the script
                $restartScript = $false
            }
        }
    }

        # Add a restart message outside the loop
        Write-Host "Restarting the script..."
