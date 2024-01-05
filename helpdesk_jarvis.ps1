# Import required modules
Import-Module ActiveDirectory

# Get the current domain
$currentDomain = (Get-ADDomain).DNSRoot
Write-Host "Current domain: $currentDomain"

## Get the current user with specific properties
$AdminUser = Get-ADUser -Identity $env:USERNAME -Properties SamAccountName, Name, HomeDirectory

# Check for Helpdesk-work folder and create if it doesn't exist
$helpdeskWorkFolder = Join-Path -Path $AdminUser.HomeDirectory -ChildPath "Helpdesk-work"
if (!(Test-Path -Path $helpdeskWorkFolder -PathType Container)) {
    New-Item -Path $helpdeskWorkFolder -ItemType Directory > $null
}
# Function to get User ID with error handling
function Get-UserId {
    while ($true) {
        $userId = (Read-Host "Enter User ID").Replace(' ', '')
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

    $dcList = Get-ADDomainController -Filter *
    
    $jobs = foreach ($targetDC in $dcList.Name) {
        Start-Job -ScriptBlock {
            param ($userId, $targetDC)
            $error.Clear()
            Unlock-ADAccount -Identity $userId -Server $targetDC -ErrorAction SilentlyContinue -ErrorVariable unlockError
            if ($unlockError) {
                # Handle the error here. For example, you could write it to a log file.
               # Write-Host ("Error unlocking in " + $targetDC) -BackgroundColor DarkRed
            } else {
                Write-Host ("Unlocked in " + $targetDC) -BackgroundColor DarkGreen
            }
        } -ArgumentList $userId, $targetDC
    }

    # Wait for all jobs to complete
    $jobs | Wait-Job | Out-Null

    # Receive and remove completed jobs without displaying job information
    $jobs | ForEach-Object {
        Receive-Job -Job $_ | Out-Null
        Remove-Job -Job $_ | Out-Null
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
            $lastBootUpTime = Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $computerName | Select-Object -ExpandProperty LastBootUpTime
            # Calculate the uptime
            $uptime = (Get-Date) - $lastBootUpTime

            # Display LastBootUpTime with color coding
            Write-Host "Last Boot Up Time: $lastBootUpTime"

            # Color coding for computer uptime
            if ($uptime.TotalDays -gt 5) {
                Write-Host "Uptime: More than 5 days" -ForegroundColor Red
            } elseif ($uptime.TotalDays -gt 3) {
                Write-Host "Uptime: More than 3 days" -ForegroundColor Yellow
            } else {
                Write-Host "Uptime: Less than or equal to 3 days" -ForegroundColor Green
            }
        } catch {
            if ($_.Exception.Message -like "*WinRM cannot complete the operation*") {
                Write-Host "Error: Unable to connect to the computer. Please check the computer name, network connection, and firewall settings."
            } else {
                Write-Host "Error occurred while getting LastBootUpTime: $_"
            }
            return
        }
    }
    } else {
        Write-Host "Computer not found: $computerName" -ForegroundColor Red
        return
    }
    } catch {
        Write-Host "Error retrieving computer properties: $_" -ForegroundColor Red
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
                        Start-Process -FilePath $msraPath -ArgumentList "/offerRA $computerName" -Wait
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
    param (
        [string]$userId
    )

    while ($true) {
        # If the restart flag is set, perform the '0' action and restart the loop
        if ($global:restartScript) {
            $userId = $null
            Clear-Host
            $global:restartScript = $false
            continue
        }
        # Get AD properties for the provided User ID
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
                # Clear the console, reset User ID, and restart the script
                $userId = $null
                Clear-Host
                return
            }
            '1' {
                # Unlock AD account on all domain controllers
                Unlock-ADAccountOnAllDomainControllers -userId $userId
            }
            '2' {
                # Prompt for setting a temporary or permanent password
                $passwordChoice = Read-Host "Do you want to set a temporary (T), permanent (P), or cancel (C) password? Enter T, P, or C"
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
            }
        }
    }
}

# Main loop
while ($true) {
    # Get User ID before entering the main menu
    $userId = Get-UserId

    # Initialize $logFilePath inside the main loop
    $logFilePath = "\\hssserver037\login-tracking\$userId.log"

    # Call the main loop function
    Main-Loop -userId $userId
}



