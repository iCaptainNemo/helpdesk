# Import the Active Directory module
Import-Module ActiveDirectory

# Prompt for temporary password or default to the current season and year
$temporaryPassword = Read-Host "Enter the temporary password (default is $(Get-Date -UFormat '%B%Y'))"
if (-not $temporaryPassword) {
    $temporaryPassword = Get-Date -UFormat '%B%Y'
}

# Function to get User ID
function Get-UserId {
    $userId = Read-Host "Enter User ID"
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

# Function to display AD properties
function Show-ADUserProperties {
    param (
        [Microsoft.ActiveDirectory.Management.ADUser]$adUser
    )

    if ($adUser) {
        Write-Host "User ID: $($adUser.SamAccountName)"
        Write-Host "Display Name: $($adUser.DisplayName)"
        Write-Host "Email: $($adUser.EmailAddress)"
        Write-Host "Description: $($adUser.Description)"

        # Color coding for lockout status
        $lockoutStatus = $adUser.LockoutEnabled
        if ($lockoutStatus) {
            Write-Host "Lockout Status: $($adUser.LockoutEnabled)" -ForegroundColor Red
        } else {
            Write-Host "Lockout Status: $($adUser.LockoutEnabled)" -ForegroundColor Green
        }

        # Color coding for password expiration status
        $passwordExpired = $adUser.PasswordExpired
        if ($passwordExpired) {
            Write-Host "Password Expired: $($adUser.PasswordExpired)" -ForegroundColor Red
        } else {
            Write-Host "Password Expired: $($adUser.PasswordExpired)" -ForegroundColor Green
        }

        # Add more properties as needed
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

        # Main menu loop
        Clear-Host
        Write-Host "1. Unlock AD Account on All Domain Controllers"
        Write-Host "2. Set Temporary Password (User Must Change)"
        Write-Host "3. Clear and Restart"

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
                # Clear the console and restart the script
                Clear-Host
                break
            }
        }
    }
}
