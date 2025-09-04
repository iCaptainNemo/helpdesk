<#
.SYNOPSIS
    Remote console access functions for Asset Control
.DESCRIPTION
    Provides functions to establish remote command line access via PowerShell and PsExec
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: PowerShell Remoting, PsExec
#>

<#
.SYNOPSIS
    Start PowerShell remote session to target computer
.DESCRIPTION
    Opens a new PowerShell window with remote session to the specified computer
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to connect to
.EXAMPLE
    Start-PowerShellConsole -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Requires PowerShell Remoting to be enabled on target computer
#>
function Start-PowerShellConsole {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Starting PowerShell console for computer: $computerName (requested by: $userId)"

    Write-Host "Opening PowerShell remote session to '$computerName'..." -ForegroundColor Cyan

    try {
        # Test if PowerShell Remoting is available
        Write-Host "Testing PowerShell Remoting connectivity..." -ForegroundColor Yellow
        
        $testResult = Test-WSMan -ComputerName $computerName -ErrorAction Stop
        if ($testResult) {
            Write-Host "PowerShell Remoting is available" -ForegroundColor Green
            
            # Launch new PowerShell window with remote session
            $psCommand = "Enter-PSSession -ComputerName $computerName"
            Write-Debug "Launching PowerShell with command: $psCommand"
            
            Start-Process powershell -ArgumentList "-NoExit", "-Command $psCommand" -ErrorAction Stop
            
            Write-Host "PowerShell remote session launched successfully" -ForegroundColor Green
            Write-Host "A new PowerShell window should have opened with remote session to '$computerName'" -ForegroundColor Cyan
            
            # Log the remote session if logging is enabled
            if ($script:logFilePath) {
                $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId started PowerShell remote session to $computerName"
                Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
            }
        }
    }
    catch [System.InvalidOperationException] {
        Write-Host "PowerShell Remoting is not enabled on '$computerName'" -ForegroundColor Red
        Write-Host "`nTo enable PowerShell Remoting on the remote computer, run:" -ForegroundColor Yellow
        Write-Host "Enable-PSRemoting -Force" -ForegroundColor Gray
        
        # Offer PsExec alternative
        $usePsExec = Read-Host "`nWould you like to try PsExec instead? (y/n)"
        if ($usePsExec -eq 'y' -or $usePsExec -eq 'Y') {
            Start-PsExecConsole -userId $userId -computerName $computerName
            return
        }
    }
    catch {
        Write-Host "Error starting PowerShell remote session: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception starting PowerShell session: $($_.Exception)"
        
        # Offer troubleshooting suggestions
        Write-Host "`nTroubleshooting suggestions:" -ForegroundColor Yellow
        Write-Host "- Verify computer is online and accessible" -ForegroundColor Gray
        Write-Host "- Check if PowerShell Remoting is enabled" -ForegroundColor Gray  
        Write-Host "- Ensure proper credentials and permissions" -ForegroundColor Gray
        Write-Host "- Try PsExec alternative (option 5 in menu)" -ForegroundColor Gray
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Start PsExec command prompt session to target computer
.DESCRIPTION
    Opens PsExec command prompt session to the specified computer
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to connect to
.EXAMPLE
    Start-PsExecConsole -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Requires PsExec to be available in system PATH or current directory
#>
function Start-PsExecConsole {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Starting PsExec console for computer: $computerName (requested by: $userId)"

    Write-Host "Opening PsExec command prompt to '$computerName'..." -ForegroundColor Cyan

    # Check if PsExec is available
    $psexecPaths = @(
        "psexec.exe",  # In PATH
        ".\Tools\psexec.exe",  # Local tools directory
        "C:\Sysinternals\psexec.exe"  # Common installation location
    )

    $psexecPath = $null
    foreach ($path in $psexecPaths) {
        if (Get-Command $path -ErrorAction SilentlyContinue) {
            $psexecPath = $path
            break
        } elseif (Test-Path $path) {
            $psexecPath = $path
            break
        }
    }

    if (-not $psexecPath) {
        Write-Host "PsExec not found in expected locations:" -ForegroundColor Red
        foreach ($path in $psexecPaths) {
            Write-Host "  $path" -ForegroundColor Gray
        }
        Write-Host "`nPlease download PsExec from Microsoft Sysinternals and place it in one of the above locations." -ForegroundColor Yellow
        Write-Host "Download: https://docs.microsoft.com/en-us/sysinternals/downloads/psexec" -ForegroundColor Cyan
        
        Read-Host "Press Enter to continue"
        return
    }

    try {
        # Test connectivity first
        Write-Host "Testing connectivity to '$computerName'..." -ForegroundColor Yellow
        if (-not (Test-Connection -ComputerName $computerName -Count 1 -Quiet)) {
            Write-Host "Computer '$computerName' is not responding to ping" -ForegroundColor Red
            $continue = Read-Host "Continue anyway? (y/n)"
            if ($continue -ne 'y' -and $continue -ne 'Y') {
                return
            }
        } else {
            Write-Host "Computer is responding" -ForegroundColor Green
        }

        # Construct PsExec command
        $psexecCommand = "\\$computerName cmd.exe"
        Write-Debug "PsExec command: $psexecPath $psexecCommand"
        
        Write-Host "Launching PsExec session..." -ForegroundColor Cyan
        Write-Host "Command: $psexecPath $psexecCommand" -ForegroundColor Gray
        
        # Start PsExec in a new command window
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c $psexecPath $psexecCommand" -ErrorAction Stop
        
        Write-Host "PsExec command prompt session initiated for '$computerName'" -ForegroundColor Green
        Write-Host "`nNotes:" -ForegroundColor Yellow
        Write-Host "- A command prompt window should open" -ForegroundColor Gray
        Write-Host "- You may be prompted to accept the license agreement" -ForegroundColor Gray
        Write-Host "- Administrative privileges may be required" -ForegroundColor Gray
        
        # Log the PsExec session if logging is enabled
        if ($script:logFilePath) {
            $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId started PsExec session to $computerName"
            Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
        }
        
    } catch {
        Write-Host "Error starting PsExec session: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception starting PsExec: $($_.Exception)"
        
        Write-Host "`nTroubleshooting suggestions:" -ForegroundColor Yellow
        Write-Host "- Verify computer is online and file sharing is enabled" -ForegroundColor Gray
        Write-Host "- Ensure you have administrative privileges on target computer" -ForegroundColor Gray
        Write-Host "- Check if Windows Firewall is blocking connections" -ForegroundColor Gray
        Write-Host "- Try running as administrator" -ForegroundColor Gray
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Test remote console capabilities for a computer
.DESCRIPTION
    Tests both PowerShell Remoting and PsExec capabilities
.PARAMETER computerName
    Name of the computer to test
.EXAMPLE
    Test-RemoteConsoleCapabilities -computerName "COMPUTER01"
#>
function Test-RemoteConsoleCapabilities {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Host "Testing remote console capabilities for '$computerName'..." -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Gray

    # Test PowerShell Remoting
    Write-Host "`n1. PowerShell Remoting Test:" -ForegroundColor Yellow
    try {
        $wsmanResult = Test-WSMan -ComputerName $computerName -ErrorAction Stop
        if ($wsmanResult) {
            Write-Host "   PowerShell Remoting: AVAILABLE" -ForegroundColor Green
            Write-Host "   Product Version: $($wsmanResult.ProductVersion)" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "   PowerShell Remoting: NOT AVAILABLE" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    }

    # Test basic connectivity
    Write-Host "`n2. Network Connectivity Test:" -ForegroundColor Yellow
    if (Test-Connection -ComputerName $computerName -Count 1 -Quiet) {
        Write-Host "   Ping: SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "   Ping: FAILED" -ForegroundColor Red
    }

    # Test SMB/File sharing (required for PsExec)
    Write-Host "`n3. SMB/File Sharing Test:" -ForegroundColor Yellow
    try {
        $adminShare = Test-Path "\\$computerName\admin$" -ErrorAction Stop
        if ($adminShare) {
            Write-Host "   Admin Share Access: AVAILABLE" -ForegroundColor Green
        } else {
            Write-Host "   Admin Share Access: NOT AVAILABLE" -ForegroundColor Red
        }
    } catch {
        Write-Host "   Admin Share Access: ERROR" -ForegroundColor Red
        Write-Host "   $($_.Exception.Message)" -ForegroundColor Gray
    }

    Write-Host "`n" + "=" * 60 -ForegroundColor Gray
    Write-Host "Remote console capability test completed." -ForegroundColor Green
}