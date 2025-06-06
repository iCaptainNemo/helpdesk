<#
.SYNOPSIS
    Displays a custom message box on a remote computer for a specific user session.
.DESCRIPTION
    Prompts the user to input the message text, select a background color, specify the remote computer and user session.
    Automatically adjusts text color for sufficient contrast.
    Uses PsExec to launch the message box on the target machine.
.NOTES
    Requires PsExec to be available in PATH and administrative privileges.
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

# Prompt for remote computer name
$remotePC = Read-Host "Enter the remote computer name"

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
$selectedSession = Read-Host "Enter the session ID to use (e.g., 1)"

# Get the username for the selected session
$userName = Get-UserNameFromSession -remotePC $remotePC -sessionId $selectedSession
if (-not $userName) {
    Write-Host "❌ Could not determine username for session ID $selectedSession" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Found user: $userName for session ID $selectedSession" -ForegroundColor Green

# Prompt for message text
$messageText = Read-Host "Enter the message text to display"

# Prompt for background color
Write-Host "`nAvailable background colors:" -ForegroundColor Cyan
Write-Host "0 = Black" -ForegroundColor Black
Write-Host "1 = Blue" -ForegroundColor Blue
Write-Host "2 = Green" -ForegroundColor Green
Write-Host "3 = Aqua" -ForegroundColor Cyan
Write-Host "4 = Red" -ForegroundColor Red
Write-Host "5 = Purple" -ForegroundColor Magenta
Write-Host "6 = Yellow" -ForegroundColor Yellow
Write-Host "7 = White" -ForegroundColor White
Write-Host "8 = Gray" -ForegroundColor DarkGray
Write-Host "9 = Light Blue" -ForegroundColor DarkBlue
Write-Host "A = Light Green" -ForegroundColor DarkGreen
Write-Host "B = Light Aqua" -ForegroundColor DarkCyan
Write-Host "C = Light Red" -ForegroundColor DarkRed
Write-Host "D = Light Purple" -ForegroundColor DarkMagenta
Write-Host "E = Light Yellow" -ForegroundColor DarkYellow
Write-Host "F = Bright White" -ForegroundColor White
$backgroundColor = Read-Host "Enter the background color code (e.g., 0 for black)"

# Automatically adjust text color for sufficient contrast
switch ($backgroundColor.ToUpper()) {
    "0" { $textColor = "F" } # Black background -> Bright White text
    "1" { $textColor = "F" } # Blue background -> Bright White text
    "2" { $textColor = "F" } # Green background -> Bright White text
    "3" { $textColor = "F" } # Aqua background -> Bright White text
    "4" { $textColor = "F" } # Red background -> Bright White text
    "5" { $textColor = "F" } # Purple background -> Bright White text
    "6" { $textColor = "0" } # Yellow background -> Black text
    "7" { $textColor = "0" } # White background -> Black text
    "8" { $textColor = "F" } # Gray background -> Bright White text
    "9" { $textColor = "F" } # Light Blue background -> Bright White text
    "A" { $textColor = "F" } # Light Green background -> Bright White text
    "B" { $textColor = "F" } # Light Aqua background -> Bright White text
    "C" { $textColor = "F" } # Light Red background -> Bright White text
    "D" { $textColor = "F" } # Light Purple background -> Bright White text
    "E" { $textColor = "0" } # Light Yellow background -> Black text
    "F" { $textColor = "0" } # Bright White background -> Black text
    default { $textColor = "F" } # Default to Bright White text
}
$colorCode = "$backgroundColor$textColor"

# Generate the batch file content
$cmdContent = @"
@echo off
color $colorCode
mode con cols=80
mode con lines=10
cls
echo.
echo =========================================================================
echo   $messageText
echo =========================================================================
echo.
echo Press Enter to close this message.
pause >nul
exit
"@

# Create the batch file locally
$tempCmdFile = "$env:TEMP\MessageBox.cmd"
$cmdContent | Out-File -FilePath $tempCmdFile -Encoding ASCII

# Copy the batch file to the remote computer
$userTempPath = "\\$remotePC\C$\Users\$userName\AppData\Local\Temp"
$remoteCmdFile = "$userTempPath\MessageBox.cmd"
Copy-Item -Path $tempCmdFile -Destination $remoteCmdFile -Force

# Execute the batch file on the remote computer using PsExec
Write-Host "`n🚀 Launching message box on $remotePC for session ID $selectedSession..." -ForegroundColor Cyan
$psexecArgs = @(
    "\\$remotePC",
    "-h",
    "-i",
    "-s",  # Added the -s flag for SYSTEM context
    "cmd",
    "/c",
    "start",
    "C:\Users\$userName\AppData\Local\Temp\MessageBox.cmd"
)

$result = Start-Process "psexec.exe" -ArgumentList $psexecArgs -Wait -NoNewWindow -PassThru

if ($result.ExitCode -eq 0) {
    Write-Host "✅ Message box displayed successfully on $remotePC." -ForegroundColor Green
} else {
    Write-Host "❌ Failed to display message box on $remotePC. Exit code: $($result.ExitCode)" -ForegroundColor Red
}

# Clean up the batch file locally and remotely
Remove-Item -Path $tempCmdFile -Force
Invoke-Command -ComputerName $remotePC -ScriptBlock {
    Remove-Item -Path "C:\Users\$userName\AppData\Local\Temp\MessageBox.cmd" -Force -ErrorAction SilentlyContinue
}