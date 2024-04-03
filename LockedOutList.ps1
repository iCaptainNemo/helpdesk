Import-Module ActiveDirectory

function Get-CurrentTime {
    Get-Date -Format "yyyy-MM-dd hh:mm:ss tt"
}

#Login-PowerBI


# Get the current user
$AdminUser = Get-ADUser -Identity $env:USERNAME -Properties *

# Prompt user for userIDs to watch for
$watchedUserIDsInput = Read-Host "Enter the userIDs to watch for, separated by commas (e.g., userID1,userID2,userID3):"
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


# Initialize restart count
$script:restartCount = 0

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

    # Search for all locked-out user accounts
    $lockedOutUsers = Search-ADAccount -LockedOut -UsersOnly

    # Iterate through all locked-out users and get additional AD properties
    $probableLockedOutUsers = foreach ($lockedOutUser in $lockedOutUsers) {
        $adUser = Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties *

                # If the user is in the watched list, add them to the watched locked-out users list
                if ($watchedUserIDs.ContainsKey($adUser.SamAccountName)) {
                    $watchedLockedOutUsers += $adUser
                }
        
        $adUser
    }
    # Display the properties of watched locked-out users in a separate table
    if ($watchedLockedOutUsers.Count -gt 0) {
        Write-Host "Watched locked-out users within the last 24 hours:"
        $tableOutput = $watchedLockedOutUsers | Sort-Object AccountLockoutTime -Descending | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, @{Name='Expired';Expression={$_.PasswordExpired}}, AccountLockoutTime -AutoSize | Out-String
        $tableOutput -split "`n" | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    } else {
        Write-Host "No recent watched locked-out users found." -ForegroundColor Green
    }
    # Filter locked-out users whose lockoutTime is within X days of the current date and Enabled is True
    $probableLockedOutUsers = $probableLockedOutUsers | Where-Object {
        $_.AccountlockoutTime -ge (Get-Date).AddDays(-1) -and
        $_.Enabled -eq $true
    }

    # Filter users whose AccountLockoutTime and LastBadPasswordAttempt do not match within a 5-minute interval
    # or if the LastBadPasswordAttempt is null
    $usersWithMismatchedTimes = $probableLockedOutUsers | Where-Object {
        if ($_.AccountLockoutTime -and $_.LastBadPasswordAttempt) {
            [Math]::Abs(($_.AccountLockoutTime - $_.LastBadPasswordAttempt).TotalMinutes) -gt 5
        } elseif ($null -eq $_.LastBadPasswordAttempt) {
            $true
        } else {
            $false
        }
    }

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
        Write-Host "Locked-out users within the last 24 hours:" -ForegroundColor Red
        $lockedOut | Sort-Object AccountLockoutTime -Descending | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, @{Name='Expired';Expression={$_.PasswordExpired}}, AccountLockoutTime -AutoSize
    } else {
        Write-Host "0 recent locked-out users" -ForegroundColor Green
    }

    # Display the properties of users with mismatched times in a separate table
    if ($usersWithMismatchedTimes.Count -gt 0) {
        Write-Host "Mismatched AccountLockoutTime and LastBadPasswordAttempt:" -ForegroundColor Yellow
        $usersWithMismatchedTimes | Sort-Object AccountLockoutTime -Descending | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, @{Name='Expired';Expression={$_.PasswordExpired}}, LastBadPasswordAttempt, AccountLockoutTime -AutoSize
    } else {
        Write-Host "0 users with mismatched AccountLockoutTime and LastBadPasswordAttempt found." -ForegroundColor Green
    }

    # Display the countdown message
    Write-Host "Refreshing in $refreshInterval minute(s)..."

    # Wait for specified minutes
    Start-Sleep -Seconds ($refreshInterval * 60)

} while ($true)