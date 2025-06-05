<#
.SYNOPSIS
    Maps a network drive on a remote PC for a specific logged-in user using a batch file.
.DESCRIPTION
    Creates a batch file, copies it to the remote computer's user temp directory, and executes it in the user's session.
    The batch file will only affect the currently logged-in user who executes it.
.NOTES
    Requires PsExec to be available in PATH and administrative privileges.
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
        
        foreach ($drive in $mappedDrives) {
            if ($drive -match $sharePath.Replace('\', '\\')) {
                return $true
            }
        }
        return $false
    }
    catch {
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

# Check if we got valid session information (look for USERNAME header)
if ($queryOutput -notmatch "USERNAME") {
    Write-Host "❌ Failed to retrieve sessions from $remotePC. Error: $queryOutput" -ForegroundColor Red
    exit 1
}

Write-Host "`nSession information for ${remotePC}:" -ForegroundColor Cyan
Write-Host $queryOutput

# Prompt for session ID
$selectedSession = Read-Host "Enter the session ID to use (e.g. 1)"

# Get the username for the selected session
$userName = Get-UserNameFromSession -remotePC $remotePC -sessionId $selectedSession
if (-not $userName) {
    Write-Host "❌ Could not determine username for session ID $selectedSession" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Found user: $userName for session ID $selectedSession" -ForegroundColor Green

# Get used drive letters and display them
$usedLetters = Get-UsedDriveLetters -remotePC $remotePC
if ($usedLetters) {
    Write-Host "`nUsed drive letters (do not select): " -NoNewline -ForegroundColor Cyan
    Write-Host ($usedLetters -join ' ') -ForegroundColor Red
} else {
    Write-Host "`nNo drive letters currently in use." -ForegroundColor Cyan
}

do {
    $driveLetter = Read-Host "Enter the drive letter to use (e.g. Z)"
    if ($usedLetters -contains $driveLetter.ToUpper()) {
        Write-Host "❌ Drive letter $($driveLetter.ToUpper()) is already in use. Please choose a different letter." -ForegroundColor Red
    }
} while ($usedLetters -contains $driveLetter.ToUpper())

# Extract share name for shortcut
$shareName = Split-Path $sharePath -Leaf

# Create CMD file content (using .cmd instead of .bat)
$cmdContent = @"
@echo off
color 0f
mode con cols=80
mode con lines=25
cls
echo.
echo =========================================================================
echo   NETWORK DRIVE MAPPING UTILITY
echo =========================================================================
echo.
echo   Computer: $remotePC
echo   User: $userName
echo   Drive Letter: ${driveLetter}:
echo   Network Path: $sharePath
echo.
echo =========================================================================
echo   Mapping network drive, please wait...
echo =========================================================================
echo.

REM Check if already mapped to this drive letter
net use ${driveLetter}: >nul 2>&1
if %errorlevel% equ 0 (
    color 4f
    cls
    echo.
    echo =========================================================================
    echo   ERROR - Drive letter ${driveLetter}: is already in use
    echo =========================================================================
    echo.
    echo   Please choose a different drive letter.
    echo.
    echo =========================================================================
    echo   This window will close automatically in 10 seconds...
    echo =========================================================================
    timeout /t 10 /nobreak >nul
    del /f /q "%~f0" >nul 2>&1
    exit /b 1
)

net use ${driveLetter}: "$sharePath" /persistent:yes
set MAPPING_RESULT=%errorlevel%
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
    echo   Drive ${driveLetter}: is now mapped to:
    echo   $sharePath
    echo.
    echo   The mapping will persist after restart.
    echo.
    
    REM Create desktop shortcut if it doesn't exist
    set DESKTOP=%USERPROFILE%\Desktop
    set SHORTCUT_NAME=${shareName}_${driveLetter}
    if not exist "%DESKTOP%\%SHORTCUT_NAME%.lnk" (
        echo   Creating desktop shortcut...
        powershell -ExecutionPolicy Bypass -Command "try { `$WshShell = New-Object -comObject WScript.Shell; `$Shortcut = `$WshShell.CreateShortcut('%DESKTOP%\%SHORTCUT_NAME%.lnk'); `$Shortcut.TargetPath = '${driveLetter}:\'; `$Shortcut.Save(); Write-Host 'Shortcut created successfully' } catch { Write-Host 'Error creating shortcut: ' `$_.Exception.Message }"
        echo   Desktop shortcut created successfully.
    ) else (
        echo   Desktop shortcut already exists.
    )
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
del /f /q "%~f0" >nul 2>&1
"@

# Create temporary CMD file locally
$tempCmdFile = "$env:TEMP\MapDrive_$driveLetter.cmd"
$userTempPath = "\\$remotePC\C$\Users\$userName\AppData\Local\Temp"
$remoteCmdFile = "$userTempPath\MapDrive_$driveLetter.cmd"
$desktopCmdFile = "\\$remotePC\C$\Users\$userName\Desktop\MapDrive_$driveLetter.cmd"

try {
    # Write CMD file locally first
    $cmdContent | Out-File -FilePath $tempCmdFile -Encoding ASCII
    
    # Copy CMD file to remote user's temp directory
    Write-Host "`n📋 Copying CMD file to user's temp directory on remote computer..." -ForegroundColor Cyan
    Copy-Item -Path $tempCmdFile -Destination $remoteCmdFile -Force
    
    # Also copy to user's desktop for easy manual access
    Write-Host "📋 Creating backup copy on user's desktop..." -ForegroundColor Cyan
    try {
        Copy-Item -Path $tempCmdFile -Destination $desktopCmdFile -Force
    }
    catch {
        Write-Host "⚠️  Could not copy to desktop - user may need to use temp location if manual execution is needed" -ForegroundColor Yellow
    }
    
    # Execute CMD file on remote computer in user session (REMOVED -s flag to run in user context)
    Write-Host "`n🚀 Executing drive mapping on $remotePC for user $userName (session ID $selectedSession)..." -ForegroundColor Cyan
    
    $psexecArgs = @(
        "\\$remotePC",
        "-h",
        "-i",
        $selectedSession,
        "cmd",
        "/c",
        "C:\Users\$userName\AppData\Local\Temp\MapDrive_$driveLetter.cmd"
    )
    
    $result = Start-Process "psexec.exe" -ArgumentList $psexecArgs -Wait -NoNewWindow -PassThru
    
    if ($result.ExitCode -eq 0) {
        Write-Host "✅ CMD file executed successfully." -ForegroundColor Green
        Write-Host "💡 The user should have seen a window showing the mapping result." -ForegroundColor Yellow
        Write-Host "🔗 A desktop shortcut should have been created automatically if mapping succeeded." -ForegroundColor Green
    }
    else {
        Write-Host "❌ PsExec failed with exit code: $($result.ExitCode)" -ForegroundColor Red
        Write-Host "💡 The user can manually run the script from:" -ForegroundColor Yellow
        Write-Host "   Desktop: C:\Users\$userName\Desktop\MapDrive_$driveLetter.cmd" -ForegroundColor White
    }
}
catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    # Clean up local temp file
    if (Test-Path $tempCmdFile) { Remove-Item $tempCmdFile -Force }
}

Write-Host "`n💡 The drive mapping will only affect user $userName in session $selectedSession." -ForegroundColor Cyan
Write-Host "💡 Other users on the same computer will not see this mapped drive." -ForegroundColor Cyan
Write-Host "`n🔧 If manual execution is needed, the script is available on the user's desktop." -ForegroundColor Yellow