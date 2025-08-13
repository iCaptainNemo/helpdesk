# Requires PowerShell 5.1 or newer
# Requires the Active Directory PowerShell Module installed on the local machine
# Requires PsExec.exe to be available in the system PATH.
# Created by: Fernando Flores
# Date: 2025-06-06

# --- Configuration ---
$PSTempPath = "C:\TEMP" # Local temporary folder for the .cmd file
$PsExecPath = "psexec.exe" # PsExec is assumed to be in the system PATH.

# --- Function to prompt for input ---
function Get-ValidatedInput {
    param(
        [string]$PromptMessage,
        [string]$ValidationRegex = ".*",
        [string]$ErrorMessage = "Invalid input. Please try again."
    )
    $inputIsValid = $false
    do {
        $input = Read-Host -Prompt $PromptMessage
        if ($input -match $ValidationRegex) {
            $inputIsValid = $true
        } else {
            Write-Warning $ErrorMessage
        }
    } while (-not $inputIsValid)
    return $input
}

Write-Host "--- Printer Deployment Script ---"

# Trim inputs to prevent accidental leading/trailing spaces
$remoteComputerName = (Get-ValidatedInput -Prompt "Enter the remote computer name:").Trim()
$printServerName = (Get-ValidatedInput -Prompt "Enter the print server name (e.g., HSSServer###):" -ValidationRegex "^HSSServer\d{3}$" -ErrorMessage "Print server name must start with 'HSSServer' and end with 3 numbers (e.g., HSSServer123).").Trim()
$printerName = (Get-ValidatedInput -Prompt "Enter the printer name:").Trim()

Write-Host "`n--- Performing Active Directory Checks ---"

# --- Active Directory Checks ---
$adModuleLoaded = (Get-Module -ListAvailable -Name ActiveDirectory).Count -gt 0
if (-not $adModuleLoaded) {
    Write-Warning "Active Directory PowerShell module not found. Skipping AD checks. Please install RSAT-AD-PowerShell if needed."
} else {
    try {
        Get-ADComputer -Identity $remoteComputerName -ErrorAction Stop | Out-Null
        Write-Host "Computer '$remoteComputerName' found in AD." -ForegroundColor Green
    } catch {
        Write-Warning "Computer '$remoteComputerName' NOT found in AD. Continuing."
    }
    try {
        Get-ADComputer -Identity $printServerName -ErrorAction Stop | Out-Null
        Write-Host "Print server '$printServerName' found in AD." -ForegroundColor Green
    } catch {
        Write-Warning "Print server '$printServerName' NOT found in AD. Continuing."
    }
}

# --- PsExec availability check ---
if (-not (Get-Command $PsExecPath -ErrorAction SilentlyContinue)) {
    Write-Error "PsExec not found at '$PsExecPath'. Ensure it's in your system PATH."
    exit 1
}

# --- Construct .cmd file content ---
$cmdFileName = "AddPrinter_$($remoteComputerName)_$((Get-Date).ToString('yyyyMMddHHmmss')).cmd"
$cmdFilePathLocal = Join-Path -Path $PSTempPath -ChildPath $cmdFileName

# Option 3: Install printer for the active user session
$cmdContent = @"
@echo off
setlocal

set PRINTER=\\$printServerName\$printerName
set LOG=C:\TEMP\printer_install_log.txt
echo =========================================================================
echo   Printer Installation Script
echo =========================================================================
echo ----------------------------- >> %LOG%
echo Script started: %DATE% %TIME% >> %LOG%

for /f "skip=1 tokens=1,2,3,4,5,6,7" %%a in ('query user') do (
    if "%%d"=="Active" (
        echo Found active user: %%a with session ID %%c >> %LOG%
        echo Attempting to install: %PRINTER% >> %LOG%

        echo Calling rundll32... >> %LOG%
        rundll32 printui.dll,PrintUIEntry /in /n "%PRINTER%" >> %LOG% 2>&1

        echo rundll32 finished with errorlevel %ERRORLEVEL% >> %LOG%
        goto end
    )
)

echo No active session found >> %LOG%

:end
echo Script finished: %DATE% %TIME% >> %LOG%
endlocal
timeout /t 10 >nul
"@

Write-Host "`n--- Creating local .cmd file ---"
if (-not (Test-Path $PSTempPath -PathType Container)) {
    try {
        New-Item -Path $PSTempPath -ItemType Directory -ErrorAction Stop | Out-Null
        Write-Host "Created local temporary directory: $PSTempPath"
    } catch {
        Write-Error "Failed to create local temporary directory: $PSTempPath. Error: $($_.Exception.Message)"
        exit 1
    }
}

try {
    $cmdContent | Set-Content -Path $cmdFilePathLocal -Encoding UTF8 -Force
    Write-Host "Local .cmd file created at: $cmdFilePathLocal" -ForegroundColor Green
} catch {
    Write-Error "Failed to create local .cmd file. Error: $($_.Exception.Message)"
    exit 1
}

# --- Transfer file to remote computer ---
$remoteTempPath = "C:\TEMP"
$remoteCmdFilePath = Join-Path -Path $remoteTempPath -ChildPath $cmdFileName
$remoteSharePathForCopy = "\\$remoteComputerName\$($remoteTempPath.Replace(':', '$'))"

Write-Host "`n--- Transferring .cmd file to remote computer ---"

$basePsExecArgs = @(
    "\\$remoteComputerName",
    "cmd.exe"
)

try {
    Write-Host "Checking/creating remote temp directory: $remoteTempPath"
    $psExecMkdirArgs = $basePsExecArgs + @("cmd.exe", "/c", "if not exist `"$remoteTempPath`" mkdir `"$remoteTempPath`"")
    Start-Process "psexec.exe" -ArgumentList $psExecMkdirArgs -Wait -NoNewWindow -PassThru | Out-Null

    Copy-Item -Path $cmdFilePathLocal -Destination $remoteSharePathForCopy -Force -ErrorAction Stop
    Write-Host "File '$cmdFileName' transferred to '$remoteComputerName : $remoteTempPath'." -ForegroundColor Green
} catch {
    Write-Error "Failed to transfer file to remote computer. Error: $($_.Exception.Message)"
    exit 1
}

# --- Executing .cmd file on remote computer via Scheduled Task as Active User ---
Write-Host "`n--- Executing .cmd file on remote computer via Scheduled Task (Active User) ---"

Write-Host "`n--- Executing .cmd file on remote computer via Scheduled Task (Active User) ---"

# Query active session and username
$queryUserOutput = query user /server:$remoteComputerName 2>&1 | Out-String
if ($queryUserOutput -match 'No User exists for \*') {
    Write-Host "❌ Failed to retrieve sessions from $remoteComputerName or no users logged on." -ForegroundColor Red
    Write-Host "Output: $queryUserOutput"
    exit 1
}
if ($queryUserOutput -notmatch "USERNAME") { # Check for header
    Write-Host "❌ Failed to retrieve valid session information from $remoteComputerName." -ForegroundColor Red
    Write-Host "Output: $queryUserOutput"
    exit 1
}
Write-Host "`nSession information for ${remoteComputerName}:" -ForegroundColor Cyan
Write-Host $queryUserOutput

$userName = $null
$sessionId = $null

# Iterate over lines to find a suitable active user.
# Regex: Username (optional >), Session Name, ID, State (Active), Idle, Logon Time
foreach ($line in ($queryUserOutput -split '[ \t]*\r?\n[ \t]*')) { # Split by lines, trim whitespace around lines
    if ($line -match '^\s*(>?\S+)\s+(\S+)\s+(\d+)\s+Active\s+') {
        $potentialUserName = $matches[1] -replace '^>', '' # Remove leading >
        $potentialSessionName = $matches[2]
        $potentialSessionId = $matches[3]

        # Prioritize console session, otherwise take the first active one found
        if ($potentialSessionName -eq 'console') {
            $userName = $potentialUserName
            $sessionId = $potentialSessionId
            break
        } elseif (-not $userName) { # If no console session found yet, take this one
            $userName = $potentialUserName
            $sessionId = $potentialSessionId
        }
    }
}
if (-not $userName) {
    Write-Host "❌ No suitable active user session found on $remoteComputerName." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Found active user: $userName (Session ID: $sessionId)" -ForegroundColor Green


# Create and run scheduled task as the active user
$taskName = "TempPrinterTask_$([guid]::NewGuid().ToString('N'))"
$startTime = (Get-Date).AddMinutes(1).ToString("HH:mm")
$taskRunUser = $userName # Use the extracted username

# PowerShell commands to be encoded and run remotely
# Using $taskRunUser which is the clean username.
# SCHTASKS should be able to resolve this for /ru with /it.
$powerShellCommandsToEncode = @"
`$ProgressPreference = 'SilentlyContinue' # Suppress "Preparing modules" progress output

& schtasks.exe /create /tn "$taskName" /tr "$remoteCmdFilePath" /sc ONCE /st "$startTime" /ru "$taskRunUser" /f /it /rl LIMITED
if (`$LASTEXITCODE -ne 0) {
    Write-Output "WARNING: Remote: Failed to create scheduled task '$taskName' for user '$taskRunUser'. SCHTASKS Exit Code: `$LASTEXITCODE"
} else {
    Write-Output "INFO: Remote: Task '$taskName' created successfully for user '$taskRunUser'."
    & schtasks.exe /run /tn "$taskName"
    if (`$LASTEXITCODE -ne 0) {
        Write-Output "WARNING: Remote: Failed to run scheduled task '$taskName'. SCHTASKS Exit Code: `$LASTEXITCODE"
    } else {
        Write-Output "INFO: Remote: Task '$taskName' triggered. Waiting 15 seconds for .cmd execution..."
        Start-Sleep -Seconds 15 # PowerShell equivalent of timeout, and avoids redirection issues
    }
}

Write-Output "INFO: Remote: Cleaning up task '$taskName'."
& schtasks.exe /delete /tn "$taskName" /f
if (`$LASTEXITCODE -ne 0) {
    Write-Output "WARNING: Remote: Failed to delete scheduled task '$taskName'. SCHTASKS Exit Code: `$LASTEXITCODE (This may be normal if creation failed)."
} else {
    Write-Output "INFO: Remote: Task '$taskName' deleted."
}
"@

# Invoke the scheduled task creation remotely with PsExec
$encodedScript = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($powerShellCommandsToEncode))

$psexecArgs = "\\$remoteComputerName", "powershell.exe", "-NoProfile", "-EncodedCommand", $encodedScript

Write-Host "`n--- Running scheduled task remotely ---"
$psexecProcess = Start-Process -FilePath $PsExecPath -ArgumentList $psexecArgs -Wait -PassThru -NoNewWindow
if ($psexecProcess.ExitCode -eq 0) {
    Write-Host "✅ Remote PowerShell script for printer task executed on $remoteComputerName for user $userName. Check remote output/logs for details." -ForegroundColor Green
} else {
    Write-Warning "Remote PowerShell script execution via PsExec failed with exit code $($psexecProcess.ExitCode). This indicates an error within the PowerShell script itself or its ability to launch."
 }
 
 # --- Cleanup local and remote files ---
Write-Host "`n--- Waiting 5 seconds before cleanup ---"
Start-Sleep -Seconds 5

Write-Host "--- Deleting .cmd file from remote computer ---"
try {
    $deleteRemoteArgs = "\\$remoteComputerName", "cmd.exe", "/c", "del /f /q `"$remoteCmdFilePath`""
    Start-Process -FilePath $PsExecPath -ArgumentList $deleteRemoteArgs -Wait -NoNewWindow | Out-Null
    Write-Host "File '$cmdFileName' deleted from remote computer." -ForegroundColor Green
} catch {
    Write-Warning "Failed to delete .cmd file from remote computer: $($_.Exception.Message)"
}

Write-Host "`nScript finished."
