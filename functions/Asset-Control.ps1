# Function to perform Asset Control actions & Menu
function Asset-Control {
    param (
        [string]$userId
    )

    # Check $powershell boolean
    if ($powershell -eq $true) {

    # Add a line break or additional Write-Host statements for space
    Write-Host "`n"  # This adds a line break

    $result = Show-LastLogEntries -logFilePath $logFilePath
    $possibleComputers = $result.PossibleComputers

    # Remove duplicates from the $possibleComputers array
    $possibleComputers = $possibleComputers | Sort-Object | Get-Unique

    # Display possible computers as a numbered list
    if ($powershell -eq $true) { Write-Host "Possible Computers:" }
    $psLoggedOnPath = ".\Tools\PsLoggedon.exe"
    $computerStatus = @{}

    # Cast Into Array
    $possibleComputers = [array]$possibleComputers

        for ($i = 0; $i -lt $possibleComputers.Count; $i++) {
            $computerName = $possibleComputers[$i]

            # Check if the computer is part of the domain
            $computerInDomain = Get-ADComputer -Filter {Name -eq $computerName} -ErrorAction SilentlyContinue

            if ($null -eq $computerInDomain) {
                Write-Host "$($i + 1). $computerName - Not part of domain" -ForegroundColor DarkGray
                continue
            }
            # If the computer has already been checked, use the stored status
            if ($computerStatus.ContainsKey($computerName)) {
                $isUserLoggedIn = $computerStatus[$computerName]
            } else {
                # Check if the user is logged on to the computer
                try {
                    $output = & $psLoggedOnPath -l -x \\$computerName | Out-String
                    # Write-Host "Output of PsLoggedOn for ${computerName}: $output"  # Debugging line
                    $isUserLoggedIn = $output -match $userID

                    # Store the status for this computer
                    $computerStatus[$computerName] = $isUserLoggedIn
                } catch {
                    Write-Host ("Error running PsLoggedOn for " + $computerName + ": " + $_.Exception.Message) -ForegroundColor Red
                    continue
                }
            }

            if ($isUserLoggedIn) {
                Write-Host "$($i + 1). $computerName" -ForegroundColor Green
            } else {
                Write-Host "$($i + 1). $computerName"
            }
        }
    }

    # Prompt for Computer Name or number
    $input = Read-Host "Enter Computer Name or number (1-10, C to cancel):"

    # Check if the input is 'C' or 'c' to cancel
    if ($input -eq 'C' -or $input -eq 'c') {
        Write-Host "Selection cancelled."
        break
    } elseif ($input -match '^[1-9]$|^10$') {
        # If the input is a number between 1 and 10, map it to the corresponding computer
        $computerName = $possibleComputers[$input - 1]
    } else {
        # Assign $input to $computerName
        $computerName = $input
    }
    # Add a line break or additional Write-Host statements for space
    Write-Host "`n"  # This adds a line break

    # Display the selected computer
    Write-Host "Selected computer: $computerName"

    # Check if $powershell is true
    if ($powershell -eq $true) {
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
            }
        } catch {
            Write-Host "Error getting properties for $computerName $_" -ForegroundColor Red
        }
    }

    # Check powershell boolean
    # if ($powershell -eq $true) {
    #     try {
    #         # Get LastBootUpTime and calculate uptime
    #         if ($properties.'Computer Reachable' -eq 'True') {
    #             # Get LastBootUpTime using CIM instance
    #             $lastBootUpTime = Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $computerName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LastBootUpTime
            
    #             # Check if $lastBootUpTime is not null before trying to calculate $uptime
    #             if ($null -ne $lastBootUpTime) {
    #                 # Calculate the uptime
    #                 $uptime = (Get-Date) - $lastBootUpTime
    #                 $days = [math]::Round($uptime.TotalDays, 0)
    #                 Write-Host "Last Boot Up Time: $lastBootUpTime"
    #             } else {
    #                 throw "Last boot up time is null"
    #             }
                
    #             # Color coding for computer uptime
    #             if ($uptime -is [TimeSpan]) {
    #                 if ($days -gt 5) {
    #                     Write-Host "Uptime: $days days" -ForegroundColor Red
    #                 } elseif ($days -gt 3) {
    #                     Write-Host "Uptime: $days days" -ForegroundColor Yellow
    #                 } else {
    #                     Write-Host "Uptime: $days days" -ForegroundColor Green
    #                 }
    #             } else {
    #                 Write-Host $uptime -ForegroundColor Red
    #             }
    #         } else {
    #             Write-Host "Computer not found: $computerName" -ForegroundColor Red
    #             return
    #         }
    #     } catch {
    #         Write-Host "Error retrieving computer properties: $_" -ForegroundColor Red
    #         return
    #     }
    # }

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
        Write-Host "6. Re-Enable RDP"
        Write-Host "7. Group Policy Update"
        Write-Host "8. Stop Cisco AWG Service"
        Write-Host "9. Remote Logoff"
        Write-Host "10. Open File Explorer"
        Write-Host "11. Clear Browsers"
        Write-Host "12: Set default PDF application to Adobe"
        Write-Host "13: Get Uptime"
        Write-Host "66: Remote Restart"
        Write-Host "0. Back to Main Menu"

        $assetChoice = Read-Host "Enter your choice"

        switch ($assetChoice) {
            '1' {
                # Check if $powershell is true
                if ($powershell -eq $true) {
                    # Test connection using Test-Connection
                    try {
                        if (Test-Connection -ComputerName $ComputerName -Count 1 -ErrorAction Stop) {
                            Write-Host "Connection to $computerName successful" -ForegroundColor Green
                        }
                    } catch {
                        Write-Host "Connection to $computerName failed" -ForegroundColor Red
                    }
                } else {
                    # Test connection using WMI
                    try {
                        $computer = Get-WmiObject -Class Win32_ComputerSystem -ComputerName $computerName -ErrorAction Stop
                        Write-Host "Connection to $computerName successful" -ForegroundColor Green
                    } catch {
                        Write-Host "Connection to $computerName failed" -ForegroundColor Red
                    }
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
                # Open PowerShell console session in a new window
                Start-Process powershell -ArgumentList "-NoExit -Command Enter-PSSession -ComputerName $computerName"
                break
            }

            '5' {
                # Start PsExec to open a command prompt on the remote computer
                $psexecCommand = "psexec.exe \\$computerName cmd.exe"
                Write-Host "Starting PsExec to open a command prompt on $computerName"
                
                # Execute the PsExec command
                Start-Process -FilePath "cmd.exe" -ArgumentList "/c $psexecCommand"
                
                Write-Host "PsExec command completed for $computerName"
                break
            }
            '6' {
                # Re-Enable RDP Fix
                Write-Host "Re-Enabling RDP and setting firewall rules on $computerName"
            
                # Define the commands to be executed on the remote computer
                $command1 = 'reg add "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f'
                $command2 = 'netsh advfirewall firewall set rule group="remote desktop" new enable=yes'
                $command3 = 'shutdown /r /t 0'
            
                # Execute the commands on the remote computer using PsExec
                try {
                    Start-Process -FilePath "cmd.exe" -ArgumentList "/c psexec.exe \\$computerName $command1"
                    Start-Process -FilePath "cmd.exe" -ArgumentList "/c psexec.exe \\$computerName $command2"
                    Read-Host "Press Enter to continue"
                    Start-Process -FilePath "cmd.exe" -ArgumentList "/c psexec.exe \\$computerName $command3"
                    Write-Host "RDP re-enabled, firewall rules set, and computer restarted on $computerName"
                } catch {
                    Write-Host "An error occurred while re-enabling RDP, setting firewall rules, or restarting the computer: $_" -ForegroundColor Red
                }
                break
            }
            '7' {
                # Run Group Policy Update
                Write-Host "Running Group Policy Update on $computerName"
                try {
                    Start-Process powershell -ArgumentList "-NoExit -Command {Invoke-GPUpdate -Computer $computerName -Force}"
                } catch {
                    Write-Host "An error occurred while running Group Policy Update: $_"
                }
                break
            }
            '8' {
                Write-Host "Stopping Cisco AWG Service on $computername"
                Invoke-Command -ComputerName $computername -ScriptBlock {
                    Stop-Service -Name 'csc_swgagent' -Force -ErrorAction Stop
                }
            }
            '9' {
                # Get the session ID of the user with the provided userID
                $sessionId = (quser /server:$computername | Where-Object { $_ -match $userID }) -replace '.*\s+(\d+)\s+.*', '$1'
            
                # Log off the user with the provided userID
                if ($sessionId) {
                    logoff $sessionId /server:$computername
                } else {
                    Write-Host "No session ID found for user $userID on server $computername."
                }
            }
            '10' {
                # Open file explorer for the user's profile on the remote computer
                Write-Host "Opening File Explorer for $userid on $computerName"
                Invoke-Expression "explorer.exe /e,\\$computerName\c$\Users\$userid"
                break
            }
            '11' {
                # Clear Browser
                $browserChoice = Read-Host "Enter the browser to clear (IE, Chrome, Edge, All, Cancel)"
                switch ($browserChoice) {
                    'IE' {
                        Clear-BrowserCacheRemote -userID $envVars['UserID'] -computer $computerName -browser 'IE'
                    }
                    'Chrome' {
                        Clear-BrowserCacheRemote -userID $envVars['UserID'] -computer $computerName -browser 'Chrome'
                    }
                    'Edge' {
                        Clear-BrowserCacheRemote -userID $envVars['UserID'] -computer $computerName -browser 'Edge'
                    }
                    'All' {
                        Clear-BrowserCacheRemote -userID $envVars['UserID'] -computer $computerName -browser 'All'
                    }
                    'Cancel' {
                        Write-Host "Browser cache clear operation cancelled."
                        break
                    }
                    default {
                        Write-Host "Invalid choice. Please enter IE, Chrome, Edge, All, or Cancel."
                    }
                }
                break
            }
            '12' {
                try {
                    # Set default PDF application
                    $command = 'assoc .pdf=Acrobat.Document.DC && ftype Acrobat.Document.DC="C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe" "%1"'
                    $output = psexec.exe \\$computerName cmd.exe /c $command | Out-String
            
                    if ($output -match '.pdf=Acrobat.Document.DC' -and $output -match 'Acrobat.Document.DC="C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe" "%1"') {
                        # Confirmation message
                        Write-Host "Starting cmd.exe on $computerName"
                        Write-Host "Successfully set default PDF application to Adobe Acrobat on $computerName"
                    } else {
                        throw "Failed to set default PDF application on remote computer"
                    }
                } catch {
                    Write-Host "Error: $_"
                }
            }
            '13' { 
                # Get Up Time
                try {
                    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $computerName 2>$null
                    $uptime = (Get-Date) - $os.LastBootUpTime
                    $formattedUptime = "{0} days, {1} hours, {2} minutes" -f $uptime.Days, $uptime.Hours, $uptime.Minutes
                
                    if ($uptime.TotalDays -gt 5) {
                        Write-Host "Uptime: $formattedUptime" -ForegroundColor Red
                    } elseif ($uptime.TotalDays -le 1) {
                        Write-Host "Uptime: $formattedUptime" -ForegroundColor Green
                    } else {
                        Write-Host "Uptime: $formattedUptime" -ForegroundColor Yellow
                    }
                } catch {
                    Write-Output "Failed to get uptime using PowerShell. Switching to psexec..."
                    $output = psexec \\$computerName cmd /c "systeminfo | find \"System Boot Time:\"" 2>$null
                    Write-Output "Uptime: $output"
                }
            }   
            '66' {
                $minutes = Read-Host "Please enter the number of minutes before restart"
                if (![int]::TryParse($minutes, [ref]0)) {
                    Write-Host "Invalid input. Please enter a number."
                } else {
                    $time = (Get-Date).AddMinutes($minutes)
                    shutdown.exe /m \\$computer /r /t ($minutes * 60) /d p:4:1 /c "Scheduled restart"
                    Write-Host "Scheduled a restart on $computer at $time"
                }
            }
            '0' {
                # Back to main menu
                $computerStatus.Clear()
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
        pause
    }
}
