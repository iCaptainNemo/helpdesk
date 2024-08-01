param (
    [switch]$Debug
)

if ($Debug) {
    $DebugPreference = 'Continue'
}
Write-Debug "Debug mode is enabled."

Import-Module ActiveDirectory

function Get-DomainControllers {
    $dcList = @{}
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        Write-Debug "Current Domain: $($currentDomain)"

        $currentDomain.DomainControllers | ForEach-Object {
            $dcList[$_.Name] = $_
        }

        # Retrieve the primary domain controller (PDC) emulator role owner DN
        $PDC = $currentDomain.PdcRoleOwner
        Write-Debug "Primary DC: $($PDC)"

        # Retrieve the distinguished name of the DDC
        $DDC = $currentDomain.RidRoleOwner
        Write-Debug "Distributed DC: $($DDC)"
        Write-Debug "Number of domain controllers found: $($dcList.Count)"

        return @{
            DcList = $dcList
            PDC = $PDC
            DDC = $DDC
        }
    } catch {
        Write-Host "Error: $_"
    }
}

$domainControllers = Get-DomainControllers
$PDC = $domainControllers.PDC

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
        $adUser = Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties SamAccountName, Name, Enabled, LockedOut, Department, LastBadPasswordAttempt, AccountLockoutTime -Server $PDC

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

        # Create a list of all locked out users that are not in $usersWithMismatchedTimes
        $lockedOut = $probableLockedOutUsers | Where-Object {
            $_.SamAccountName -notin $usersWithMismatchedTimes.SamAccountName
        }

    # Display the properties of locked-out users in a separate table
    if ($lockedOut.Count -gt 0) {
        Write-Host "Locked-out users within the last 24 hours: $($lockedOutUsers.Count)" -ForegroundColor Red
        $lockedOut | Sort-Object AccountLockoutTime -Descending | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, @{Name='Expired';Expression={$_.PasswordExpired}}, AccountLockoutTime -AutoSize
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

    if ($autoUnlock -and $watchedLockedOutUsers.Count -gt 0) {
        # Filter out users who are in the $unlockable array
        $watchedLockedOutUsers = $watchedLockedOutUsers | Where-Object {
            $_.SamAccountName -notin $unlockable
        }
    
        foreach ($user in $watchedLockedOutUsers) {
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
    $currentDate = Get-Date
    $currentHour = $currentDate.Hour
    $currentMinute = $currentDate.Minute
    $dayOfWeek = $currentDate.DayOfWeek

    if (($dayOfWeek -ge [System.DayOfWeek]::Monday -and $dayOfWeek -le [System.DayOfWeek]::Friday) -and 
        (($currentHour -gt 6 -or ($currentHour -eq 6 -and $currentMinute -ge 50)) -and 
        ($currentHour -lt 17 -or ($currentHour -eq 17 -and $currentMinute -le 25)))) {
        # If it's between 6:50 AM and 5:25 PM on weekdays, sleep for the specified refresh interval
        Start-Sleep -Seconds ($refreshInterval * 60)
    } else {
        # If it's outside of these hours or not a weekday, sleep until 6:50 AM of the next weekday
        $sleepUntil650AM = (New-TimeSpan -Start $currentDate -End ($currentDate.Date.AddHours(6).AddMinutes(50))).TotalSeconds
        if ($sleepUntil650AM -lt 0) {
            $sleepUntil650AM += 24 * 60 * 60  # Add 24 hours if the time is past 6:50 AM
        }
        Start-Sleep -Seconds $sleepUntil650AM

        # Clear the variables after waking up
        $unlockable = @()
        $unlocked = @()
        $problemUsers = @()
        $unlockedCounts = @{}
    }

} while ($true)