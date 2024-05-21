param (
    [switch]$Debug
)

if ($Debug) {
    $DebugPreference = 'Continue'
}

Import-Module ActiveDirectory

Write-Debug "Debug mode is enabled."

function Get-CurrentTime {
    Get-Date -Format "yyyy-MM-dd hh:mm:ss tt"
}

# Prompt user for userIDs to watch for
$watchedUserIDsInput = Read-Host "Enter the userIDs to watch for, separated by commas (e.g., userID1, userID2, userID3):"
$watchedUserIDsArray = $watchedUserIDsInput.Split(',')
$watchedUserIDs = @{}
foreach ($userID in $watchedUserIDsArray) {
    $watchedUserIDs[$userID.Trim()] = $true
}

function Display-RestartCount {
    $script:restartCount++
    Write-Host "Script has restarted $($script:restartCount) times."
}

# Prompt user for refresh interval
do {
    $refreshInterval = Read-Host "Enter the refresh interval in minutes (e.g., 1, 5, 10):"
    $refreshInterval = [int]$refreshInterval
} while ($refreshInterval -le 0)

# Prompt user for auto unlock
$autoUnlockInput = Read-Host "Do you want to enable auto unlock for mismatched accounts? (y/n):"
$autoUnlock = $autoUnlockInput.Trim().ToLower() -eq 'y'


# Initialize restart count
$script:restartCount = 0

$unlockable = @()
$unlocked = @()
$problemUsers = @()
$unlockedCounts = @{}


do {
    # Clear the host
    Clear-Host

    # Display the current time
    $currentTime = Get-CurrentTime
    Write-Host "Current Time: $currentTime"

    # Initialize the list of watched locked-out users
    $watchedLockedOutUsers = @()

    # Display the restart count
    Display-RestartCount

    #Display the count of unlocked users
    Write-Host "Number of users unlocked: $($unlocked.Count)" -ForegroundColor Yellow

    # Search for all locked-out user accounts
    $lockedOutUsers = Search-ADAccount -LockedOut -UsersOnly | Where-Object {
        $_.SamAccountName -notin $unlockable
    }

    # Iterate through all locked-out users and get additional AD properties
    $probableLockedOutUsers = foreach ($lockedOutUser in $lockedOutUsers) {
        ## $adUser = Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties *
        $adUser = Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties SamAccountName, Name, Enabled, LockedOut, Department, LastBadPasswordAttempt, AccountLockoutTime

                # If the user is in the watched list, add them to the watched locked-out users list
                if ($watchedUserIDs.ContainsKey($adUser.SamAccountName)) {
                    $watchedLockedOutUsers += $adUser
                }
        
        $adUser
    }

    # Debug prompt to display the probable locked out users in a table
    if ($debug) {
        Write-Host "Debug: Displaying probable locked out users:"
        $probableLockedOutUsers | Format-Table SamAccountName, Name, Enabled, LockedOut, Department, LastBadPasswordAttempt, AccountLockoutTime
    }

    # Display the properties of watched locked-out users in a separate table
    if ($watchedLockedOutUsers.Count -gt 0) {
        Write-Host "Watched locked-out users within the last 24 hours: $($watchedlockedOutUsers.Count)" -ForegroundColor Red
        $tableOutput = $watchedLockedOutUsers | Sort-Object AccountLockoutTime -Descending | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, @{Name='Expired';Expression={$_.PasswordExpired}}, AccountLockoutTime -AutoSize | Out-String
        $tableOutput -split "`n" | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    } else {
        Write-Host "0 watched locked-out users found." -ForegroundColor Green
    }
    # Filter locked-out users whose lockoutTime is within X days of the current date and Enabled is True
    $probableLockedOutUsers = $probableLockedOutUsers | Where-Object {
        $_.AccountlockoutTime -ge (Get-Date).AddDays(-1) -and
        $_.Enabled -eq $true
    }

    # Filter users whose AccountLockoutTime and LastBadPasswordAttempt do not match within a 5-minute interval
    # or if the LastBadPasswordAttempt is null
    $usersWithMismatchedTimes = $probableLockedOutUsers | Where-Object {
        if ($_.AccountLockoutTime) {
            if ($_.LastBadPasswordAttempt) {
                return [Math]::Abs(($_.AccountLockoutTime - $_.LastBadPasswordAttempt).TotalMinutes) -gt 5
            } else {
                return $true
            }
        }
        return $false
    }

    ## Debugging

    # $usersWithMismatchedTimes = $probableLockedOutUsers | Where-Object {
    #     if ($_.AccountLockoutTime) {
    #         if ($_.LastBadPasswordAttempt) {
    #             $timeDifference = [Math]::Abs(($_.AccountLockoutTime - $_.LastBadPasswordAttempt).TotalMinutes)
    #             Write-Host "User: $($_.SamAccountName), AccountLockoutTime: $($_.AccountLockoutTime), LastBadPasswordAttempt: $($_.LastBadPasswordAttempt), Time Difference: $timeDifference"
    #             return $timeDifference -gt 5
    #         } else {
    #             Write-Host "User: $($_.SamAccountName), AccountLockoutTime: $($_.AccountLockoutTime), LastBadPasswordAttempt: Null"
    #             return $true
    #         }
    #     }
    #     Write-Host "User: $($_.SamAccountName), AccountLockoutTime: Null"
    #     return $false
    # }


    # Create a list of all locked out users that are not in $usersWithMismatchedTimes
    $lockedOut = $probableLockedOutUsers | Where-Object {
        $_.SamAccountName -notin $usersWithMismatchedTimes.SamAccountName
    }
    # Post data to Power BI API for each locked-out user
#    foreach ($user in $probableLockedOutUsers) {
#        $payload = @{
#            "AdminID" = $AdminUser.SamAccountName  # Assuming SamAccountName is the AdminID, modify as needed
#            "UserID" = $user.SamAccountName
#            "Enabled" = $user.Enabled
#            "Locked" = $user.LockedOut
#            "PasswordExpired" = $user.PasswordExpired
#            "BadPasswords" = $user.badPwdCount
#            "AccountLockoutTime" = $user.AccountLockoutTime
#        }
#        # Power BI API endpoint
#        $endpoint = "https://api.powerbigov.us/beta/31399e53-6a93-49aa-8cae-c929f9d4a91d/datasets/a08cf34a-60d2-4b7f-8632-83ac4780364c/rows?key=95UTbh7eub3juY%2Fe53DCZ%2Ba1qOEudlWngNjNtmSdEcF%2FRfXzR97Y0s13Ys1ySmTkAt%2BXP3PCLko%2BleYk%2FtOlDA%3D%3D"

#        Invoke-RestMethod -Method Post -Uri $endpoint -Body (ConvertTo-Json @($payload))
#git    }

    # Display the properties of locked-out users in a separate table
    if ($lockedOut.Count -gt 0) {
        Write-Host "Locked-out users within the last 24 hours: $($lockedOutUsers.Count)" -ForegroundColor Red
        $lockedOut | Sort-Object AccountLockoutTime -Descending | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, @{Name='Expired';Expression={$_.PasswordExpired}}, AccountLockoutTime, LastBadPasswordAttempt -AutoSize
    } else {
        Write-Host "0 recent locked-out users" -ForegroundColor Green
    }

    # Display the properties of users with mismatched times in a separate table
    if ($usersWithMismatchedTimes.Count -gt 0) {
        Write-Host "Mismatched AccountLockoutTime and LastBadPasswordAttempt:" -ForegroundColor Yellow
        $usersWithMismatchedTimes | Sort-Object AccountLockoutTime -Descending | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, @{Name='Expired';Expression={$_.PasswordExpired}}, LastBadPasswordAttempt, AccountLockoutTime -AutoSize
    } else {
        Write-Host "0 users with mismatched found." -ForegroundColor Green
    }

    if ($autoUnlock -and $usersWithMismatchedTimes.Count -gt 0) {
        # Filter out users who are in the $unlockable array
        $usersWithMismatchedTimes = $usersWithMismatchedTimes | Where-Object {
            $_.SamAccountName -notin $unlockable
        }
    
        foreach ($user in $usersWithMismatchedTimes) {
            try {
                & '.\Unlocker.ps1' -UserID $user.SamAccountName -StopLoop:$true > $null
                Write-Host "User $($user.SamAccountName) has been unlocked" -BackgroundColor DarkGreen
                $unlocked += $user.SamAccountName
        
                # Update the count for this user
                if ($unlockedCounts.ContainsKey($user.SamAccountName)) {
                    $unlockedCounts[$user.SamAccountName]++
                } else {
                    $unlockedCounts[$user.SamAccountName] = 1
                }
        
               # Check if this user is a problem user
                if ($unlockedCounts[$user.SamAccountName] -ge 3) {
                    # Only add the user to the problem users list if they are not already in it
                    if ($user.SamAccountName -notin $problemUsers) {
                        $problemUsers += $user.SamAccountName
                    }
                }
            } catch {
                if ($_.Exception.Message -like "*Access is denied*") {
                    $unlockable += $user.SamAccountName
                }
            }
        }
        Write-Host ""
    }
    
    # Display the list of users who could not be unlocked
    if ($unlockable.Count -gt 0) {
        Write-Host "Users who could not be unlocked due to insufficient permissions:" -ForegroundColor Yellow
        $unlockableUsers = foreach ($user in $unlockable) {
            Get-ADUser -Identity $user -Properties *
        }
        $unlockableUsers | Sort-Object Name | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, Department -AutoSize
    }

    # Display the list of problem users
    if ($problemUsers.Count -gt 0) {
        Write-Host "Problem users who have been unlocked 3 or more times:" -ForegroundColor Yellow
        $problemUsersDetails = foreach ($user in $problemUsers) {
            $userDetails = Get-ADUser -Identity $user -Properties *
            # Add the unlock count to the user details
            $userDetails | Add-Member -NotePropertyName 'UnlockCount' -NotePropertyValue $unlockedCounts[$user] -Force
            $userDetails
        }
        $problemUsersDetails | Sort-Object Name | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, Department, UnlockCount -AutoSize
    } else {
        Write-Host "No problem users found." -ForegroundColor Green
    }

    # Display the countdown message
    Write-Host "Refreshing in $refreshInterval minute(s)..."

    # Wait for specified minutes or go to sleep during non-business hours
    $currentHour = (Get-Date).Hour
    if ($currentHour -ge 17 -or $currentHour -lt 7) {
        # If it's between 5 PM and 7 AM, sleep until 7 AM
        $sleepUntil7AM = (New-TimeSpan -Start (Get-Date) -End (Get-Date).Date.AddHours(7)).TotalSeconds
        if ($sleepUntil7AM -lt 0) {
            $sleepUntil7AM += 24 * 60 * 60  # Add 24 hours if the time is past 7 AM
        }
        Start-Sleep -Seconds $sleepUntil7AM
        
        # Clear the variables after waking up
        $unlockable = @()
        $unlocked = @()
        $problemUsers = @()
        $unlockedCounts = @{}
    } else {
        # If it's between 7 AM and 5 PM, sleep for the specified refresh interval
        Start-Sleep -Seconds ($refreshInterval * 60)
    }

} while ($true)