<#
.SYNOPSIS
    Remote desktop and assistance functions for Asset Control
.DESCRIPTION
    Provides functions to launch remote desktop connections and assistance tools
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: SCCM Remote Tools, Windows Remote Assistance
#>

<#
.SYNOPSIS
    Launch SCCM remote desktop connection to target computer
.DESCRIPTION
    Attempts to launch SCCM remote desktop viewer using multiple possible installation paths
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to connect to
.EXAMPLE
    Start-RemoteDesktop -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Requires SCCM Remote Tools to be installed on the local machine
#>
function Start-RemoteDesktop {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Starting remote desktop for computer: $computerName (requested by: $userId)"

    # Define possible SCCM remote tool paths
    $sccmToolPaths = @(
        "C:\Program Files (x86)\Microsoft Endpoint Manager\AdminConsole\bin\i386\CmRcViewer.exe",
        "C:\Program Files\RcViewer\CmRcViewer.exe",
        "C:\Program Files (x86)\Microsoft Configuration Manager\AdminConsole\bin\i386\CmRcViewer.exe",
        "C:\Program Files\Microsoft Configuration Manager\AdminConsole\bin\i386\CmRcViewer.exe"
    )

    Write-Host "Launching SCCM Remote Desktop for '$computerName'..." -ForegroundColor Cyan

    # Try each possible path
    foreach ($toolPath in $sccmToolPaths) {
        Write-Debug "Checking path: $toolPath"
        
        if (Test-Path $toolPath) {
            Write-Host "Found SCCM Remote Tool at: $toolPath" -ForegroundColor Green
            
            try {
                # Launch SCCM remote desktop viewer
                Write-Debug "Launching: $toolPath $computerName"
                Start-Process -FilePath $toolPath -ArgumentList $computerName -ErrorAction Stop
                
                Write-Host "SCCM Remote Desktop launched successfully for '$computerName'" -ForegroundColor Green
                
                # Log the remote desktop session if logging is enabled
                if ($script:logFilePath) {
                    $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId started remote desktop session to $computerName"
                    Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
                }
                
                return
            } catch {
                Write-Host "Error launching SCCM Remote Tool: $($_.Exception.Message)" -ForegroundColor Red
                Write-Debug "Exception launching SCCM tool: $($_.Exception)"
            }
        }
    }

    # If no SCCM tool found, provide alternatives
    Write-Host "SCCM Remote Tool not found at any expected location." -ForegroundColor Yellow
    Write-Host "`nAlternative options:" -ForegroundColor Cyan
    Write-Host "1. Use mstsc (Windows Remote Desktop):" -ForegroundColor White
    Write-Host "   mstsc /v:$computerName" -ForegroundColor Gray
    Write-Host "2. Install SCCM Remote Tools" -ForegroundColor White
    Write-Host "3. Use Remote Assistance (option 3 in menu)" -ForegroundColor White
    
    # Offer to launch standard Remote Desktop
    $useRDP = Read-Host "`nWould you like to launch standard Remote Desktop instead? (y/n)"
    if ($useRDP -eq 'y' -or $useRDP -eq 'Y') {
        try {
            Start-Process -FilePath "mstsc" -ArgumentList "/v:$computerName" -ErrorAction Stop
            Write-Host "Remote Desktop Connection launched for '$computerName'" -ForegroundColor Green
        } catch {
            Write-Host "Error launching Remote Desktop: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Launch Windows Remote Assistance for target computer
.DESCRIPTION
    Starts Windows Remote Assistance tool to offer help to remote computer
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to offer assistance to
.EXAMPLE
    Start-RemoteAssistance -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Requires Windows Remote Assistance to be enabled on both computers
#>
function Start-RemoteAssistance {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Starting remote assistance for computer: $computerName (requested by: $userId)"

    $msraPath = "C:\Windows\System32\msra.exe"
    
    Write-Host "Launching Windows Remote Assistance for '$computerName'..." -ForegroundColor Cyan

    if (Test-Path $msraPath) {
        try {
            # Launch Remote Assistance tool with offer RA parameter
            Write-Debug "Launching: $msraPath /offerRA $computerName"
            Start-Process -FilePath $msraPath -ArgumentList "/offerRA $computerName" -ErrorAction Stop
            
            Write-Host "Windows Remote Assistance launched successfully for '$computerName'" -ForegroundColor Green
            Write-Host "`nNote: The remote computer must accept the assistance request." -ForegroundColor Yellow
            
            # Log the remote assistance session if logging is enabled
            if ($script:logFilePath) {
                $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId offered remote assistance to $computerName"
                Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
            }
            
        } catch {
            Write-Host "Error launching Windows Remote Assistance: $($_.Exception.Message)" -ForegroundColor Red
            Write-Debug "Exception launching Remote Assistance: $($_.Exception)"
        }
    } else {
        Write-Host "Windows Remote Assistance not found at expected location: $msraPath" -ForegroundColor Red
        Write-Host "`nRemote Assistance may not be available on this system." -ForegroundColor Yellow
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Enable Remote Desktop on target computer
.DESCRIPTION
    Configures registry settings and firewall rules to enable RDP on remote computer
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to enable RDP on
.EXAMPLE
    Enable-RemoteDesktop -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Requires PsExec and administrative privileges on target computer
#>
function Enable-RemoteDesktop {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Enabling Remote Desktop on computer: $computerName (requested by: $userId)"

    Write-Host "Enabling Remote Desktop on '$computerName'..." -ForegroundColor Cyan
    Write-Host "This will:" -ForegroundColor Yellow
    Write-Host "- Enable RDP in registry" -ForegroundColor Gray
    Write-Host "- Configure firewall rules" -ForegroundColor Gray
    Write-Host "- Recommend computer restart" -ForegroundColor Gray

    # Confirm action
    $confirm = Read-Host "`nProceed with RDP enablement? (y/n)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "RDP enablement cancelled." -ForegroundColor Yellow
        return
    }

    try {
        # Define registry and firewall commands
        $registryCommand = 'reg add "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f'
        $firewallCommand = 'netsh advfirewall firewall set rule group="remote desktop" new enable=yes'
        
        Write-Host "`nExecuting commands on '$computerName'..." -ForegroundColor Cyan
        
        # Execute registry command
        Write-Host "1. Enabling RDP in registry..." -ForegroundColor Yellow
        $regResult = Start-Process -FilePath "cmd.exe" -ArgumentList "/c psexec.exe \\$computerName $registryCommand" -Wait -PassThru -ErrorAction Stop
        
        if ($regResult.ExitCode -eq 0) {
            Write-Host "   Registry update: SUCCESS" -ForegroundColor Green
        } else {
            Write-Host "   Registry update: FAILED (Exit code: $($regResult.ExitCode))" -ForegroundColor Red
        }
        
        # Execute firewall command  
        Write-Host "2. Configuring firewall rules..." -ForegroundColor Yellow
        $fwResult = Start-Process -FilePath "cmd.exe" -ArgumentList "/c psexec.exe \\$computerName $firewallCommand" -Wait -PassThru -ErrorAction Stop
        
        if ($fwResult.ExitCode -eq 0) {
            Write-Host "   Firewall configuration: SUCCESS" -ForegroundColor Green
        } else {
            Write-Host "   Firewall configuration: FAILED (Exit code: $($fwResult.ExitCode))" -ForegroundColor Red
        }
        
        Write-Host "`nRDP enablement completed." -ForegroundColor Green
        Write-Host "IMPORTANT: Computer should be restarted for changes to take full effect." -ForegroundColor Yellow
        
        # Offer to restart computer
        $restart = Read-Host "Would you like to schedule a restart? (y/n)"
        if ($restart -eq 'y' -or $restart -eq 'Y') {
            Start-ScheduledRestart -userId $userId -computerName $computerName
        }
        
        # Log the RDP enablement if logging is enabled
        if ($script:logFilePath) {
            $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId enabled RDP on $computerName"
            Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
        }
        
    } catch {
        Write-Host "Error enabling Remote Desktop: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception enabling RDP: $($_.Exception)"
        
        Write-Host "`nTroubleshooting tips:" -ForegroundColor Yellow
        Write-Host "- Ensure PsExec is in system PATH" -ForegroundColor Gray
        Write-Host "- Verify administrative access to target computer" -ForegroundColor Gray
        Write-Host "- Check if target computer is accessible" -ForegroundColor Gray
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Schedule a restart for remote computer (helper function)
.DESCRIPTION
    Schedules a system restart with user-defined delay and abort option
.PARAMETER userId
    The user ID for context
.PARAMETER computerName
    Name of the computer to restart
#>
function Start-ScheduledRestart {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    $minutes = Read-Host "Enter minutes before restart (e.g., 5)"
    
    if (![int]::TryParse($minutes, [ref]$null)) {
        Write-Host "Invalid input. Restart not scheduled." -ForegroundColor Red
        return
    }

    try {
        $seconds = [int]$minutes * 60
        $restartTime = (Get-Date).AddMinutes([int]$minutes)
        
        # Schedule the restart
        shutdown.exe /m \\$computerName /r /t $seconds /d p:4:1 /c "RDP enablement restart scheduled by $userId"
        
        Write-Host "Restart scheduled for $computerName at $($restartTime.ToString('HH:mm:ss'))" -ForegroundColor Green
        
        # Offer abort option
        $abort = Read-Host "Press 'a' to abort the restart, or Enter to continue"
        if ($abort -eq 'a' -or $abort -eq 'A') {
            shutdown.exe /m \\$computerName /a
            Write-Host "Restart aborted for $computerName" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "Error scheduling restart: $($_.Exception.Message)" -ForegroundColor Red
    }
}

<#
.SYNOPSIS
    Launch Windows Remote Assistance for target computer
.DESCRIPTION
    Starts the Windows Remote Assistance tool to offer assistance to the target computer
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to provide assistance to
.EXAMPLE
    Start-RemoteAssistance -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Requires Windows Remote Assistance to be enabled on target computer
#>
function Start-RemoteAssistance {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Starting Remote Assistance for computer: $computerName (requested by: $userId)"

    # Path to Remote Assistance executable
    $msraPath = "C:\Windows\System32\msra.exe"

    Write-Host "Launching Windows Remote Assistance for '$computerName'..." -ForegroundColor Cyan

    if (Test-Path $msraPath) {
        try {
            # Launch Remote Assistance tool with offer remote assistance parameter
            Write-Debug "Launching Remote Assistance: $msraPath /offerRA $computerName"
            Start-Process -FilePath $msraPath -ArgumentList "/offerRA $computerName"
            
            Write-Host "Remote Assistance launched successfully for '$computerName'" -ForegroundColor Green
            Write-Host "The Remote Assistance window should now be open" -ForegroundColor Gray
            
        } catch {
            Write-Host "Error launching Remote Assistance: $($_.Exception.Message)" -ForegroundColor Red
            Write-Debug "Exception details: $($_.Exception)"
        }
    } else {
        Write-Host "Remote Assistance tool not found at: $msraPath" -ForegroundColor Red
        Write-Host "Please verify Windows Remote Assistance is installed" -ForegroundColor Yellow
    }

    Read-Host "Press Enter to continue"
}