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
# $userID = (Get-ValidatedInput -Prompt "Enter the user ID for Active Directory check (also used for remote AppData path):").Trim()
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
    # try {
    #    Get-ADUser -Identity $userID -ErrorAction Stop | Out-Null
    #   Write-Host "User ID '$userID' found in AD." -ForegroundColor Green} 
    #catch {
    #    Write-Warning "User ID '$userID' NOT found in AD. Continuing."
    #}
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

<#  ---- OPTION 1 -----

$cmdContent = @"
@echo off
echo Attempting to install printer: \\$printServerName\$printerName >> C:\TEMP\printer_install_log.txt 2>&1
rundll32 printui.dll,PrintUIEntry /in /n \\$printServerName\$printerName >> C:\TEMP\printer_install_log.txt 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Error installing printer. Error code: %ERRORLEVEL% >> C:\TEMP\printer_install_log.txt
) ELSE (
    echo Printer installed successfully. >> C:\TEMP\printer_install_log.txt
)
    timeout /t 10 /nobreak
"@
---------------------------------------#>
<# -------- OPTION 2 --------
$cmdContent = @"
@echo off
setlocal

set PRINTER=\\$printServerName\$printerName
set LOG=C:\TEMP\printer_install_log.txt

echo Installing printer for active session: %PRINTER% >> %LOG%

REM Use the active user session and install printer for them
for /f "tokens=3" %%s in ('query user ^| findstr /R /C:"Active"') do (
    echo Found active session ID: %%s >> %LOG%
    tscon %%s /dest:console >nul 2>&1
    rundll32 printui.dll,PrintUIEntry /in /n %PRINTER% >> %LOG% 2>&1
)

if %ERRORLEVEL% NEQ 0 (
    echo Printer installation failed with error %ERRORLEVEL% >> %LOG%
) else (
    echo Printer installed successfully. >> %LOG%
)

endlocal
timeout /t 10 >nul
exit /b 0
"@
------------------------------------#>

# Option 3: Install printer for the active user session
$cmdContent = @"
@echo off
setlocal

set PRINTER=\\$printServerName\$printerName
set LOG=C:\TEMP\printer_install_log.txt

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
    #& $PsExecPath $psExecMkdirArgs 2>&1 | Out-Null
    Start-Process "psexec.exe" -ArgumentList $psExecMkdirArgs -Wait -NoNewWindow -PassThru

    Copy-Item -Path $cmdFilePathLocal -Destination $remoteSharePathForCopy -Force -ErrorAction Stop
    Write-Host "File '$cmdFileName' transferred to '$remoteComputerName : $remoteTempPath'." -ForegroundColor Green
} catch {
    Write-Error "Failed to transfer file to remote computer. Error: $($_.Exception.Message)"
    exit 1
}

# --- PsExec Execution ---
Write-Host "`n--- Executing .cmd file on remote computer ---"
try {
    $psExecExecuteArgs = @(
        "\\$remoteComputerName",
        "-i", "1",
        "-h",
        "-s",
        "cmd.exe",
        "/c",
        #"start",
        "`"$remoteCmdFilePath`""  # <-- Proper quoting: this is the only change
    )
    Write-Host "Full PsExec command: $PsExecPath $($psExecExecuteArgs -join ' ')"

    #$psexecOutput = & $PsExecPath $psExecExecuteArgs 2>&1 | Out-String
    #Write-Host "PsExec Output:`n$psexecOutput"
    $result = Start-Process "psexec.exe" -ArgumentList $psExecExecuteArgs -Wait -NoNewWindow -PassThru
    Write-Host "PsExec Output:`n$result"
    Write-Host "Command execution initiated." -ForegroundColor Green
} catch {
    Write-Error "Failed to execute .cmd file via PsExec. Error: $($_.Exception.Message)"
    exit 1
}

# --- Wait and Cleanup ---
Write-Host "`n--- Waiting 5 seconds before cleanup ---"
Start-Sleep -Seconds 5

Write-Host "--- Deleting .cmd file from remote computer ---"
try {
    $psExecDeleteArgs = $basePsExecArgs + @("/c", "del /Q `"$remoteCmdFilePath`"")
    & $PsExecPath $psExecDeleteArgs 2>&1 | Out-Null
    Write-Host "File '$cmdFileName' deleted from remote computer." -ForegroundColor Green
} catch {
    Write-Warning "Failed to delete remote .cmd file. You may need to remove it manually. Error: $($_.Exception.Message)"
}

Write-Host "`nScript finished."
