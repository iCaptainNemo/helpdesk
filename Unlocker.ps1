Import-Module ActiveDirectory

## Get the current user with specific properties
$AdminUser = Get-ADUser -Identity $env:USERNAME -Properties SamAccountName, Name

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
        $_.Enabled -eq $true -and
        $_.PasswordExpired -eq $false -and
        $_.badPwdCount -eq 0
    }

    return $probableLockedOutUsers
}

# Get the current user with specific properties
$AdminUser = Get-ADUser -Identity $env:USERNAME -Properties SamAccountName, Name

$restartScript = $true

while ($restartScript) {
    # Get probable locked-out users
    $probableLockedOutUsers = Get-ProbableLockedOutUsers

    # Display the properties of probable locked-out users in a separate table
    if ($probableLockedOutUsers.Count -gt 0) {
        Write-Host "Locked-out users within the last 24 hours:"
        $probableLockedOutUsers | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, Enabled, LockedOut, PasswordExpired, badPwdCount, AccountLockoutTime -AutoSize
    } else {
        Write-Host "No recent locked-out users found."
    }

    # Display the menu for unlocking accounts
    Write-Host "Unlock Account Menu:"
    Write-Host "1. Unlock All With Password Expired"
    Write-Host "2. Unlock Users BP = 0"
    Write-Host "3. Auto Unlock Users With Password Expired"
    Write-Host "4. Auto Unlock Users BP = 0"
    Write-Host "5. Exit"

    $choice = Read-Host "Select an option"

    # Process user's choice
    switch ($choice) {
        1 {
            Clear-Host
            $unlockedUsersCount = 0
            $jobs = @()

            foreach ($user in $probableLockedOutUsers) {
                $job = Start-Job -ScriptBlock {
                    param ($userId)
                    try {
                        Unlock-ADAccount -Identity $userId -Confirm:$false
                        Write-Host ("User $userId unlocked.") -BackgroundColor DarkGreen
                    } catch {
                        $errormsg = "Failed to unlock $userId. Error: $_"
                        Write-Host $errormsg -ForegroundColor White -BackgroundColor Red
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
            $unlockedUsersCount = 0
            $jobs = @()

            foreach ($user in $probableLockedOutUsers) {
                $job = Start-Job -ScriptBlock {
                    param ($userId)
                    try {
                        Unlock-ADAccount -Identity $userId -Confirm:$false
                        Write-Host ("User $userId unlocked.") -BackgroundColor DarkGreen
                    } catch {
                        $errormsg = "Failed to unlock $userId. Error: $_"
                        Write-Host $errormsg -ForegroundColor White -BackgroundColor Red
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
                        try {
                            Unlock-ADAccount -Identity $userId -Confirm:$false
                            Write-Host ("User $userId unlocked.") -BackgroundColor DarkGreen
                        } catch {
                            $errormsg = "Failed to unlock $userId. Error: $_"
                            Write-Host $errormsg -ForegroundColor White -BackgroundColor Red
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
        4 {
            # Prompt user for refresh interval
            do {
                $refreshInterval = Read-Host "Enter the refresh interval in minutes (e.g., 1, 5, 10):"
                $refreshInterval = [int]$refreshInterval
            } while ($refreshInterval -le 0)
            $unlockedUsersTotalCount = 0
            # Auto Unlock Users BP = 0 at specified refresh interval
            do {
                # Clear-Host
                # Write-Host "Auto Unlocking Users BP = 0 every $refreshInterval minutes. Press Ctrl+C to stop."
                Start-Sleep -Seconds (60 * $refreshInterval)

                # Get probable locked-out users
                $probableLockedOutUsers = Get-ProbableLockedOutUsers

                # Auto Unlock logic similar to Option 2
                # Clear-Host
                $unlockedUsersCount = 0
                $jobs = @()

                foreach ($user in $probableLockedOutUsers) {
                    $job = Start-Job -ScriptBlock {
                        param ($userId)
                        try {
                            Unlock-ADAccount -Identity $userId -Confirm:$false
                            Write-Host ("User $userId unlocked.") -BackgroundColor DarkGreen
                        } catch {
                            $errormsg = "Failed to unlock $userId. Error: $_"
                            Write-Host $errormsg -ForegroundColor White -BackgroundColor Red
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

                if ($unlockedUsersCount -gt 0) {
                    $unlockedUsersTotalCount += $unlockedUsersCount
                    Write-Host "$unlockedUsersCount user(s) unlocked."
                }

            } while ($true)
        }
        
        5 {
            # Set $restartScript to $false to exit the loop and restart the script
            $restartScript = $false
        }
    }
}

# Add a restart message outside the loop
Write-Host "Restarting the script..."
