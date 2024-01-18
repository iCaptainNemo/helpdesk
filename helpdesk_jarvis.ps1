$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf
Set-ExecutionPolicy -ExecutionPolicy Undefined -Scope CurrentUser

Clear-Host
# Import required modules
Import-Module ActiveDirectory

# Get the current domain
$currentDomain = (Get-ADDomain).DNSRoot
Write-Host "Current domain: $currentDomain"

# Get the current user with specific properties
$AdminUser = Get-ADUser -Identity $env:USERNAME -Properties SamAccountName, Name

# Initialize $envVars hashtable
$envVars = @{}

# Function to set $tempPassword
function Set-TempPassword {
    do {
        $userInput = Read-Host "The temp password is not set. Enter one to use or press enter to use the default"
        if ($userInput) {
            $tempPassword = $userInput
        } else {
            # Set Temporary Password based on the season and year
            $currentMonth = (Get-Date).Month
            $season = switch ($currentMonth) {
                { $_ -in 3..5 } { 'Spring' }
                { $_ -in 6..8 } { 'Summer' }
                { $_ -in 9..11 } { 'Fall' }
                { $_ -in 1, 2, 12 } { 'Winter' }
            }
            $tempPassword = "$season$(Get-Date -UFormat '%Y')"
        }
        $confirm = Read-Host "You entered '$tempPassword'. Is this correct? (press enter for yes, n for no)"
    } while ($confirm -eq 'n')

    # Update the tempPassword in the $envVars hashtable
    $envVars['tempPassword'] = $tempPassword

    # Convert the updated hashtable to a list of strings
    $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })
    # Write the updated environmental variables to the $AdminConfig file
    Set-Content -Path $AdminConfig -Value ($envVarsList -join "`n")

    return $tempPassword
}

# Check if the .env_$AdminConfig.ps1 file exists
$AdminConfig = ".\.env_$($AdminUser.SamAccountName).ps1"
if (Test-Path $AdminConfig) {
    Write-Host "Admin config file exists. Importing."
    . $AdminConfig

    # Check if 'tempPassword' key in $envVars is null
    if ($null -eq $envVars['tempPassword']) {
        $envVars['tempPassword'] = Set-TempPassword
        # Convert the updated hashtable to a list of strings
        $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })
        # Write the updated environmental variables to the $AdminConfig file
        Set-Content -Path $AdminConfig -Value $envVarsList
    }
} else {
    Write-Host "Admin Config does not exist. Creating."
    New-Item -Path $AdminConfig -ItemType File | Out-Null

    # Set 'tempPassword' key in $envVars
    $envVars = @{
        tempPassword = Set-TempPassword
        UserID = $null
    }
    # Convert the hashtable to a list of strings
    $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })
    # Write the environmental variables to the $AdminConfig file
    Set-Content -Path $AdminConfig -Value $envVarsList
}

# Create a hashtable to store the environmental variables
$envVars = @{
    tempPassword = $envVars['tempPassword']
    UserID = $null
}
Write-Host "Admin User: $($AdminUser.SamAccountName)"
Write-Host "Temp Password: $($envVars['tempPassword'])"

# Function to set the UserID in the $AdminConfig file to an empty string
function Remove-UserId {
    param (
        [string]$AdminConfig
    )

    # Set 'UserID' key in $envVars to null
    $envVars['UserID'] = $null

    # Convert the updated hashtable to a list of strings
    $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })

    # Write the updated environmental variables to the $AdminConfig file
    Set-Content -Path $AdminConfig -Value ($envVarsList -join "`n")
}

# Function to test domain controllers for ADWS service
function Test-DomainControllers {
    # Check if env.ps1 file already exists
    if (Test-Path ".\env_$currentDomain.ps1") {
        Write-Host "env_$currentDomain.ps1 file already exists. continuing."
        return
    }

    # Get all domain controllers
    $domainControllers = Get-ADDomainController -Filter *

    # Initialize variables
    $cmdDomains = @()
    $PSDomains = @()

    foreach ($dc in $domainControllers) {
        # Get the hostname of the domain controller
        $hostname = $dc.HostName

        # Test the connection to the ADWS service
        $testResult = Test-NetConnection -ComputerName $hostname -Port 9389 -ErrorAction SilentlyContinue

        if ($testResult.TcpTestSucceeded) {
            $PSDomains += $hostname
        } else {
            $cmdDomains += $hostname
        }
    }

    # Export variables to env.ps1 file
    $exportScript = @"
    `$PSDomains = @('{0}')
    `$cmdDomains = @('{1}')
"@ -f ($PSDomains -join "', '"), ($cmdDomains -join "', '")

    $exportScript | Out-File -FilePath ".\env_$currentDomain.ps1"
}
# Call the function to create the env.ps1 file
if (-not (Test-Path ".\env_$currentDomain.ps1")) {
    Test-DomainControllers
}

# Import variables from env.ps1 file
. .\env_$currentDomain.ps1

# Function to get User ID with error handling
function Get-UserId {
    if ($null -eq $envVars['UserID']) {
        while ($true) {
            $UserID = (Read-Host "Enter User ID").Replace(' ', '')
            try {
                Get-ADUser -Identity $UserID -ErrorAction Stop | Out-Null
                $envVars['UserID'] = $UserID
                # Convert the updated hashtable to a list of strings
                $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })
                # Write the updated environmental variables to the $AdminConfig file
                Set-Content -Path $AdminConfig -Value ($envVarsList -join "`n")
                return $UserID
            } catch {
                #Clear-Host
                Write-Host "Cannot find an object with the given identity. Try again."
            }
        }
    } else {
        return $envVars['UserID']
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
        # Color coding for Password Last Set age
        $passwordLastSet = $adUser.PasswordLastSet
        if ($null -ne $passwordLastSet) {
            $daysSinceLastSet = (Get-Date) - $passwordLastSet
            $passwordAge = [math]::Round($daysSinceLastSet.TotalDays)
    
            if ($passwordAge -le 14) {
                Write-Host "Password Last Set: $($passwordLastSet.ToString('yyyy-MM-dd HH:mm:ss')) ($passwordAge days old)" -ForegroundColor Green
            } elseif ($passwordAge -gt 46) {
                Write-Host "Password Last Set: $($passwordLastSet.ToString('yyyy-MM-dd HH:mm:ss')) ($passwordAge days old)" -ForegroundColor Red
            } else {
                Write-Host "Password Last Set: $($passwordLastSet.ToString('yyyy-MM-dd HH:mm:ss')) ($passwordAge days old)" -ForegroundColor Yellow
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

        # Color coding for Disabled
        $disabled = $adUser.Enabled -eq $false
        if ($disabled) {
            Write-Host "Disabled: True" -ForegroundColor Red
        } else {
            Write-Host "Disabled: False" -ForegroundColor Green
        }
    }
}
# Function to display last 10 log entries with parsed information
function Show-LastLogEntries {
    param (
        [string]$logFilePath
    )

    # Function to parse log entry
    function Parse-LogEntry {
        param (
            [string]$logEntry
        )

        # Assuming $logEntry has the format "TAD062DT379527 Tue 12/19/2023 14:49:26.98"
        $components = $logEntry -split ' '
        $PossibleComputerName = $components[0]
        $day = $components[1]
        $date = $components[2]
        $time = $components[3]

        # Return parsed information
        return @{
            PossibleComputerName = $PossibleComputerName
            Day = $day
            Date = $date
            Time = $time
        }
    }

    # Initialize $possibleComputers and $logTable as empty arrays
    $possibleComputers = @()
    $logTable = @()

    try {
        # Check if the log file exists
        if (Test-Path $logFilePath -PathType Leaf) {
            $logEntries = Get-Content $logFilePath -Tail 10
            Write-Host "Last 10 login entries with parsed information:"
            # Add a line break or additional Write-Host statements for space
            Write-Host "`n"
            foreach ($entry in $logEntries) {
                $parsedInfo = Parse-LogEntry -logEntry $entry
                # Add the PossibleComputerName to the $possibleComputers array
                $possibleComputers += $parsedInfo.PossibleComputerName
                # Add the log entry to the $logTable array
                $logTable += "$($parsedInfo.PossibleComputerName) $($parsedInfo.Day) $($parsedInfo.Date) $($parsedInfo.Time)"
            }
        } else {
            Write-Host " No computer logs found" -ForegroundColor Yellow
        }
    } catch {
        # Write-Host "Error: $_" -ForegroundColor Red
        Write-Host "No computer logs found" -ForegroundColor Yellow
    }
    # Return $possibleComputers and $logTable
    return @{
        PossibleComputers = $possibleComputers
        LogTable = $logTable
    }
}
# Function to unlock AD account on all domain controllers
function Unlock-ADAccountOnAllDomainControllers {
    param (
        [string]$userId
    )

    $dcList = $PSDomains + $cmdDomains

    $jobs = foreach ($targetDC in $dcList) {
        Start-Job -ScriptBlock {
            param ($userId, $targetDC, $PSDomains, $cmdDomains)
            $error.Clear()
            if ($targetDC -in $PSDomains) {
                Unlock-ADAccount -Identity $userId -Server $targetDC -ErrorAction SilentlyContinue -ErrorVariable unlockError
            } elseif ($targetDC -in $cmdDomains) {
                net user $userID /active:yes /Domain
            }
            if ($unlockError) {
                "Error unlocking account: $unlockError"
            } else {
                Write-Host ("Unlocked in " + $targetDC) -BackgroundColor DarkGreen
            }
        } -ArgumentList $userId, $targetDC, $PSDomains, $cmdDomains
    }

    # Receive and print job outputs as they complete
    $jobs | ForEach-Object {
        while ($_ -ne $null -and $_.State -ne 'Completed') {
            if ($_.State -eq 'Failed') {
                Write-Host "Job failed"
                break
            }
            Start-Sleep -Seconds 1
        }
        if ($_.State -eq 'Completed') {
            Receive-Job -Job $_
            Remove-Job -Job $_
        }
    }
}

# Function to test connection to an asset
function Test-AssetConnection {
    param (
        [Parameter(Mandatory=$true)]
        [string]$ComputerName
    )

    try {
        $null = Test-Connection -ComputerName $ComputerName -Count 1 -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}
# Function to perform Asset Control actions & Menu
function Asset-Control {
    param (
        [string]$userId
    )
    # Add a line break or additional Write-Host statements for space
    Write-Host "`n"  # This adds a line break

    $result = Show-LastLogEntries -logFilePath $logFilePath
    $possibleComputers = $result.PossibleComputers

    # Display possible computers as a numbered list
    Write-Host "Possible Computers:"
    for ($i = 0; $i -lt $possibleComputers.Count; $i++) {
        Write-Host "$($i + 1). $($possibleComputers[$i])"
    
    }

    # Prompt for Computer Name or number
    $input = Read-Host "Enter Computer Name or number from the list above"

        # Check if the user wants to cancel
    if ($input -eq 'C' -or $input -eq 'c') {
        Write-Host "Operation cancelled by user."
        return
    }
    # Check if the input is a number and within the range of the list
    if ($input -match '^\d+$' -and $input -le ($possibleComputers.Count - 1)) {
        $computerName = $possibleComputers[[int]$input - 1]
    } else {
        $computerName = $input
    }

    # Add a line break or additional Write-Host statements for space
    Write-Host "`n"  # This adds a line break
    # Get computer properties
    try {
        $computer = Get-ADComputer $computerName -Properties MemberOf
        if ($computer) {
            $memberOf = $computer.MemberOf -join ', '

        # Check if the required groups are present in MemberOf
        $isHSRemoteComputers = $memberOf -like '*HSRemoteComputers*'
        $isHSRemoteMFAComputers = $memberOf -like '*HSRemoteMFAComputers*'

        # Display properties in a table
        $properties = @{
            'HSRemoteComputers'      = if ($isHSRemoteComputers) { 'True' } else { 'False' }
            'HSRemoteMFAComputers'   = if ($isHSRemoteMFAComputers) { 'True' } else { 'False' }
            'Computer Reachable'     = if (Test-Connection -Count 1 -ComputerName $computerName -Quiet) { 'True' } else { 'False' }
        }

        # Color coding for properties
        $properties.GetEnumerator() | ForEach-Object {
            $propertyName = $_.Key
            $propertyValue = $_.Value

            if ($propertyValue -eq 'True') {
                Write-Host "${propertyName}: ${propertyValue}" -ForegroundColor Green
            } else {
                Write-Host "${propertyName}: ${propertyValue}" -ForegroundColor Red
            }
        }
        #Line break for space
        Write-Host "`n"

    if ($properties.'Computer Reachable' -eq 'True' -and $currentDomain -eq 'hs.gov') {
        try {
            # Get LastBootUpTime using CIM instance
            $lastBootUpTime = Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $computerName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LastBootUpTime
        
            # Check if $lastBootUpTime is not null before trying to calculate $uptime
            if ($null -ne $lastBootUpTime) {
                # Calculate the uptime
                $uptime = (Get-Date) - $lastBootUpTime
                Write-Host "Last Boot Up Time: $lastBootUpTime"
            } else {
                throw
            }
            } catch {
            $uptime = "Unable to get uptime, an error occurred"
            }
        # Color coding for computer uptime
            if ($uptime -is [TimeSpan]) {
                if ($uptime.TotalDays -gt 5) {
                    Write-Host "Uptime: More than 5 days" -ForegroundColor Red
                } elseif ($uptime.TotalDays -gt 3) {
                    Write-Host "Uptime: More than 3 days" -ForegroundColor Yellow
                } else {
                    Write-Host "Uptime: Less than or equal to 3 days" -ForegroundColor Green
                }
            } else {
                Write-Host $uptime -ForegroundColor Red
            }
        }
    } else {
        Write-Host "Computer not found: $computerName" -ForegroundColor Red
        return
    }
    } catch {
        Write-Host "Error retrieving computer properties" -ForegroundColor Red
        return
    }

    # Function to get print jobs for a specific computer
    function Get-PrintJobsForComputer {
        param (
            [string]$ComputerName
        )

        try {
            $printJobs = Get-PrintJob -ComputerName $ComputerName
            if ($printJobs) {
                Write-Host "Print Jobs on ${computerName}:"
                foreach ($job in $printJobs) {
                    Write-Host "Job ID: $($job.JobId), Document: $($job.Document), Status: $($job.JobStatus)"
                }
            } else {
                Write-Host "No print jobs found on $ComputerName."
            }
        } catch {
            Write-Host "Error getting print jobs: $_" -ForegroundColor Red
        }
    }
    # Asset Control submenu
    while ($true) {
        Write-Host "`nAsset Control Menu"
        Write-Host "1. Test Connection"
        Write-Host "2. Remote Desktop"
        Write-Host "3. Remote Assistance"
        Write-Host "4. PS Console"
        Write-Host "5. PSEXEC Console"
        Write-Host "6. Add Network Printer"
        Write-Host "7. Get Print Jobs"
        Write-Host "0. Back to Main Menu"

        $assetChoice = Read-Host "Enter your choice"

        switch ($assetChoice) {
            '1' {
                # Test connection
                if (Test-AssetConnection -ComputerName $computerName) {
                    Write-Host "Connection to $computerName successful" -ForegroundColor Green
                } else {
                    Write-Host "Connection to $computerName failed" -ForegroundColor Red
                }
                break
            }
            '2' {
                # Check if the SCCM remote tool executable exists
                $sccmToolPath = "C:\Program Files (x86)\Microsoft Endpoint Manager\AdminConsole\bin\i386\CmRcViewer.exe"
                $sccmToolPath2 = "C:\Program Files\RcViewer\CmRcViewer.exe"
    
                if (Test-Path $sccmToolPath) {
                    try {
                        # Invoke SCCM remote tool
                        Start-Process -FilePath $sccmToolPath $computerName
                        Write-Host "Remote Desktop launched for $computerName"
                    } catch {
                        Write-Host "Error launching SCCM Remote Tool: $_" -ForegroundColor Red
                    }
                } elseif (Test-Path $sccmToolPath2) {
                    try {
                        # Invoke SCCM remote tool (alternative path)
                        Start-Process -FilePath $sccmToolPath2 $computerName
                        Write-Host "Remote Desktop launched for $computerName"
                    } catch {
                        Write-Host "Error launching SCCM Remote Tool: $_" -ForegroundColor Red
                    }
                } else {
                    Write-Host "SCCM Remote Tool not found" -ForegroundColor Red
                }
                break
            }
            '3' {
                # Launch Remote Assistance tool
                $msraPath = "C:\Windows\System32\msra.exe"
                if (Test-Path $msraPath) {
                    try {
                        # Invoke Remote Assistance tool
                        Start-Process -FilePath $msraPath -ArgumentList "/offerRA $computerName"
                        Write-Host "Remote Assistance launched for $computerName"
                    } catch {
                        Write-Host "Error launching Remote Assistance tool: $_" -ForegroundColor Red
                    }
                } else {
                    Write-Host "Remote Assistance tool not found at $msraPath" -ForegroundColor Red
                }
                break
            }
            '4' {
                # Check if the current domain is part of "hs.gov"
                if ($currentDomain -notlike "*hs.gov") {
                    Write-Host "Error: This domain doesn't have WinRM enabled." -ForegroundColor Red
                    break
                }

                # Open PowerShell console session in a new window
                Start-Process powershell -ArgumentList "-NoExit -Command Enter-PSSession -ComputerName $computerName"
                break
            }
            '5' {
                # Start PsExec to open a command prompt on the remote computer
                $psexecCommand = "psexec.exe \\$computerName cmd.exe"
                Write-Host "Starting PsExec to open a command prompt on $computerName"
                
                # Execute the PsExec command
                Start-Process -FilePath "cmd.exe" -ArgumentList "/c $psexecCommand" -Wait
                
                Write-Host "PsExec command completed for $computerName"
                break
            }
            '6' {
                # Add network printer
                $printServer = Read-Host "Enter Print Server Name"
                $printerName = Read-Host "Enter Printer Name"
                Add-NetworkPrinter -PrintServer $printServer -PrinterName $printerName
                break
            }
            '7' {
            # Prompt for printer name before getting print jobs
            $printerName = Read-Host "Enter Printer Name"
            Write-Host "Getting Print Jobs for $printerName on $computerName"
            Get-PrintJobsForComputer -ComputerName $computerName
            break
            }
            '0' {
                # Back to main menu
                return
            }
            '00' {
                # Set a flag to indicate that the script should be restarted
                $global:restartScript = $true
                break
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
            Write-Host "`n"

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

# Main loop function
function Main-Loop {
    while ($true) {
        # If the restart flag is set, perform the '0' action and restart the loop
        if ($global:restartScript) {
            Remove-UserId -AdminConfig $AdminConfig
            Clear-Host
            $global:restartScript = $false
            return $null
        }

        # Clears the console
        Clear-Host

        # Get User ID before entering the main menu
        $userId = Get-UserID

        # Get AD properties for the provided User ID
        $userId = $envVars['UserID']
        $adUser = Get-ADUserProperties -userId $userId

        # Display AD properties above the menu
        Show-ADUserProperties -adUser $adUser

        # Add a line break or additional Write-Host statements for space
        Write-Host "`n"  # This adds a line break

        # Display last 10 log entries
        $result = Show-LastLogEntries -logFilePath $logFilePath
        $logTable = $result.LogTable
        $logTable | Format-List

        # Add a line break or additional Write-Host statements for space
        Write-Host "`n"  # This adds a line break

        # Main menu loop
        Write-Host "1. Unlock"
        Write-Host "2. Password Reset"
        Write-Host "3. Asset Control"
        Write-Host "0. Clear and Restart Script"

        $choice = Read-Host "Enter your choice"


        switch ($choice) {
            '0' {
                Remove-UserId -AdminConfig $AdminConfig
                Clear-Host
                return $null
            }
            '1' {
                # Unlock AD account on all domain controllers
                Unlock-ADAccountOnAllDomainControllers -userId $userId
            }
            '2' {
                $passwordChoice = Read-Host "Do you want to set temporary (T), permanent (P), or cancel (C) password? Enter T, P, or C"
                switch ($passwordChoice) {
                    'T' {
                        $temporaryPassword = Set-TempPassword
                        Write-Host "Setting Temporary Password for User ID: $userId to $temporaryPassword (User Must Change)"
                        try {
                            Set-ADAccountPassword -Identity $userId -Reset -NewPassword (ConvertTo-SecureString -AsPlainText $temporaryPassword -Force) -ErrorAction Stop
                            Set-ADUser -Identity $userId -ChangePasswordAtLogon $true -ErrorAction Stop
                            Write-Host "Temporary password set to $temporaryPassword. User must change the password at the next login."
                        } catch {
                            Write-Host "Error: $_"
                        }
                    
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
                        break
                    }
                    'C' {
                        # Cancel password change
                        Write-Host "Password change canceled."
                        break
                    }
                    default {
                        Write-Host "Invalid choice. Please enter either T, P, or C."
                        break
                    }
                }
            }

            '3' {
                # Asset Control submenu
                Asset-Control -userId $userId
        
                # Check if the script should be restarted
                if ($global:restartScript) {
                    # Assuming Remove-UserId is updated to work with hashtable
                    $envVars = Remove-UserId -envVars $envVars
                    $userId = $null
                    Clear-Host
                    $global:restartScript = $false
                    continue
                }
            }
        }
    }
}

# Main loop
while ($true) {
    # Get User ID before entering the main menu
    $envVars['UserID'] = Get-UserId

    # Initialize $logFilePath inside the main loop
    $logFilePath = "\\hssserver037\login-tracking\$($envVars['UserID']).log"

    # Call the main loop function
    Main-Loop
}