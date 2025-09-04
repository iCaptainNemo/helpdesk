<#
.SYNOPSIS
    Maps a network drive on a remote PC for a specific logged-in user using a batch file via a scheduled task.
.DESCRIPTION
    Creates a batch file, copies it to the remote computer's user temp directory.
    Then, it creates and runs a temporary scheduled task on the remote PC as the specified user to execute the batch file.
    The batch file will only affect the currently logged-in user who executes it.
    Optionally creates a desktop shortcut on the remote user's desktop via PowerShell.
.NOTES
    Requires administrative privileges on the local machine to run Invoke-Command and schtasks remotely.
    The account running this script needs permissions to create and manage scheduled tasks as the target user on the remote machine.
#>

function Get-UsedDriveLetters {
    param([string]$remotePC)
    
    $usedLetters = Invoke-Command -ComputerName $remotePC -ScriptBlock {
        Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Name
    } -ErrorAction SilentlyContinue

    return $usedLetters
}

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

function Check-IfMapped {
    param([string]$remotePC, [string]$sharePath)
    
    try {
        $mappedDrives = Invoke-Command -ComputerName $remotePC -ScriptBlock {
            net use | Where-Object { $_ -match '^\w+:' }
        } -ErrorAction SilentlyContinue
        
        $escapedSharePathForRegex = [regex]::Escape($sharePath)
        foreach ($drive in $mappedDrives) {
            if ($drive -match $escapedSharePathForRegex) {
                return $true
            }
        }
        return $false
    }
    catch {
        Write-Warning "Error checking mapped drives on $remotePC : $($_.Exception.Message)"
        return $false 
    }
}

# Prompt inputs
$remotePC = Read-Host "Enter the remote computer name"
$sharePath = Read-Host "Enter the network folder to map (e.g. \\server\share)"

# Check if the folder is already mapped
Write-Host "`n🔍 Checking if folder is already mapped..." -ForegroundColor Cyan
if (Check-IfMapped -remotePC $remotePC -sharePath $sharePath) {
    Write-Host "❌ The folder $sharePath is already mapped on $remotePC." -ForegroundColor Red
    Write-Host "💡 No action needed - drive mapping already exists." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 0
}

# Output session info
Write-Host "`n📡 Querying session info on $remotePC..." -ForegroundColor Cyan
$queryOutput = query user /server:$remotePC 2>&1 | Out-String

if ($queryOutput -notmatch "USERNAME") {
    Write-Host "❌ Failed to retrieve sessions from $remotePC. Error: $queryOutput" -ForegroundColor Red
    exit 1
}

Write-Host "`nSession information for ${remotePC}:" -ForegroundColor Cyan
Write-Host $queryOutput

$selectedSession = Read-Host "Enter the session ID to use (e.g. 1)"
$userName = Get-UserNameFromSession -remotePC $remotePC -sessionId $selectedSession
if (-not $userName) {
    Write-Host "❌ Could not determine username for session ID $selectedSession" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Found user: $userName for session ID $selectedSession" -ForegroundColor Green

$usedLetters = Get-UsedDriveLetters -remotePC $remotePC
if ($usedLetters) {
    Write-Host "`nUsed drive letters (do not select): " -NoNewline -ForegroundColor Cyan
    Write-Host ($usedLetters -join ' ') -ForegroundColor Red
} else {
    Write-Host "`nNo drive letters currently in use." -ForegroundColor Cyan
}

do {
    $driveLetter = Read-Host "Enter the drive letter to use (e.g. Z)"
    if ([string]::IsNullOrWhiteSpace($driveLetter)) {
        Write-Host "❌ Drive letter cannot be empty." -ForegroundColor Red
        continue
    }
    if ($usedLetters -contains $driveLetter.ToUpper()) {
        Write-Host "❌ Drive letter $($driveLetter.ToUpper()) is already in use. Please choose a different letter." -ForegroundColor Red
    }
} while ([string]::IsNullOrWhiteSpace($driveLetter) -or $usedLetters -contains $driveLetter.ToUpper())

# Robustly extract share name
$cleanedPathForNameExtraction = $sharePath.TrimEnd('\')
$pathComponents = $cleanedPathForNameExtraction.Split([System.IO.Path]::DirectorySeparatorChar, [System.StringSplitOptions]::RemoveEmptyEntries)

if ($pathComponents.Count -ge 2) { # Expect at least server and share
    $shareName = $pathComponents[-1]
} else {
    $shareName = "" # Path is likely invalid for share name extraction
}

# Confirm or allow modification of the share name, ensuring it's not blank
if ([string]::IsNullOrWhiteSpace($shareName)) {
    Write-Warning "Could not automatically determine a suitable share name from '$sharePath'."
    $shareName = Read-Host "Please enter the name you want to use for the drive label and shortcut"
    while ([string]::IsNullOrWhiteSpace($shareName)) {
        Write-Warning "Share name cannot be empty. Please try again."
        $shareName = Read-Host "Please enter the name you want to use for the drive label and shortcut"
    }
    Write-Host "✅ Using provided name: '$shareName'" -ForegroundColor Green
} else {
    Write-Host "`n📝 The automatically determined name for the drive label and shortcut is: '$shareName'" -ForegroundColor Cyan
    $choice = Read-Host "Do you want to use this name? (Y/N, default Y)"
    if ($choice.ToUpperInvariant() -eq 'N') {
        $customShareName = Read-Host "Enter the custom name you want to use for the drive label and shortcut"
        if (-not [string]::IsNullOrWhiteSpace($customShareName)) {
            $shareName = $customShareName
            Write-Host "✅ Using custom name: '$shareName'" -ForegroundColor Green
        } else {
            Write-Host "⚠️ No custom name entered. Using the auto-determined name: '$shareName'" -ForegroundColor Yellow
            if ([string]::IsNullOrWhiteSpace($shareName)) { # Should not happen if auto-determination was successful
                 Write-Error "Share name cannot be empty after attempting custom input. Aborting."
                 exit 1
            }
        }
    } else { # Default is Yes (empty input, 'Y', or anything not 'N')
        Write-Host "✅ Using auto-determined name: '$shareName'" -ForegroundColor Green
    }
}

# Prepare PowerShell variables for safer embedding in the batch script
$batchSafe_remotePC = $remotePC -replace '%', '%%'
$batchSafe_userName = $userName -replace '%', '%%'
$batchSafe_sharePath = $sharePath -replace '%', '%%'
$batchSafe_shareName = $shareName -replace '%', '%%'
$batchSafe_driveLetter = $driveLetter -replace '%', '%%'

# Create CMD file content (same as before)
$cmdContent = @"
@echo off
setlocal

REM Assign PowerShell-provided values to batch variables
set "REMOTE_PC=$batchSafe_remotePC"
set "USER_NAME=$batchSafe_userName"
set "DRIVE_LETTER=$batchSafe_driveLetter"
set "SHARE_PATH=$batchSafe_sharePath"
set "SHARE_NAME=$batchSafe_shareName"

color 0f
mode con cols=80 lines=25
cls
echo.
echo =========================================================================
echo   NETWORK DRIVE MAPPING UTILITY
echo =========================================================================
echo.
echo   Computer: %REMOTE_PC%
echo   User: %USER_NAME%
echo   Drive Letter: %DRIVE_LETTER%:
echo   Network Path: %SHARE_PATH%
echo   Drive Name: %SHARE_NAME%
echo.
echo =========================================================================
echo   Mapping network drive, please wait...
echo =========================================================================
echo.

REM Check if already mapped to this drive letter
net use %DRIVE_LETTER%: >nul 2>&1
if %errorlevel% equ 0 (
    color 4f
    cls
    echo.
    echo =========================================================================
    echo   ERROR - Drive letter %DRIVE_LETTER%: is already in use
    echo =========================================================================
    echo.
    echo   Please choose a different drive letter.
    echo.
    echo =========================================================================
    echo   This window will close automatically in 10 seconds...
    echo =========================================================================
    timeout /t 10 /nobreak >nul
    exit /b 1
)

net use %DRIVE_LETTER%: "%SHARE_PATH%" /persistent:yes
set MAPPING_RESULT=%errorlevel%

REM Set the drive label to the share name if mapping succeeded
if %MAPPING_RESULT% equ 0 (
    label %DRIVE_LETTER%: "%SHARE_NAME%" >nul 2>&1
)

echo.
timeout /t 2 /nobreak >nul
cls

if %MAPPING_RESULT% equ 0 (
    color 2f
    echo.
    echo =========================================================================
    echo   SUCCESS - Drive mapping completed
    echo =========================================================================
    echo.
    echo   Drive %DRIVE_LETTER%: (%SHARE_NAME%) is now mapped to:
    echo   %SHARE_PATH%
    echo.
    echo   The mapping will persist after restart.
    echo.
) else (
    color 4f
    echo.
    echo =========================================================================
    echo   ERROR - Drive mapping failed
    echo =========================================================================
    echo.
    echo   Error code: %MAPPING_RESULT%
    echo   Please contact IT support if the problem persists.
    echo.
)
echo =========================================================================
echo   This window will close automatically in 5 seconds...
echo =========================================================================
timeout /t 5 /nobreak >nul
set FINAL_EXIT_CODE=%MAPPING_RESULT%
endlocal
exit /b %FINAL_EXIT_CODE%
"@

$tempCmdFile = "$env:TEMP\MapDrive_$driveLetter.cmd"
$remoteUserTempAdminPath = "\\$remotePC\C$\Users\$userName\AppData\Local\Temp"
$remoteCmdFileName = "MapDrive_$(Get-Random -Maximum 99999)_$driveLetter.cmd" # Unique name for remote file
$remoteCmdFileForCopy = Join-Path -Path $remoteUserTempAdminPath -ChildPath $remoteCmdFileName
$remoteCmdFileForExecution = "C:\Users\$userName\AppData\Local\Temp\$remoteCmdFileName"
$desktopAdminPath = "\\$remotePC\C$\Users\$userName\Desktop"
$desktopCmdFileForCopy = Join-Path -Path $desktopAdminPath -ChildPath $remoteCmdFileName # Use unique name for desktop backup too

$driveExists = $false # Initialize

try {
    $cmdContent | Out-File -FilePath $tempCmdFile -Encoding ASCII -Force
    Write-Host "`n📋 Copying CMD file to user's temp directory on remote computer..." -ForegroundColor Cyan
    Copy-Item -Path $tempCmdFile -Destination $remoteCmdFileForCopy -Force -ErrorAction Stop
    
    Write-Host "`n⚙️ Attempting to map drive using Scheduled Task on $remotePC for user $userName..." -ForegroundColor Cyan
    
    $taskName = "TempMapDrive_$(Get-Random -Maximum 99999)_${driveLetter}_${userName}"
    
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
                return
            }
            Write-Host "Remote: Task '$taskNameParam' created."
            Write-Host "Remote: Running task '$taskNameParam'."
            $runArgs = "/run /tn ""$taskNameParam"""
            $runProcess = Start-Process -FilePath $schtasksPath -ArgumentList $runArgs -Wait -PassThru -NoNewWindow -ErrorAction SilentlyContinue
            if ($runProcess.ExitCode -ne 0) {
                Write-Warning "Remote: Failed to run scheduled task '$taskNameParam'. Exit code: $($runProcess.ExitCode)."
            } else {
                Write-Host "Remote: Task '$taskNameParam' triggered. Waiting 15 seconds for execution..."
                Start-Sleep -Seconds 15 
            }
        }
        catch {
            Write-Warning "Remote: Error during scheduled task operations: $($_.Exception.Message)"
        }
        finally {
            Write-Host "Remote: Cleaning up task '$taskNameParam'."
            $deleteArgs = "/delete /tn ""$taskNameParam"" /f"
            Start-Process -FilePath $schtasksPath -ArgumentList $deleteArgs -Wait -NoNewWindow -ErrorAction SilentlyContinue
        }
    }

    Invoke-Command -ComputerName $remotePC -ScriptBlock $scriptBlockContent -ArgumentList $taskName, $remoteCmdFileForExecution, $userName -ErrorAction Stop

    Write-Host "✅ Scheduled task to map drive has been triggered on $remotePC for user $userName." -ForegroundColor Green

} catch {
    Write-Host "❌ An error occurred during the main script operation: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if (Test-Path $tempCmdFile) {
        Write-Host "`n🧹 Cleaning up local temporary file: $tempCmdFile" -ForegroundColor DarkCyan
        Remove-Item $tempCmdFile -Force -ErrorAction SilentlyContinue 
    }
}

# --- Desktop Shortcut Creation (Always Prompt) ---
Write-Host "`n--- Desktop Shortcut Creation ---" -ForegroundColor Cyan
$yes = New-Object System.Management.Automation.Host.ChoiceDescription "&Yes", "Create a desktop shortcut for this mapped drive on the remote user's desktop."
$no = New-Object System.Management.Automation.Host.ChoiceDescription "&No", "Do not create a desktop shortcut."
$options = [System.Management.Automation.Host.ChoiceDescription[]]($yes, $no)
$title = "Create Desktop Shortcut on Remote PC?"
$message = "The drive ${driveLetter}: has been mapped to '$sharePath' for user '$userName' on '$remotePC'.`nCreate a desktop shortcut for this drive on their desktop?"

$choiceResult = $Host.UI.PromptForChoice($title, $message, $options, 0) 

if ($choiceResult -eq 0) { # User selected Yes
    Write-Host "Attempting to create desktop shortcut on $remotePC for user $userName..." -ForegroundColor Yellow
    
    $shortcutScriptBlock = {
        param($User, $ShareNameParam, $DriveLetterForShortcut)
        $UserDesktop = "C:\Users\$User\Desktop"
        $SanitizedShareName = $ShareNameParam -replace '[\\/:*?"<>|]', '_' 
        $ShortcutLinkFileName = "$SanitizedShareName ($($DriveLetterForShortcut)).lnk"
        $FullShortcutPath = Join-Path -Path $UserDesktop -ChildPath $ShortcutLinkFileName
        $TargetForShortcut = "$($DriveLetterForShortcut):\"
        $DescriptionForShortcut = "$ShareNameParam Network Drive"

        if (Test-Path $UserDesktop) {
            try {
                $WshShell = New-Object -ComObject WScript.Shell
                $Shortcut = $WshShell.CreateShortcut($FullShortcutPath)
                $Shortcut.TargetPath = $TargetForShortcut
                $Shortcut.Description = $DescriptionForShortcut
                $Shortcut.Save()
                Write-Host "Remote: Shortcut '$ShortcutLinkFileName' created successfully on '$UserDesktop'."
            } catch {
                Write-Warning "Remote: Failed to create shortcut '$ShortcutLinkFileName'. Error: $($_.Exception.Message)"
            }
        } else {
            Write-Warning "Remote: User desktop path '$UserDesktop' not found."
        }
    }
    
    try {
        Invoke-Command -ComputerName $remotePC -ScriptBlock $shortcutScriptBlock -ArgumentList $userName, $shareName, $driveLetter -ErrorAction Stop
    } catch {
        Write-Error "Failed to execute shortcut creation on remote PC. Error: $($_.Exception.Message)"
    }
} else {
    Write-Host "Skipping desktop shortcut creation." -ForegroundColor Yellow
}

Write-Host "`n💡 The drive mapping, if successful, will only affect user $userName in session $selectedSession." -ForegroundColor Cyan
Write-Host "💡 Other users on the same computer will not see this mapped drive." -ForegroundColor Cyan
Read-Host "Press Enter to exit script"