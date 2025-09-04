<#
.SYNOPSIS
    System management functions for Asset Control
.DESCRIPTION
    Provides functions for system-level operations like restarts, uptime monitoring, and service management
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: Administrative privileges on target systems
#>

<#
.SYNOPSIS
    Get system uptime for target computer
.DESCRIPTION
    Retrieves and displays system uptime with color-coded status indicators
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to get uptime for
.EXAMPLE
    Get-ComputerUptime -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Uses CIM/WMI to retrieve last boot time
#>
function Get-ComputerUptime {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Getting uptime for computer: $computerName (requested by: $userId)"

    Write-Host "Retrieving uptime for '$computerName'..." -ForegroundColor Cyan

    try {
        # Try CIM first (newer method)
        Write-Debug "Attempting CIM query for uptime"
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $computerName -ErrorAction Stop
        $uptime = (Get-Date) - $os.LastBootUpTime
        $method = "CIM"
    }
    catch {
        Write-Debug "CIM failed, trying WMI: $($_.Exception.Message)"
        try {
            # Fallback to WMI
            $os = Get-WmiObject -Class Win32_OperatingSystem -ComputerName $computerName -ErrorAction Stop
            $bootTime = $os.ConvertToDateTime($os.LastBootUpTime)
            $uptime = (Get-Date) - $bootTime
            $method = "WMI"
        }
        catch {
            Write-Debug "WMI also failed, trying psexec: $($_.Exception.Message)"
            try {
                # Last resort: psexec with systeminfo
                Write-Host "Using alternative method (this may take longer)..." -ForegroundColor Yellow
                $output = psexec \\$computerName cmd /c "systeminfo | find `"System Boot Time:`"" 2>$null
                if ($output -match "System Boot Time:\s+(.+)") {
                    $bootTimeStr = $matches[1].Trim()
                    $bootTime = [DateTime]::Parse($bootTimeStr)
                    $uptime = (Get-Date) - $bootTime
                    $method = "PsExec"
                } else {
                    throw "Could not parse systeminfo output"
                }
            }
            catch {
                Write-Host "Failed to retrieve uptime using all available methods" -ForegroundColor Red
                Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
                Read-Host "Press Enter to continue"
                return
            }
        }
    }

    # Format uptime display
    $formattedUptime = "{0} days, {1} hours, {2} minutes" -f $uptime.Days, $uptime.Hours, $uptime.Minutes
    
    # Determine status color based on uptime
    $statusColor = "White"
    $status = "Normal"
    
    if ($uptime.TotalDays -gt 30) {
        $statusColor = "Red"
        $status = "CRITICAL - Very long uptime"
    } elseif ($uptime.TotalDays -gt 14) {
        $statusColor = "Red" 
        $status = "HIGH - Long uptime, restart recommended"
    } elseif ($uptime.TotalDays -gt 7) {
        $statusColor = "Yellow"
        $status = "MEDIUM - Consider restart soon"
    } elseif ($uptime.TotalDays -le 1) {
        $statusColor = "Green"
        $status = "GOOD - Recently restarted"
    } else {
        $statusColor = "White"
        $status = "Normal"
    }

    # Display results
    Write-Host "`nUptime Information for '$computerName':" -ForegroundColor Cyan
    Write-Host "=" * 50 -ForegroundColor Gray
    Write-Host "Boot Time: $($os.LastBootUpTime)" -ForegroundColor White
    Write-Host "Uptime: $formattedUptime" -ForegroundColor $statusColor
    Write-Host "Status: $status" -ForegroundColor $statusColor
    Write-Host "Query Method: $method" -ForegroundColor Gray
    Write-Host "=" * 50 -ForegroundColor Gray

    # Provide recommendations based on uptime
    if ($uptime.TotalDays -gt 7) {
        Write-Host "`nRecommendation:" -ForegroundColor Yellow
        Write-Host "Consider scheduling a restart to:" -ForegroundColor Gray
        Write-Host "- Apply pending Windows updates" -ForegroundColor Gray
        Write-Host "- Clear memory leaks" -ForegroundColor Gray
        Write-Host "- Refresh system performance" -ForegroundColor Gray
        
        $scheduleRestart = Read-Host "`nWould you like to schedule a restart? (y/n)"
        if ($scheduleRestart -eq 'y' -or $scheduleRestart -eq 'Y') {
            Restart-RemoteComputer -userId $userId -computerName $computerName
            return
        }
    }

    # Log the uptime check if logging is enabled
    if ($script:logFilePath) {
        $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId checked uptime for $computerName - $formattedUptime"
        Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Schedule a restart for remote computer
.DESCRIPTION
    Schedules a system restart with user-defined delay and abort option
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to restart
.EXAMPLE
    Restart-RemoteComputer -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Requires administrative privileges and network access to target computer
#>
function Restart-RemoteComputer {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Scheduling restart for computer: $computerName (requested by: $userId)"

    Write-Host "Scheduling restart for '$computerName'..." -ForegroundColor Cyan
    Write-Host "`nWARNING: This will restart the remote computer!" -ForegroundColor Red
    
    # Get restart delay
    $minutes = Read-Host "Enter minutes before restart (e.g., 5, 10, 15)"
    
    if (![int]::TryParse($minutes, [ref]$null)) {
        Write-Host "Invalid input. Please enter a number." -ForegroundColor Red
        Read-Host "Press Enter to continue"
        return
    }

    $minutesInt = [int]$minutes
    if ($minutesInt -lt 1 -or $minutesInt -gt 1440) {
        Write-Host "Minutes must be between 1 and 1440 (24 hours)." -ForegroundColor Red
        Read-Host "Press Enter to continue"
        return
    }

    # Get restart reason
    Write-Host "`nSelect restart reason:" -ForegroundColor Yellow
    Write-Host "1. Planned maintenance"
    Write-Host "2. Software installation"
    Write-Host "3. System updates"
    Write-Host "4. Performance issues"
    Write-Host "5. Other"
    
    $reasonChoice = Read-Host "Enter choice (1-5)"
    $reasonMap = @{
        "1" = "Planned maintenance by $userId"
        "2" = "Software installation by $userId"
        "3" = "System updates by $userId"
        "4" = "Performance optimization by $userId"
        "5" = "Administrative restart by $userId"
    }
    
    $restartReason = $reasonMap[$reasonChoice]
    if (-not $restartReason) {
        $restartReason = "Administrative restart by $userId"
    }

    try {
        $seconds = $minutesInt * 60
        $restartTime = (Get-Date).AddMinutes($minutesInt)
        
        Write-Host "`nExecuting restart command..." -ForegroundColor Yellow
        
        # Schedule the restart using shutdown command
        $shutdownArgs = "/m \\$computerName /r /t $seconds /d p:4:1 /c `"$restartReason`""
        Write-Debug "Shutdown command: shutdown.exe $shutdownArgs"
        
        $result = Start-Process -FilePath "shutdown.exe" -ArgumentList $shutdownArgs -Wait -PassThru -NoNewWindow
        
        if ($result.ExitCode -eq 0) {
            Write-Host "Restart scheduled successfully!" -ForegroundColor Green
            Write-Host "`nRestart Details:" -ForegroundColor Cyan
            Write-Host "Computer: $computerName" -ForegroundColor White
            Write-Host "Scheduled Time: $($restartTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
            Write-Host "Delay: $minutesInt minutes" -ForegroundColor White
            Write-Host "Reason: $restartReason" -ForegroundColor White
            
            # Log the restart scheduling
            if ($script:logFilePath) {
                $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId scheduled restart for $computerName at $($restartTime.ToString('yyyy-MM-dd HH:mm:ss')) - Reason: $restartReason"
                Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
            }
            
            # Offer abort option
            Write-Host "`nPress 'a' to abort the restart, or Enter to continue:" -ForegroundColor Yellow -NoNewline
            $abort = Read-Host
            
            if ($abort -eq 'a' -or $abort -eq 'A') {
                try {
                    $abortResult = Start-Process -FilePath "shutdown.exe" -ArgumentList "/m \\$computerName /a" -Wait -PassThru -NoNewWindow
                    if ($abortResult.ExitCode -eq 0) {
                        Write-Host "Restart aborted successfully for '$computerName'" -ForegroundColor Yellow
                        
                        # Log the abort
                        if ($script:logFilePath) {
                            $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId aborted scheduled restart for $computerName"
                            Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
                        }
                    } else {
                        Write-Host "Failed to abort restart (Exit code: $($abortResult.ExitCode))" -ForegroundColor Red
                    }
                } catch {
                    Write-Host "Error aborting restart: $($_.Exception.Message)" -ForegroundColor Red
                }
            } else {
                Write-Host "Restart will proceed as scheduled." -ForegroundColor Green
            }
        } else {
            Write-Host "Failed to schedule restart (Exit code: $($result.ExitCode))" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "Error scheduling restart: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception scheduling restart: $($_.Exception)"
        
        Write-Host "`nTroubleshooting suggestions:" -ForegroundColor Yellow
        Write-Host "- Verify computer is online and accessible" -ForegroundColor Gray
        Write-Host "- Ensure you have administrative privileges" -ForegroundColor Gray
        Write-Host "- Check network connectivity" -ForegroundColor Gray
        Write-Host "- Verify Windows Remote Management is enabled" -ForegroundColor Gray
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Stop Cisco AnyConnect Web Gateway service on remote computer
.DESCRIPTION
    Stops the Cisco AnyConnect service that may interfere with network operations
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to stop the service on
.EXAMPLE
    Stop-CiscoAWGService -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Requires PowerShell Remoting or alternative remote execution method
#>
function Stop-CiscoAWGService {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Stopping Cisco AWG service on computer: $computerName (requested by: $userId)"

    Write-Host "Stopping Cisco AnyConnect Web Gateway service on '$computerName'..." -ForegroundColor Cyan

    try {
        # Try PowerShell Remoting first
        Write-Debug "Attempting to stop service via PowerShell Remoting"
        
        Invoke-Command -ComputerName $computerName -ScriptBlock {
            try {
                $service = Get-Service -Name 'csc_swgagent' -ErrorAction Stop
                if ($service.Status -eq 'Running') {
                    Stop-Service -Name 'csc_swgagent' -Force -ErrorAction Stop
                    return "Service stopped successfully"
                } elseif ($service.Status -eq 'Stopped') {
                    return "Service was already stopped"
                } else {
                    return "Service is in $($service.Status) state"
                }
            } catch [Microsoft.PowerShell.Commands.ServiceCommandException] {
                return "Service 'csc_swgagent' not found on this computer"
            } catch {
                return "Error: $($_.Exception.Message)"
            }
        } -ErrorAction Stop | ForEach-Object {
            $result = $_
            if ($result -like "*successfully*") {
                Write-Host $result -ForegroundColor Green
            } elseif ($result -like "*already*") {
                Write-Host $result -ForegroundColor Yellow
            } elseif ($result -like "*not found*") {
                Write-Host $result -ForegroundColor Yellow
            } else {
                Write-Host $result -ForegroundColor Red
            }
        }
        
        # Log the service stop action
        if ($script:logFilePath) {
            $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId stopped Cisco AWG service on $computerName"
            Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
        }
        
    } catch {
        Write-Debug "PowerShell Remoting failed, trying alternative method: $($_.Exception.Message)"
        
        # Fallback to PsExec or other method
        try {
            Write-Host "PowerShell Remoting not available, trying alternative method..." -ForegroundColor Yellow
            
            $psexecCommand = "psexec \\$computerName net stop csc_swgagent"
            $result = Invoke-Expression $psexecCommand 2>&1
            
            if ($result -like "*stopped successfully*") {
                Write-Host "Cisco AWG service stopped successfully via PsExec" -ForegroundColor Green
            } elseif ($result -like "*not started*") {
                Write-Host "Cisco AWG service was not running" -ForegroundColor Yellow
            } else {
                Write-Host "PsExec result: $result" -ForegroundColor Yellow
            }
            
        } catch {
            Write-Host "Error stopping Cisco AWG service: $($_.Exception.Message)" -ForegroundColor Red
            Write-Debug "Exception stopping service: $($_.Exception)"
            
            Write-Host "`nTroubleshooting suggestions:" -ForegroundColor Yellow
            Write-Host "- Verify PowerShell Remoting is enabled on target computer" -ForegroundColor Gray
            Write-Host "- Ensure PsExec is available if remoting fails" -ForegroundColor Gray
            Write-Host "- Check administrative privileges on target computer" -ForegroundColor Gray
            Write-Host "- Verify the service name 'csc_swgagent' is correct" -ForegroundColor Gray
        }
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Get detailed system information for remote computer
.DESCRIPTION
    Retrieves comprehensive system information including hardware, OS, and performance data
.PARAMETER computerName
    Name of the computer to get system information for
.EXAMPLE
    Get-SystemInformation -computerName "COMPUTER01"
#>
function Get-SystemInformation {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Host "Gathering system information for '$computerName'..." -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Gray

    try {
        # Get basic computer system info
        $computer = Get-CimInstance -ClassName Win32_ComputerSystem -ComputerName $computerName -ErrorAction Stop
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $computerName -ErrorAction Stop
        $processor = Get-CimInstance -ClassName Win32_Processor -ComputerName $computerName -ErrorAction Stop | Select-Object -First 1
        
        # Display system information
        Write-Host "`nSystem Information:" -ForegroundColor Yellow
        Write-Host "Computer Name: $($computer.Name)" -ForegroundColor White
        Write-Host "Manufacturer: $($computer.Manufacturer)" -ForegroundColor White
        Write-Host "Model: $($computer.Model)" -ForegroundColor White
        Write-Host "Total RAM: $([math]::Round($computer.TotalPhysicalMemory/1GB, 2)) GB" -ForegroundColor White
        
        Write-Host "`nOperating System:" -ForegroundColor Yellow
        Write-Host "OS: $($os.Caption)" -ForegroundColor White
        Write-Host "Version: $($os.Version)" -ForegroundColor White
        Write-Host "Architecture: $($os.OSArchitecture)" -ForegroundColor White
        Write-Host "Install Date: $($os.InstallDate)" -ForegroundColor White
        
        Write-Host "`nProcessor:" -ForegroundColor Yellow
        Write-Host "Name: $($processor.Name)" -ForegroundColor White
        Write-Host "Cores: $($processor.NumberOfCores)" -ForegroundColor White
        Write-Host "Logical Processors: $($processor.NumberOfLogicalProcessors)" -ForegroundColor White
        
        # Get uptime
        $uptime = (Get-Date) - $os.LastBootUpTime
        $uptimeFormatted = "{0} days, {1} hours, {2} minutes" -f $uptime.Days, $uptime.Hours, $uptime.Minutes
        Write-Host "`nUptime: $uptimeFormatted" -ForegroundColor White
        
    } catch {
        Write-Host "Error retrieving system information: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host "`n" + "=" * 60 -ForegroundColor Gray
}

<#
.SYNOPSIS
    Re-enable Remote Desktop on target computer
.DESCRIPTION
    Enables RDP and configures firewall rules on the target computer
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to enable RDP on
.EXAMPLE
    Enable-RemoteDesktop -userId "jdoe" -computerName "COMPUTER01"
#>
function Enable-RemoteDesktop {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Re-enabling RDP on computer: $computerName (requested by: $userId)"
    Write-Host "Re-enabling Remote Desktop and configuring firewall on '$computerName'..." -ForegroundColor Cyan

    try {
        # Commands to execute on remote computer
        $command1 = 'reg add "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f'
        $command2 = 'netsh advfirewall firewall set rule group="remote desktop" new enable=yes'

        Write-Host "Enabling RDP registry setting..." -ForegroundColor Yellow
        $result1 = Start-Process -FilePath "cmd.exe" -ArgumentList "/c psexec.exe \\$computerName $command1" -Wait -PassThru -NoNewWindow
        
        Write-Host "Configuring firewall rules..." -ForegroundColor Yellow  
        $result2 = Start-Process -FilePath "cmd.exe" -ArgumentList "/c psexec.exe \\$computerName $command2" -Wait -PassThru -NoNewWindow

        if ($result1.ExitCode -eq 0 -and $result2.ExitCode -eq 0) {
            Write-Host "RDP successfully re-enabled on '$computerName'" -ForegroundColor Green
            Write-Host "Computer should be restarted for changes to take full effect" -ForegroundColor Yellow
        } else {
            Write-Host "Some operations may have failed. Check results above." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Error re-enabling RDP: $($_.Exception.Message)" -ForegroundColor Red
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Log off user session on remote computer
.DESCRIPTION
    Finds and logs off the specified user's session on the target computer
.PARAMETER userId
    The user ID to log off
.PARAMETER computerName
    Name of the computer to log off user from
.EXAMPLE
    Invoke-RemoteLogoff -userId "jdoe" -computerName "COMPUTER01"
#>
function Invoke-RemoteLogoff {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Logging off user $userId from computer: $computerName"
    Write-Host "Logging off user '$userId' from '$computerName'..." -ForegroundColor Cyan

    try {
        # Get the session ID of the user
        $sessionInfo = quser /server:$computerName 2>$null | Where-Object { $_ -match $userId }
        
        if ($sessionInfo) {
            # Extract session ID using regex
            $sessionId = ($sessionInfo -replace '.*\s+(\d+)\s+.*', '$1')
            
            Write-Host "Found session ID $sessionId for user '$userId'" -ForegroundColor Yellow
            
            # Log off the user
            $result = logoff $sessionId /server:$computerName
            Write-Host "User '$userId' logged off from '$computerName'" -ForegroundColor Green
        } else {
            Write-Host "No active session found for user '$userId' on '$computerName'" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Error logging off user: $($_.Exception.Message)" -ForegroundColor Red
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Schedule a restart for remote computer
.DESCRIPTION
    Schedules a restart with user-specified delay and provides abort option
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to restart
.EXAMPLE
    Restart-RemoteComputer -userId "jdoe" -computerName "COMPUTER01"
#>
function Restart-RemoteComputer {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Scheduling restart for computer: $computerName (requested by: $userId)"
    Write-Host "Scheduling restart for '$computerName'..." -ForegroundColor Cyan

    try {
        $minutes = Read-Host "Enter the number of minutes before restart"
        
        if (![int]::TryParse($minutes, [ref]0)) {
            Write-Host "Invalid input. Please enter a number." -ForegroundColor Red
            return
        }

        $time = (Get-Date).AddMinutes($minutes)
        $seconds = $minutes * 60

        # Schedule the restart
        shutdown.exe /m \\$computerName /r /t $seconds /d p:4:1 /c "Scheduled restart by $userId"
        Write-Host "Scheduled restart for '$computerName' at $($time.ToString('HH:mm:ss'))" -ForegroundColor Green

        # Offer abort option
        $abort = Read-Host "Press 'a' to abort the restart, or Enter to continue"
        if ($abort -eq 'a' -or $abort -eq 'A') {
            shutdown.exe /m \\$computerName /a
            Write-Host "Restart aborted for '$computerName'" -ForegroundColor Yellow
        } else {
            Write-Host "Restart will proceed as scheduled" -ForegroundColor Green
        }
    } catch {
        Write-Host "Error scheduling restart: $($_.Exception.Message)" -ForegroundColor Red
    }

    Read-Host "Press Enter to continue"
}