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

# Prompt inputs
$remotePC = Read-Host "Enter the remote computer name"
$sharePath = Read-Host "Enter the network folder to map (e.g. \\server\share)"

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

try {
    # Write CMD file locally first
    $cmdContent | Out-File -FilePath $tempCmdFile -Encoding ASCII
    
    # Copy CMD file to remote user's temp directory
    Write-Host "`n📋 Copying CMD file to user's temp directory on remote computer..." -ForegroundColor Cyan
    Copy-Item -Path $tempCmdFile -Destination $remoteCmdFile -Force
    
    # Execute CMD file on remote computer in user session (using same flags as CMS deploy)
    Write-Host "`n🚀 Executing drive mapping on $remotePC for user $userName (session ID $selectedSession)..." -ForegroundColor Cyan
    
    $psexecArgs = @(
        "\\$remotePC",
        "-h",
        "-i",
        "-s",
        "cmd",
        "/c",
        "start",
        "C:\Users\$userName\AppData\Local\Temp\MapDrive_$driveLetter.cmd"
    )
    
    $result = Start-Process "psexec.exe" -ArgumentList $psexecArgs -Wait -NoNewWindow -PassThru
    
    if ($result.ExitCode -eq 0) {
        Write-Host "✅ CMD file executed successfully." -ForegroundColor Green
        Write-Host "💡 The user should have seen a window showing the mapping result." -ForegroundColor Yellow
    }
    else {
        Write-Host "❌ PsExec failed with exit code: $($result.ExitCode)" -ForegroundColor Red
        Write-Host "💡 The user may need to run the CMD file manually." -ForegroundColor Yellow
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
Write-Host "`n🔧 If the mapping failed, the user can manually run:" -ForegroundColor Yellow
Write-Host "   C:\Users\$userName\AppData\Local\Temp\MapDrive_$driveLetter.cmd" -ForegroundColor White