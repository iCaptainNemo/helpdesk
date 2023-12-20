Import-Module ActiveDirectory

###Login-PowerBI

# Power BI API endpoint
###$endpoint = "https://api.powerbigov.us/beta/31399e53-6a93-49aa-8cae-c929f9d4a91d/datasets/a08cf34a-60d2-4b7f-8632-83ac4780364c/rows?key=95UTbh7eub3juY%2Fe53DCZ%2Ba1qOEudlWngNjNtmSdEcF%2FRfXzR97Y0s13Ys1ySmTkAt%2BXP3PCLko%2BleYk%2FtOlDA%3D%3D"

# Get the current user
$AdminUser = Get-ADUser -Identity $env:USERNAME -Properties *

$restartScript = $true

while ($restartScript) {
    # Search for all locked-out user accounts
    $lockedOutUsers = Search-ADAccount -LockedOut -UsersOnly

    # Iterate through all locked-out users and get additional AD properties
    $probableLockedOutUsers = foreach ($lockedOutUser in $lockedOutUsers) {
        Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties *
    }

    # Filter locked-out users whose lockoutTime is within 2 days of the current date, Enabled is True, PasswordExpired is False, and badPwdCount is greater than 0
    $probableLockedOutUsers = $probableLockedOutUsers | Where-Object {
        $_.AccountlockoutTime -ge (Get-Date).AddDays(-1) -and
        $_.Enabled -eq $true -and
        $_.PasswordExpired -eq $false -and
        $_.badPwdCount -eq 0
    }

    # Display the properties of probable locked-out users in a separate table
    if ($probableLockedOutUsers.Count -gt 0) {
        Write-Host "Locked-out users within the last 24 hours:"
        $probableLockedOutUsers | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, Enabled, LockedOut, PasswordExpired, badPwdCount, AccountLockoutTime -AutoSize

     #   # Post data to Power BI API for each locked-out user
     #   foreach ($user in $probableLockedOutUsers) {
     #       $payload = @{
     #           "AdminID" = $AdminUser.SamAccountName  # Assuming SamAccountName is the AdminID, modify as needed
     #           "UserID" = $user.SamAccountName
     #           "Enabled" = $user.Enabled
     #           "Locked" = $user.LockedOut
     #           "PasswordExpired" = $user.PasswordExpired
     #           "BadPasswords" = $user.badPwdCount
     #           "AccountLockoutTime" = $user.AccountLockoutTime
     #       }
        
     #       Invoke-RestMethod -Method Post -Uri $endpoint -Body (ConvertTo-Json @($payload))
      #  }
    } else {
        Write-Host "No recent locked-out users found."
    }

    # Display the menu for unlocking accounts
    Write-Host "Unlock Account Menu:"
    Write-Host "1. Unlock All"
    Write-Host "2. Unlock Users BP = 0"
    Write-Host "3. Restart Script"

    $choice = Read-Host "Select an option"

    # Process user's choice
    switch ($choice) {
        1 {
            foreach ($user in $probableLockedOutUsers) {
                Unlock-ADAccount -Identity $user.SamAccountName -Confirm:$false
            }
        }
        2 {
            Clear-Host
            $unlockedUsersCount = 0
            foreach ($user in $probableLockedOutUsers) {
                Unlock-ADAccount -Identity $user.SamAccountName -Confirm:$false
                $unlockedUsersCount++
            }
            Write-Host "$unlockedUsersCount user(s) unlocked."
        }
        3 {
            # Set $restartScript to $false to exit the loop and restart the script
            $restartScript = $false
        }
    }
}

# Add a restart message outside the loop
Write-Host "Restarting the script..."
