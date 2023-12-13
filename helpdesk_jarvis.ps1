# Function to retrieve domain controllers
function Get-DomainControllers {
    return Get-ADDomainController -Filter *
}

# Function to get User ID with error handling
function Get-UserId {
    while ($true) {
        $userId = Read-Host "Enter User ID"
        try {
            Get-ADUser -Identity $userId -ErrorAction Stop | Out-Null
            return $userId
        } catch {
            #Clear-Host
            Write-Host "Cannot find an object with the given identity. Try again."
        }
    }
}

# Function to get specific AD properties for a given User ID
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
            'Telephone'                 = $adUser.telephoneNumber
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
        # Color coding for Password Last Set within the last 14 days
        $passwordLastSet = $adUser.PasswordLastSet
        if ($passwordLastSet -ne $null) {
            $daysSinceLastSet = (Get-Date) - $passwordLastSet
            if ($daysSinceLastSet.TotalDays -le 14) {
                Write-Host "Password Last Set: $($passwordLastSet.ToString('yyyy-MM-dd HH:mm:ss')) (within the last 14 days)" -ForegroundColor Green
            } else {
                Write-Host "Password Last Set: $($passwordLastSet.ToString('yyyy-MM-dd HH:mm:ss')) (more than 14 days ago)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "Password Last Set: Not available" -ForegroundColor Yellow
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
        Write-Host "Last 10 login entries:"
        foreach ($entry in $logEntries) {
            Write-Host $entry
        }
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host "No logs found" -ForegroundColor Yellow
    }
}



# Function to unlock an AD account on all reachable domain controllers
function Unlock-ADAccountOnReachableDomainControllers {
    param (
        [string]$userId
    )

    $DCList = Get-DomainControllers

    foreach ($targetDC in $DCList.Name) {
        try {
            Unlock-ADAccount -Identity $userId -Server $targetDC -ErrorAction Stop
            Write-Host ("Unlocked in " + $targetDC) -BackgroundColor DarkGreen
        } catch {
            $errormsg = "Failed to unlock $userId in $targetDC. Error: $_"
            Write-Host $errormsg -ForegroundColor White -BackgroundColor Red
        }
    }
}

# Function to test connection to an asset
function Test-AssetConnection {
    param (
        [string]$assetName
    )

    try {
        $null = Test-Connection -ComputerName $assetName -Count 1 -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Function to perform Asset Control actions
function Asset-Control {
    param (
        [string]$userId
    )

    # Add a line break or additional Write-Host statements for space
    Write-Host "`n"  # This adds a line break

    # Prompt for Computer Name
    $computerName = Read-Host "Enter Computer Name"

    # Add a line break or additional Write-Host statements for space
    Write-Host "`n"  # This adds a line break

# Get computer properties
try {
    $computer = Get-ADComputer $computerName -Properties MemberOf
    if ($computer) {
        Write-Host "Computer Properties for $($computerName):"

        $memberOf = $computer.MemberOf -join ', '

        # Check if the required groups are present in MemberOf
        $isHSRemoteComputers = $memberOf -like '*HSRemoteComputers*'
        $isHSRemoteMFAComputers = $memberOf -like '*HSRemoteMFAComputers*'

        # Display properties in a table
        $properties = @{
            'HSRemoteComputers'      = $isHSRemoteComputers
            'HSRemoteMFAComputers'   = $isHSRemoteMFAComputers
            'Computer Reachable' = Test-Connection -Count 1 -ComputerName $computerName -Quiet
        }

        $properties.GetEnumerator() | Format-Table
    } else {
        Write-Host "Computer not found: $computerName" -ForegroundColor Red
        return
    }
} catch {
    Write-Host "Error retrieving computer properties: $_" -ForegroundColor Red
    return
}

# Submenu for Asset Control
while ($true) {
    Write-Host "`nAsset Control Menu"
    Write-Host "1. Remote Desktop"
    Write-Host "2. Remote Assistance"
    Write-Host "3. Clear Browser Data"
    Write-Host "4. Add Network Printer"
    Write-Host "5. Back to Main Menu"

    $assetChoice = Read-Host "Enter your choice"

    switch ($assetChoice) {
        '1' {
            # Check if the SCCM remote tool executable exists
            $sccmToolPath = "C:\Program Files (x86)\Microsoft Endpoint Manager\AdminConsole\bin\i386\CmRcViewer.exe"

            if (Test-Path $sccmToolPath) {
                try {
                    # Invoke SCCM remote tool
                    Start-Process -FilePath $sccmToolPath $computerName -Wait
                    Write-Host "Remote Desktop launched for $computerName"
                } catch {
                    Write-Host "Error launching SCCM Remote Tool: $_" -ForegroundColor Red
                }
            } else {
                Write-Host "SCCM Remote Tool not found at $sccmToolPath" -ForegroundColor Red
            }
        }
        '2' {
            # Launch Remote Assistance tool
            # Add your Remote Assistance tool invocation command here
            Write-Host "Launching Remote Assistance for $computerName"
        }
        '3' {
            # Clear browser data
            # Add your browser data clearing command here
            Write-Host "Clearing Browser Data for $computerName"
        }
        '4' {
            # Add network printer
            $printServer = Read-Host "Enter Print Server Name"
            $printerName = Read-Host "Enter Printer Name"
            Add-NetworkPrinter -printServer $printServer -printerName $printerName
        }
        '5' {
            # Back to main menu
            return
        }
        default {
            Write-Host "Invalid choice. Please enter a valid option."
        }
    }
}

}

# Function to invoke SCCM remote tool
function Invoke-SCCMRemoteTool {
    param (
        [string]$computerName
    )

    # Check if the SCCM remote tool executable exists
    $sccmToolPath = "C:\Program Files (x86)\Microsoft Endpoint Manager\AdminConsole\bin\i386CmRcViewer.exe"

    if (Test-Path $sccmToolPath) {
        try {
            
            # Add a line break or additional Write-Host statements for space
            Write-Host "`n"  # This adds a line break

            # Invoke SCCM remote tool
            Start-Process -FilePath $sccmToolPath -ArgumentList "/server:$computerName" -Wait
            Write-Host "Launched SCCM Remote Tool for $computerName"
        } catch {
            Write-Host "Error launching SCCM Remote Tool: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "SCCM Remote Tool not found at $sccmToolPath" -ForegroundColor Red
    }
}

# Function to add a network printer
function Add-NetworkPrinter {
    param (
        [string]$printServer,
        [string]$printerName
    )

    try {
        # Add the network printer using the Add-Printer cmdlet
        Add-Printer -ConnectionName "\\$printServer\$printerName"

        Write-Host "Network printer '$printerName' added successfully from print server '$printServer'" -ForegroundColor Green
    } catch {
        Write-Host "Error adding network printer: $_" -ForegroundColor Red
    }
}

# Main loop
while ($true) {
    # Get User ID before entering the main menu
    $userId = Get-UserId

    # Initialize $logFilePath inside the main loop
    $logFilePath = "\\hssserver037\login-tracking\$userId.log"

    # Loop for the main menu
    while ($true) {
        # Get AD properties for the provided User ID
        $adUser = Get-ADUserProperties -userId $userId

        # Display AD properties above the menu
        Show-ADUserProperties -adUser $adUser

        # Add a line break or additional Write-Host statements for space
        Write-Host "`n"  # This adds a line break

        # Display last 10 log entries
        Show-LastLogEntries -logFilePath $logFilePath

        # Add a line break or additional Write-Host statements for space
        Write-Host "`n"  # This adds a line break

        # Main menu loop
        Write-Host "1. Clear and Restart Script"
        Write-Host "2. Unlock AD Account on All Domain Controllers"
        Write-Host "3. Password Reset"
        Write-Host "4. Asset Control"
        Write-Host "5. Quit"

        $choice = Read-Host "Enter your choice"

        switch ($choice) {
            '1' {
                # Clear the console, reset User ID, and restart the script
                $userId = $null
                Clear-Host
                $userId = Get-UserId
                # Reset log file path
                $logFilePath = "\\hssserver037\login-tracking\$userId.log"
                break
            }
            '2' {
                # Unlock AD account on all domain controllers
                Unlock-ADAccountOnReachableDomainControllers -userId $userId
                Write-Host "Press Enter to continue"
                Read-Host
            }
            '3' {
                # Prompt for setting a temporary or permanent password
                $passwordChoice = Read-Host "Do you want to set a temporary (T) or permanent (P) password? Enter T or P"

                switch ($passwordChoice) {
                    'T' {
                        # Set Temporary Password based on the season and year
                        $currentMonth = (Get-Date).Month
                        $season = switch ($currentMonth) {
                            { $_ -in 3..5 } { 'Spring' }
                            { $_ -in 6..8 } { 'Summer' }
                            { $_ -in 9..11 } { 'Fall' }
                            { $_ -in 1, 2, 12 } { 'Winter' }
                        }

                        $temporaryPassword = "$season$(Get-Date -UFormat '%Y')"
                        Write-Host "Setting Temporary Password for User ID: $userId to $temporaryPassword (User Must Change)"
                        try {
                            Set-ADAccountPassword -Identity $userId -Reset -NewPassword (ConvertTo-SecureString -AsPlainText $temporaryPassword -Force) -ErrorAction Stop
                            Set-ADUser -Identity $userId -ChangePasswordAtLogon $true -ErrorAction Stop
                            Write-Host "Temporary password set to $temporaryPassword. User must change the password at the next login."
                        } catch {
                            Write-Host "Error: $_"
                        }
                        Write-Host "Press Enter to continue"
                        Read-Host
                        break
                    }
                    'P' {
                        # Prompt for a permanent password
                        $permanentPassword = Read-Host "Enter the permanent password for User ID: $userId"
                        Write-Host "Setting Permanent Password for User ID: $userId"
                        try {
                            Set-ADAccountPassword -Identity $userId -NewPassword (ConvertTo-SecureString -AsPlainText $permanentPassword -Force) -ErrorAction Stop
                            Set-ADUser -Identity $userId -ChangePasswordAtLogon $false -ErrorAction Stop
                            Write-Host "Permanent password set for User ID: $userId"
                        } catch {
                            Write-Host "Error: $_"
                        }
                        Write-Host "Press Enter to continue"
                        Read-Host
                        break
                    }
                    default {
                        Write-Host "Invalid choice. Please enter either T or P."
                        break
                    }
                }
}
            '4' {
                # Asset Control submenu
                Asset-Control -userId $userId
            }
            '5' {
                # Quit the script
                return
            }
        }
    }
}
