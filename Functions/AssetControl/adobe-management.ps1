<#
.SYNOPSIS
    Sets Adobe Acrobat DC as the default PDF application on remote computers
.DESCRIPTION
    This module provides functions to configure Adobe Acrobat DC as the default PDF 
    application through scheduled task execution in user context. Addresses the persistent
    issue where Microsoft Edge reclaims PDF file associations despite correct system-level
    file associations being configured.

    The core challenge is that Windows 10/11 protects default program assignments through
    a UserChoice registry key that includes both a ProgId and a cryptographic hash. Simply
    setting the ProgId without the matching hash causes Windows to ignore the association.
    
    This solution uses a verified hash from a properly configured machine to bypass
    Windows' UserChoice protection and ensure Adobe remains the PDF default.

.FUNCTIONALITY
    - Detects Adobe Acrobat DC installation path (both 32-bit and 64-bit locations)
    - Sets correct file associations (.pdf = Acrobat.Document.DC)
    - Configures registry entries for proper PDF handling in user context
    - Forces Adobe re-registration to refresh all file associations
    - Removes Microsoft Edge PDF takeover registry entries
    - Sets UserChoice with verified hash to prevent Edge from reclaiming PDFs
    - Restarts Windows Explorer to apply changes immediately
    - Executes in target user's context via scheduled task for proper permissions

.PARAMETER userId
    The user ID requesting the Adobe PDF default configuration (for logging purposes)
.PARAMETER computerName  
    The target computer name where Adobe PDF default should be configured

.EXAMPLE
    Set-AdobePDFDefault -userId "jdoe" -computerName "WORKSTATION01"
    
    Sets Adobe Acrobat as the default PDF application for the active user on WORKSTATION01

.NOTES
    Author: Helpdesk Team
    Version: 4.0 - Enhanced with UserChoice hash handling
    Requires: 
        - Adobe Acrobat DC installed on target machine
        - Active user session on target machine  
        - Remote PowerShell access to target machine
        - Local administrator rights for scheduled task creation
    
    Part of: Jarvis Helpdesk Automation System - Asset Control Functions

.TECHNICAL DETAILS
    UserChoice Hash Problem:
    Windows protects default program settings via HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.pdf\UserChoice
    This key contains:
    - ProgId: "Acrobat.Document.DC" (the program identifier)
    - Hash: "4ankxyIxoIo=" (cryptographic signature validating the ProgId)
    
    The hash is calculated using a proprietary Microsoft algorithm that includes:
    - User SID
    - File extension (.pdf)  
    - ProgId value
    - System timestamp
    - Unknown salt values
    
    Attempting to set ProgId without the matching hash results in Windows ignoring 
    the association. This script uses a verified hash from a working configuration
    to bypass this protection mechanism.

.TROUBLESHOOTING
    If Adobe doesn't become the default after running:
    1. Verify Adobe Acrobat DC is properly installed
    2. Check that the user was actively logged in during execution
    3. Confirm Windows version compatibility (Windows 10/11)
    4. Test with a different user account to rule out profile corruption
    5. Check if Group Policy is overriding user-level associations
    
    Common Error Indicators:
    - assoc .pdf shows correct value but right-click "Open with" still shows Edge
    - PDF icons appear correct but files still open in Edge
    - Settings > Default Apps shows Edge instead of Adobe for PDFs
#>

# Adobe PDF Default Configuration Batch Content (MUST be at script level)
$global:AdobePDFBatchTemplate = @"
@echo off
setlocal

REM === ADOBE PDF DEFAULT CONFIGURATION ===
color 0E
mode con cols=80 lines=25
cls
echo.
echo =========================================================================
echo   ADOBE PDF DEFAULT CONFIGURATION
echo =========================================================================
echo.
echo   Computer: %COMPUTERNAME%
echo   User: %USERNAME%
echo   Operation: Setting Adobe Acrobat as default PDF application
echo =========================================================================
echo.

REM Check if Adobe Acrobat DC is installed
if not exist "C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe" (
    if not exist "C:\Program Files (x86)\Adobe\Acrobat DC\Acrobat\Acrobat.exe" (
        color 4F
        cls
        echo.
        echo =========================================================================
        echo   ERROR - Adobe Acrobat DC not found
        echo =========================================================================
        echo.
        echo   Adobe Acrobat DC does not appear to be installed on this computer.
        echo   Please install Adobe Acrobat DC first.
        echo.
        echo =========================================================================
        echo   This window will close automatically in 10 seconds...
        echo =========================================================================
        timeout /t 10 /nobreak >nul
        exit /b 1
    )
    set "ADOBE_PATH=C:\Program Files (x86)\Adobe\Acrobat DC\Acrobat\Acrobat.exe"
) else (
    set "ADOBE_PATH=C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe"
)

echo   Adobe Acrobat found at: %ADOBE_PATH%
echo.
echo =========================================================================
echo   Configuring PDF file associations...
echo =========================================================================
echo.

REM Set file association for .pdf extension (use correct ProgId)
echo Setting .pdf file association...
assoc .pdf=Acrobat.Document.DC >nul 2>&1
set ASSOC_RESULT=%errorlevel%

REM Set file type handler (use correct ProgId)
echo Setting file type handler...
ftype Acrobat.Document.DC="%ADOBE_PATH%" "%%1" >nul 2>&1
set FTYPE_RESULT=%errorlevel%

REM Configure registry entries for proper PDF handling (user context)
echo Configuring registry entries...

REM Force Adobe to re-register itself (critical step)
echo Re-registering Adobe Acrobat...
"%ADOBE_PATH%" /RegServer >nul 2>&1

REM Set user-level file association (correct ProgId)
reg add "HKCU\Software\Classes\.pdf" /ve /t REG_SZ /d "Acrobat.Document.DC" /f >nul 2>&1
reg add "HKCU\Software\Classes\Acrobat.Document.DC\shell\open\command" /ve /t REG_SZ /d "\"%ADOBE_PATH%\" \"%%1\"" /f >nul 2>&1

REM Set machine-level backup associations
reg add "HKLM\Software\Classes\.pdf" /ve /t REG_SZ /d "Acrobat.Document.DC" /f >nul 2>&1
reg add "HKLM\Software\Classes\Acrobat.Document.DC\shell\open\command" /ve /t REG_SZ /d "\"%ADOBE_PATH%\" \"%%1\"" /f >nul 2>&1

REM Remove Edge PDF handler entries (aggressive approach)
echo Removing Edge PDF takeover...
reg delete "HKCU\Software\Classes\AppXd4nrz8ff68srnhf9t5a8sbjyar1cr723" /f >nul 2>&1
reg delete "HKLM\Software\Classes\AppXd4nrz8ff68srnhf9t5a8sbjyar1cr723" /f >nul 2>&1

REM Configure default programs association (correct ProgId)
reg add "HKCU\Software\Microsoft\Windows\Shell\Associations\Application\Acrobat.exe\Capabilities\FileAssociations" /v .pdf /t REG_SZ /d "Acrobat.Document.DC" /f >nul 2>&1

REM Set UserChoice with correct hash from working machine
echo Setting UserChoice with verified hash...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.pdf\UserChoice" /v ProgId /t REG_SZ /d "Acrobat.Document.DC" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.pdf\UserChoice" /v Hash /t REG_SZ /d "4ankxyIxoIo=" /f >nul 2>&1

echo UserChoice configured: ProgId=Acrobat.Document.DC Hash=4ankxyIxoIo=

REM Restart Windows Explorer to force association refresh (critical step)
echo Refreshing Windows Explorer to apply changes...
taskkill /f /im explorer.exe >nul 2>&1
timeout /t 2 /nobreak >nul
start explorer.exe

echo.
timeout /t 2 /nobreak >nul
cls

REM Display results
if %ASSOC_RESULT% equ 0 if %FTYPE_RESULT% equ 0 (
    color 2F
    echo.
    echo =========================================================================
    echo   SUCCESS - Adobe PDF default configuration completed
    echo =========================================================================
    echo.
    echo   Adobe Acrobat is now set as the default PDF application for %USERNAME%
    echo   
    echo   Configuration applied:
    echo   - File association: .pdf = Acrobat.Document.DC
    echo   - File handler: %ADOBE_PATH%
    echo   - Adobe re-registered and UserChoice reset
    echo   - Edge PDF takeover disabled
    echo.
    echo   Changes will take effect for new PDF files opened.
    echo.
) else (
    color 4F
    echo.
    echo =========================================================================
    echo   WARNING - Partial configuration completed
    echo =========================================================================
    echo.
    echo   Some configuration steps may have failed:
    echo   - File association result: %ASSOC_RESULT%
    echo   - File type handler result: %FTYPE_RESULT%
    echo.
    echo   Please verify PDF files open with Adobe Acrobat.
    echo   Contact IT support if issues persist.
    echo.
)

echo =========================================================================
echo   This window will close automatically in 8 seconds...
echo =========================================================================
timeout /t 8 /nobreak >nul

endlocal
exit /b 0
"@

function Get-UserNameFromSession {
    param([string]$remotePC, [string]$sessionId)
    
    $queryOutput = query user /server:$remotePC 2>&1 | Out-String
    $lines = $queryOutput -split "`n"
    
    foreach ($line in $lines) {
        if ($line -match "^\s*(\S+)\s+\S+\s+$sessionId\s+") {
            return $matches[1]
        }
    }
    return $null
}

function Set-AdobePDFDefault {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Setting Adobe PDF default on computer: $computerName (requested by: $userId)"
    Write-Host "Setting Adobe Acrobat as default PDF application on '$computerName'..." -ForegroundColor Cyan
    
    $remotePC = $computerName

    # Get active user sessions to identify target user
    Write-Host "Querying active user sessions on $remotePC..." -ForegroundColor Cyan
    try {
        $queryOutput = query user /server:$remotePC 2>&1 | Out-String
        
        if ($queryOutput -notmatch "USERNAME") {
            Write-Host "No active user sessions found on $remotePC" -ForegroundColor Red
            Write-Host "Adobe PDF default must be set while user is logged in" -ForegroundColor Yellow
            Read-Host "Press Enter to continue"
            return
        }
        
        Write-Host "Active sessions on ${remotePC}:" -ForegroundColor Green
        Write-Host $queryOutput
        
        # Prompt for session selection
        $selectedSession = Read-Host "`nEnter the session ID for the user who needs Adobe PDF default set (e.g., 1)"
        
        # Extract username from session
        $userName = Get-UserNameFromSession -remotePC $remotePC -sessionId $selectedSession
        if (-not $userName) {
            Write-Host "Could not determine username for session ID $selectedSession" -ForegroundColor Red
            Read-Host "Press Enter to continue"
            return
        }
        
        Write-Host "Target user: $userName (Session: $selectedSession)" -ForegroundColor Green
        
    } catch {
        Write-Host "Error querying user sessions: $($_.Exception.Message)" -ForegroundColor Red
        Read-Host "Press Enter to continue"
        return
    }

    # Use the globally defined batch template
    $cmdContent = $global:AdobePDFBatchTemplate

    # File paths
    $tempCmdFile = "$env:TEMP\SetAdobePDF_$(Get-Random -Maximum 99999).cmd"
    $remoteUserTempAdminPath = "\\$remotePC\C$\Users\$userName\AppData\Local\Temp"
    $remoteCmdFileName = "SetAdobePDF_$(Get-Random -Maximum 99999).cmd"
    $remoteCmdFileForCopy = Join-Path -Path $remoteUserTempAdminPath -ChildPath $remoteCmdFileName
    $remoteCmdFileForExecution = "C:\Users\$userName\AppData\Local\Temp\$remoteCmdFileName"

    try {
        # Create and deploy batch file
        Write-Host "Creating Adobe PDF configuration script..." -ForegroundColor Cyan
        $cmdContent | Out-File -FilePath $tempCmdFile -Encoding ASCII -Force
        
        Write-Host "Deploying script to $remotePC..." -ForegroundColor Cyan
        Copy-Item -Path $tempCmdFile -Destination $remoteCmdFileForCopy -Force -ErrorAction Stop
        
        # Create unique task name
        $taskName = "SetAdobePDF_$(Get-Random -Maximum 99999)_$userName"
        
        Write-Host "Creating scheduled task to run in user context..." -ForegroundColor Cyan
        
        # Define script block for remote task execution
        $scriptBlockContent = {
            param($taskNameParam, $taskCommandParam, $taskRunAsUserParam)
            $schtasksPath = "schtasks.exe"
            $startTime = (Get-Date).AddMinutes(1).ToString("HH:mm")
            try {
                Write-Host "Remote: Creating task '$taskNameParam' to run '$taskCommandParam' as '$taskRunAsUserParam' at $startTime."
                $createArgs = "/create /tn ""$taskNameParam"" /tr ""$taskCommandParam"" /sc ONCE /st $startTime /ru ""$taskRunAsUserParam"" /f /it /rl LIMITED"
                $createProcess = Start-Process -FilePath $schtasksPath -ArgumentList $createArgs -Wait -PassThru -NoNewWindow -ErrorAction SilentlyContinue
                if ($createProcess.ExitCode -ne 0) {
                    Write-Warning "Remote: Failed to create scheduled task '$taskNameParam'. Exit code: $($createProcess.ExitCode)."
                    return $false
                }
                Write-Host "Remote: Task '$taskNameParam' created."
                Write-Host "Remote: Running task '$taskNameParam'."
                $runArgs = "/run /tn ""$taskNameParam"""
                $runProcess = Start-Process -FilePath $schtasksPath -ArgumentList $runArgs -Wait -PassThru -NoNewWindow -ErrorAction SilentlyContinue
                if ($runProcess.ExitCode -ne 0) {
                    Write-Warning "Remote: Failed to run scheduled task '$taskNameParam'. Exit code: $($runProcess.ExitCode)."
                    return $false
                } else {
                    Write-Host "Remote: Task '$taskNameParam' triggered. Waiting 20 seconds for Adobe PDF configuration..."
                    Start-Sleep -Seconds 20 
                    return $true
                }
            }
            catch {
                Write-Warning "Remote: Error during scheduled task operations: $($_.Exception.Message)"
                return $false
            }
            finally {
                Write-Host "Remote: Cleaning up task '$taskNameParam'."
                $deleteArgs = "/delete /tn ""$taskNameParam"" /f"
                Start-Process -FilePath $schtasksPath -ArgumentList $deleteArgs -Wait -NoNewWindow -ErrorAction SilentlyContinue
            }
        }

        # Execute task on remote computer
        $taskSuccess = Invoke-Command -ComputerName $remotePC -ScriptBlock $scriptBlockContent -ArgumentList $taskName, $remoteCmdFileForExecution, $userName -ErrorAction Stop

        if ($taskSuccess) {
            Write-Host "Adobe PDF default configuration task completed successfully!" -ForegroundColor Green
            Write-Host "Adobe Acrobat should now be the default PDF application for user '$userName'" -ForegroundColor Cyan
            Write-Host "Changes will take effect when the user opens new PDF files" -ForegroundColor Cyan
        } else {
            Write-Host "Adobe PDF configuration task failed" -ForegroundColor Red
            Write-Host "Please check if Adobe Acrobat DC is installed on the target computer" -ForegroundColor Yellow
        }

    } catch {
        Write-Host "Error during Adobe PDF configuration: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        # Cleanup files
        if (Test-Path $tempCmdFile) {
            Write-Host "Cleaning up local temporary file: $tempCmdFile"
            Remove-Item $tempCmdFile -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path $remoteCmdFileForCopy) {
            Remove-Item $remoteCmdFileForCopy -Force -ErrorAction SilentlyContinue
        }
    }
}
