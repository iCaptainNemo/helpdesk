<#
.SYNOPSIS
    File system access functions for Asset Control
.DESCRIPTION
    Provides functions for remote file system access and management
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: Network file sharing, administrative privileges
#>

<#
.SYNOPSIS
    Open Windows File Explorer to remote computer's user profile
.DESCRIPTION
    Launches File Explorer with direct access to the user's profile directory
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to access file system on
.EXAMPLE
    Open-RemoteFileExplorer -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Uses UNC path to access remote file system via network shares
#>
function Open-RemoteFileExplorer {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Opening file explorer for user: $userId on computer: $computerName"

    Write-Host "Opening File Explorer for user '$userId' on '$computerName'..." -ForegroundColor Cyan

    try {
        # Construct UNC path to user profile
        $userProfilePath = "\\$computerName\c$\Users\$userId"
        
        Write-Debug "Attempting to access path: $userProfilePath"
        
        # Test if the path is accessible
        Write-Host "Testing access to user profile..." -ForegroundColor Yellow
        if (Test-Path $userProfilePath) {
            Write-Host "User profile directory found" -ForegroundColor Green
            
            # Launch File Explorer
            Write-Host "Launching File Explorer..." -ForegroundColor Cyan
            Invoke-Expression "explorer.exe /e,`"$userProfilePath`""
            
            Write-Host "File Explorer launched successfully" -ForegroundColor Green
            Write-Host "Location: $userProfilePath" -ForegroundColor Gray
            
            # Log the file explorer access
            if ($script:logFilePath) {
                $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId opened file explorer to $computerName\$userId profile"
                Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
            }
            
        } else {
            Write-Host "Cannot access user profile directory" -ForegroundColor Red
            Write-Host "Path: $userProfilePath" -ForegroundColor Gray
            
            # Provide alternative suggestions
            Write-Host "`nAlternative access methods:" -ForegroundColor Yellow
            Write-Host "1. Try accessing C$ share directly:" -ForegroundColor White
            Write-Host "   \\$computerName\c$" -ForegroundColor Gray
            Write-Host "2. Check if administrative shares are enabled" -ForegroundColor White
            Write-Host "3. Verify network connectivity and permissions" -ForegroundColor White
            
            # Offer to try C$ root access
            $tryRoot = Read-Host "`nWould you like to try opening the C$ root instead? (y/n)"
            if ($tryRoot -eq 'y' -or $tryRoot -eq 'Y') {
                $rootPath = "\\$computerName\c$"
                if (Test-Path $rootPath) {
                    Invoke-Expression "explorer.exe /e,`"$rootPath`""
                    Write-Host "Opened File Explorer to C$ root" -ForegroundColor Green
                } else {
                    Write-Host "Cannot access C$ share either" -ForegroundColor Red
                }
            }
        }

    } catch {
        Write-Host "Error opening File Explorer: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception opening file explorer: $($_.Exception)"
        
        Write-Host "`nTroubleshooting suggestions:" -ForegroundColor Yellow
        Write-Host "- Verify computer is online and accessible" -ForegroundColor Gray
        Write-Host "- Check if administrative shares (C$) are enabled" -ForegroundColor Gray
        Write-Host "- Ensure you have permissions to access the remote computer" -ForegroundColor Gray
        Write-Host "- Verify Windows File Sharing is enabled" -ForegroundColor Gray
        Write-Host "- Check Windows Firewall settings on target computer" -ForegroundColor Gray
    }

    Read-Host "Press Enter to continue"
}