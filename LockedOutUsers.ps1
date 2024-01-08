﻿Import-Module ActiveDirectory

function Get-CurrentTime {
    Get-Date -Format "yyyy-MM-dd hh:mm:ss tt"
}

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


# Get the current user
$AdminUser = Get-ADUser -Identity $env:USERNAME -Properties *

function Display-RestartCount {
    $script:restartCount++
    Write-Host "Script has restarted $($script:restartCount) times."
}

# Prompt user for refresh interval
do {
    $refreshInterval = Read-Host "Enter the refresh interval in minutes (e.g., 1, 5, 10):"
    $refreshInterval = [int]$refreshInterval
} while ($refreshInterval -le 0)

# Initialize restart count
$script:restartCount = 0

do {
    # Clear the host
    Clear-Host

    # Display the current time
    $currentTime = Get-CurrentTime
    Write-Host "Current Time: $currentTime"

    # Display the restart count
    Display-RestartCount

    # Iterate through all locked-out users and get additional AD properties
    $probableLockedOutUsers = foreach ($lockedOutUser in $lockedOutUsers) {
        $adUser = Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties *
        $adUser
    }

    # Get probable locked-out users
    $probableLockedOutUsers = Get-ProbableLockedOutUsers

        # Users who are locked out and password is expired
        $lockedoutusersB = $probableLockedOutUsers | Where-Object {
            #$_.LockedOut -eq $true -and
            $_.PasswordExpired -eq $true
        }

        # Users who are locked out and badPwdCount is 0 or null
        $lockedoutusersC = $probableLockedOutUsers | Where-Object {
            #$_.LockedOut -eq $true -and
            ($_.badPwdCount -eq 0 -or $_.badPwdCount -eq $null)
        }

        # The rest of the users
        $lockedoutusersA = $probableLockedOutUsers | Where-Object {
            $_ -notin $lockedoutusersB -and
            $_ -notin $lockedoutusersC
        }
    # Display the properties of probable locked-out users
    if ($probableLockedOutUsers.Count -gt 0) {
        # Write-Host "Probable locked-out users within the last 24 hours:"
        # $probableLockedOutUsers | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, Enabled, LockedOut, PasswordExpired, badPwdCount, AccountLockoutTime -AutoSize
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
        Write-Host "Locked-out users Bad password attempts < 3 within the last 24 hours:"
        $lockedoutusersC | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, Enabled, LockedOut, PasswordExpired, badPwdCount, AccountLockoutTime -AutoSize
    }
    # Display the countdown message
    Write-Host "Refreshing in $refreshInterval minute(s)..."

    # Wait for specified minutes
    Start-Sleep -Seconds ($refreshInterval * 60)

} while ($true)