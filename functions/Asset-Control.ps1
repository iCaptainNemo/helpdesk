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