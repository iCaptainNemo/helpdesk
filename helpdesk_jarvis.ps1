Clear-Host
# Import the Active Directory module
Import-Module ActiveDirectory

# Prompt for temporary password or default to the current season and year
$temporaryPassword = Read-Host "Enter a temporary password to use for password resets or leave as default ($(Get-Date -UFormat '%B%Y'))"
if (-not $temporaryPassword) {
    $temporaryPassword = Get-Date -UFormat '%B%Y'
}

# Function to get User ID
function Get-UserId {
    $userId = Read-Host "Enter New User ID"
    return $userId
}

# Function to get AD properties for a given User ID
function Get-ADUserProperties {
    param (
        [string]$userId
    )

    try {
        $adUser = Get-ADUser -Identity $userId -Properties *
        return $adUser
    } catch {
        Write-Host "Error: $_"
        return $null
    }
}

# Function to display AD properties as a table with color coding
function Show-ADUserProperties {
    param (
        [Microsoft.ActiveDirectory.Management.ADUser]$adUser
    )

    if ($adUser) {
        $properties = [ordered]@{
            'User ID'                   = $adUser.SamAccountName
            'Given Name'                = $adUser.GivenName
            'Display Name'              = $adUser.DisplayName
            'Email'                     = $adUser.EmailAddress
            'Department'                = $adUser.Department
            'Password Last Set'         = $adUser.PasswordLastSet
            'Account Lockout Time'      = $adUser.AccountLockoutTime
            'Last Bad Password Attempt' = $adUser.LastBadPasswordAttempt
            'Bad Logon Count'           = $adUser.BadLogonCount
            'Bad Password Count'        = $adUser.badPwdCount
        }
        # Display properties with color coding
        $properties.GetEnumerator() | Format-Table

        # Color coding for Password Expired
        $passwordExpired = $adUser.PasswordExpired
        if ($passwordExpired) {
            Write-Host "Password Expired: Expired" -ForegroundColor Red
        } else {
            Write-Host "Password Expired: Not Expired" -ForegroundColor Green
        }

        # Color coding for LockedOut
        $lockedOut = $adUser.LockedOut
        if ($lockedOut) {
            Write-Host "LockedOut: True" -ForegroundColor Red
        } else {
            Write-Host "LockedOut: False" -ForegroundColor Green
        }

    }
}



# Function to display last 10 log entries
function Show-LastLogEntries {
    param (
        [string]$logFilePath
    )

    try {
        $logEntries = Get-Content $logFilePath -Tail 10
        Write-Host "Last 10 log entries:"
        foreach ($entry in $logEntries) {
            Write-Host $entry
        }
    } catch {
        Write-Host "Error: $_"
    }
}

# Function to unlock an AD account on all domain controllers
function Unlock-ADAccountOnAllDomainControllers {
    param (
        [string]$userId
    )

    try {
        $domainControllers = Get-ADDomainController -Filter *
        foreach ($dc in $domainControllers) {
            Write-Host "Unlocking AD Account for User ID: $userId on Domain Controller: $($dc.Name)"
            Unlock-ADAccount -Identity $userId -Server $dc.HostName -ErrorAction Stop
            Write-Host "Account successfully unlocked on $($dc.Name)!"
        }
    } catch {
        Write-Host "Error: $_"
    }
}


# Main loop
while ($true) {
    # Get User ID before entering the main menu
    $userId = Get-UserId

    # Loop for the main menu
    while ($true) {
        # Get AD properties for the provided User ID
        $adUser = Get-ADUserProperties -userId $userId

        # Display AD properties above the menu
        Show-ADUserProperties -adUser $adUser

        # Add a line break or additional Write-Host statements for space
        Write-Host "`n"  # This adds a line break

        # Display last 10 log entries
        $logFilePath = "\\hssserver037\login-tracking\$userId.log"
        Show-LastLogEntries -logFilePath $logFilePath

        # Add a line break or additional Write-Host statements for space
        Write-Host "`n"  # This adds a line break

        # Main menu loop
        Write-Host "1. Unlock AD Account on All Domain Controllers"
        Write-Host "2. Set Temporary Password (User Must Change)"
        Write-Host "3. Display AD User Properties"
        Write-Host "4. Show Last 10 Log Entries"
        Write-Host "5. Clear and Restart"

        $choice = Read-Host "Enter your choice"

        switch ($choice) {
            '1' {
                # Unlock AD account on all domain controllers
                Unlock-ADAccountOnAllDomainControllers -userId $userId
                Write-Host "Press Enter to continue"
                Read-Host
            }
            '2' {
                Write-Host "Setting Temporary Password for User ID: $userId to $temporaryPassword (User Must Change)"
                try {
                    Set-ADAccountPassword -Identity $userId -Reset -NewPassword (ConvertTo-SecureString -AsPlainText $temporaryPassword -Force) -ErrorAction Stop
                    Set-ADUser -Identity $userId -ChangePasswordAtLogon $true -ErrorAction Stop
                    Write-Host "Temporary password set to $temporaryPassword. User must change the password at next login."
                } catch {
                    Write-Host "Error: $_"
                }
                Write-Host "Press Enter to continue"
                Read-Host
            }
            '3' {
                # Display AD properties for the provided User ID
                Show-ADUserProperties -adUser $adUser
                Write-Host "Press Enter to continue"
                Read-Host
            }
            '4' {
                # Show last 10 log entries
                Show-LastLogEntries -logFilePath $logFilePath
                Write-Host "Press Enter to continue"
                Read-Host
            }
            '5' {
                # Clear the console, reset User ID, and restart the script
                $userId = $null
                Clear-Host
                $userId = Read-Host "Enter New User ID"
                break
            }
        }
    }
}
