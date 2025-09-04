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

REM Set file association for .pdf extension
echo Setting .pdf file association...
assoc .pdf=AcrobatDocument >nul 2>&1
set ASSOC_RESULT=%errorlevel%

REM Set file type handler
echo Setting file type handler...
ftype AcrobatDocument="%ADOBE_PATH%" "%%1" >nul 2>&1
set FTYPE_RESULT=%errorlevel%

REM Configure registry entries for proper PDF handling (user context)
echo Configuring registry entries...

REM Set user-level file association
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.pdf\UserChoice" /v ProgId /t REG_SZ /d "AcrobatDocument" /f >nul 2>&1

REM Set Adobe as default in user preferences
reg add "HKCU\Software\Classes\.pdf" /ve /t REG_SZ /d "AcrobatDocument" /f >nul 2>&1
reg add "HKCU\Software\Classes\AcrobatDocument\shell\open\command" /ve /t REG_SZ /d "\"%ADOBE_PATH%\" \"%%1\"" /f >nul 2>&1

REM Configure default programs association
reg add "HKCU\Software\Microsoft\Windows\Shell\Associations\Application\AcroRd32.exe\Capabilities\FileAssociations" /v .pdf /t REG_SZ /d "AcrobatDocument" /f >nul 2>&1

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
    echo   - File association: .pdf = AcrobatDocument
    echo   - File handler: %ADOBE_PATH%
    echo   - User registry preferences updated
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
