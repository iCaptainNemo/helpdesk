$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf
Import-Module ActiveDirectory

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

    # Display the number of probable locked-out users
    if ($probableLockedOutUsers.Count -gt 0) {
        Write-Host "Number of locked-out users: $($probableLockedOutUsers.Count)" -ForegroundColor Red
    } else {
        Write-Host "Number of locked-out users: 0" -ForegroundColor Green
    }
    # Get probable locked-out users
    $probableLockedOutUsers = Get-ProbableLockedOutUsers

    # Users who are locked out and password is expired
    $lockedoutusersB = $probableLockedOutUsers | Where-Object {
        $_.PasswordExpired -eq $true
    }

    # The rest of the users
    $lockedoutusersA = $probableLockedOutUsers | Where-Object {
        $_ -notin $lockedoutusersB
    }

    # Display the properties of probable locked-out users
    if ($probableLockedOutUsers.Count -gt 0) {
       # Write-Host "Probable locked-out users within the last 24 hours:"
       # $probableLockedOutUsers | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, Enabled, LockedOut, PasswordExpired, badPwdCount, AccountLockoutTime -AutoSize
    } else {
        Write-Host "No recent locked-out users found."
    }

    # Display the properties of users in $lockedoutusersA and $lockedoutusersB in separate tables
    if ($lockedoutusersA.Count -gt 0) {
        Write-Host "Locked-out users within the last 24 hours:"
        $lockedoutusersA | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, AccountLockoutTime -AutoSize
    }
    if ($lockedoutusersB.Count -gt 0) {
        Write-Host "Locked-out users Password Expired within the last 24 hours:"
        $lockedoutusersB | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, AccountLockoutTime -AutoSize
    }
    # Display the countdown message
    Write-Host "Refreshing in $refreshInterval minute(s)..."

    # Wait for specified minutes
    Start-Sleep -Seconds ($refreshInterval * 60)

} while ($true)