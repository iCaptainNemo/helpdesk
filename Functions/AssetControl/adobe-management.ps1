<#
.SYNOPSIS
    Adobe application management functions for Asset Control
.DESCRIPTION
    Provides functions for managing Adobe applications including PDF default settings,
    license management, and configuration using the Remote User-Space Task Scheduler method.
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: Administrative privileges on target systems, Adobe applications installed
    Method: Uses Task Scheduler for user-space execution to properly configure user settings
#>

<#
.SYNOPSIS
    Set Adobe Acrobat as default PDF application
.DESCRIPTION
    Configures file associations to make Adobe Acrobat the default PDF handler for a specific user.
    Uses the Remote User-Space Task Scheduler method to ensure proper user context execution.
    This method overcomes the limitation of traditional remote execution that runs in SYSTEM context.
.PARAMETER userId
    The user ID for context (required for consistent interface)  
.PARAMETER computerName
    Name of the computer to configure PDF association on
.EXAMPLE
    Set-AdobePDFDefault -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    - Requires user to be actively logged in to the target computer
    - Uses scheduled task execution in user context for proper registry access
    - Configures both system-level associations and user-specific registry settings
    - Automatically detects Adobe Acrobat DC installation location
    - Provides visual feedback during execution with colored progress display
#>
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
    
    # Get active user sessions to identify target user
    Write-Host "`n📡 Querying active user sessions on $computerName..." -ForegroundColor Cyan
    try {
        $queryOutput = query user /server:$computerName 2>&1 | Out-String
        
        if ($queryOutput -notmatch "USERNAME") {
            Write-Host "❌ No active user sessions found on $computerName" -ForegroundColor Red
            Write-Host "💡 Adobe PDF default must be set while user is logged in" -ForegroundColor Yellow
            Read-Host "Press Enter to continue"
            return
        }
        
        Write-Host "Active sessions on ${computerName}:" -ForegroundColor Green
        Write-Host $queryOutput
        
        # Prompt for session selection
        $selectedSession = Read-Host "`nEnter the session ID for the user who needs Adobe PDF default set (e.g., 1)"
        
        # Extract username from session
        $targetUserName = Get-UserNameFromSession -remotePC $computerName -sessionId $selectedSession
        if (-not $targetUserName) {
            Write-Host "❌ Could not determine username for session ID $selectedSession" -ForegroundColor Red
            Read-Host "Press Enter to continue"
            return
        }
        
        Write-Host "✅ Target user: $targetUserName (Session: $selectedSession)" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Error querying user sessions: $($_.Exception.Message)" -ForegroundColor Red
        Read-Host "Press Enter to continue"
        return
    }

    # Create batch file content for setting Adobe PDF default
    $batchContent = @"
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

    try {
        # Generate unique file names
        $localTempFile = "$env:TEMP\SetAdobePDF_$(Get-Random -Maximum 99999).cmd"
        $remoteUserTemp = "\\$computerName\C$\Users\$targetUserName\AppData\Local\Temp"
        $remoteCmdFileName = "SetAdobePDF_$(Get-Random -Maximum 99999).cmd"
        $remoteCmdFilePath = Join-Path -Path $remoteUserTemp -ChildPath $remoteCmdFileName
        $remoteExecutionPath = "C:\Users\$targetUserName\AppData\Local\Temp\$remoteCmdFileName"
        
        # Create and deploy batch file
        Write-Host "`n📋 Creating Adobe PDF configuration script..." -ForegroundColor Cyan
        $batchContent | Out-File -FilePath $localTempFile -Encoding ASCII -Force
        
        Write-Host "📁 Deploying script to $computerName..." -ForegroundColor Cyan
        Copy-Item -Path $localTempFile -Destination $remoteCmdFilePath -Force
        
        # Create unique task name
        $taskName = "SetAdobePDF_$(Get-Random -Maximum 99999)_$targetUserName"
        
        Write-Host "`n⚙️ Creating scheduled task to run in user context..." -ForegroundColor Cyan
        
        # Define script block for remote task execution
        $taskScriptBlock = {
            param($TaskName, $Command, $User)
            
            try {
                $startTime = (Get-Date).AddMinutes(1).ToString("HH:mm")
                
                # Create scheduled task
                Write-Host "Remote: Creating task '$TaskName' for user '$User'"
                $createArgs = "/create /tn `"$TaskName`" /tr `"$Command`" /sc ONCE /st $startTime /ru `"$User`" /f /it /rl LIMITED"
                $createResult = Start-Process -FilePath "schtasks.exe" -ArgumentList $createArgs -Wait -PassThru -NoNewWindow -ErrorAction Stop
                
                if ($createResult.ExitCode -ne 0) {
                    Write-Warning "Remote: Failed to create task. Exit code: $($createResult.ExitCode)"
                    return $false
                }
                
                # Run task immediately
                Write-Host "Remote: Running task '$TaskName'"
                $runArgs = "/run /tn `"$TaskName`""
                $runResult = Start-Process -FilePath "schtasks.exe" -ArgumentList $runArgs -Wait -PassThru -NoNewWindow -ErrorAction Stop
                
                if ($runResult.ExitCode -ne 0) {
                    Write-Warning "Remote: Failed to run task. Exit code: $($runResult.ExitCode)"
                    return $false
                }
                
                # Wait for task execution
                Write-Host "Remote: Waiting for Adobe PDF configuration to complete..."
                Start-Sleep -Seconds 20
                
                return $true
            }
            catch {
                Write-Warning "Remote: Task execution failed: $($_.Exception.Message)"
                return $false
            }
            finally {
                # Cleanup task
                Write-Host "Remote: Cleaning up task '$TaskName'"
                $deleteArgs = "/delete /tn `"$TaskName`" /f"
                Start-Process -FilePath "schtasks.exe" -ArgumentList $deleteArgs -Wait -NoNewWindow -ErrorAction SilentlyContinue
            }
        }
        
        # Execute task on remote computer
        $taskSuccess = Invoke-Command -ComputerName $computerName -ScriptBlock $taskScriptBlock -ArgumentList $taskName, $remoteExecutionPath, $targetUserName -ErrorAction Stop
        
        if ($taskSuccess) {
            Write-Host "`n✅ Adobe PDF default configuration task completed successfully!" -ForegroundColor Green
            Write-Host "💡 Adobe Acrobat should now be the default PDF application for user '$targetUserName'" -ForegroundColor Cyan
            Write-Host "💡 Changes will take effect when the user opens new PDF files" -ForegroundColor Cyan
        } else {
            Write-Host "`n❌ Adobe PDF configuration task failed" -ForegroundColor Red
            Write-Host "💡 Please check if Adobe Acrobat DC is installed on the target computer" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "`n❌ Error during Adobe PDF configuration: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        # Cleanup files
        if (Test-Path $localTempFile) {
            Remove-Item $localTempFile -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path $remoteCmdFilePath) {
            Remove-Item $remoteCmdFilePath -Force -ErrorAction SilentlyContinue
        }
    }

    Read-Host "`nPress Enter to continue"
}

<#
.SYNOPSIS
    Helper function to extract username from session query output
.DESCRIPTION
    Parses the output of 'query user' command to extract username for a specific session ID
.PARAMETER remotePC
    Name of the remote computer
.PARAMETER sessionId
    Session ID to look up username for
.RETURNS
    Username for the specified session ID, or $null if not found
#>
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