<#
.SYNOPSIS
    Browser management functions for Asset Control
.DESCRIPTION
    Provides functions for browser cache clearing, bookmark management, and file associations
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: Administrative privileges on target systems, PsExec for remote operations
#>

<#
.SYNOPSIS
    Clear browser cache and data on remote computer
.DESCRIPTION
    Clears cache, cookies, and browsing data for various browsers on remote computer
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to clear browser data on
.EXAMPLE
    Clear-BrowserCache -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Uses Clear-BrowserCacheRemote function if available, otherwise provides manual instructions
#>
function Clear-BrowserCache {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Clearing browser cache on computer: $computerName (requested by: $userId)"

    Write-Host "Browser Cache Clearing for '$computerName'" -ForegroundColor Cyan
    Write-Host "=" * 50 -ForegroundColor Gray

    # Prompt for browser selection
    Write-Host "`nSelect browser to clear:" -ForegroundColor Yellow
    Write-Host "1. Internet Explorer"
    Write-Host "2. Google Chrome"
    Write-Host "3. Microsoft Edge"
    Write-Host "4. All browsers"
    Write-Host "0. Cancel"

    $browserChoice = Read-Host "Enter your choice (1-4, 0 to cancel)"

    $browserMap = @{
        "1" = "IE"
        "2" = "Chrome"
        "3" = "Edge"
        "4" = "All"
    }

    if ($browserChoice -eq "0") {
        Write-Host "Browser cache clear operation cancelled." -ForegroundColor Yellow
        Read-Host "Press Enter to continue"
        return
    }

    $browserName = $browserMap[$browserChoice]
    if (-not $browserName) {
        Write-Host "Invalid choice. Operation cancelled." -ForegroundColor Red
        Read-Host "Press Enter to continue"
        return
    }

    Write-Host "`nClearing $browserName browser data on '$computerName'..." -ForegroundColor Cyan

    try {
        # Check if the Clear-BrowserCacheRemote function exists (from legacy system)
        if (Get-Command "Clear-BrowserCacheRemote" -ErrorAction SilentlyContinue) {
            Write-Debug "Using existing Clear-BrowserCacheRemote function"
            Clear-BrowserCacheRemote -userID $userId -computer $computerName -browser $browserName
        } else {
            # Implement browser clearing logic directly
            Write-Debug "Using direct browser clearing implementation"
            Clear-BrowserDataDirect -userId $userId -computerName $computerName -browserName $browserName
        }

        # Log the browser clear action
        if ($script:logFilePath) {
            $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId cleared $browserName browser data on $computerName"
            Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
        }

    } catch {
        Write-Host "Error clearing browser data: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception clearing browser data: $($_.Exception)"
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Direct browser data clearing implementation
.DESCRIPTION
    Clears browser data using direct file system operations
.PARAMETER userId
    The user ID context
.PARAMETER computerName
    Target computer name
.PARAMETER browserName
    Browser to clear (IE, Chrome, Edge, All)
#>
function Clear-BrowserDataDirect {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName,
        
        [Parameter(Mandatory=$true)]
        [string]$browserName
    )

    $clearCommands = @()

    switch ($browserName) {
        "IE" {
            $clearCommands += @(
                "RunDll32.exe InetCpl.cpl,ClearMyTracksByProcess 1",  # Temporary Internet Files
                "RunDll32.exe InetCpl.cpl,ClearMyTracksByProcess 2",  # Cookies
                "RunDll32.exe InetCpl.cpl,ClearMyTracksByProcess 8",  # History
                "RunDll32.exe InetCpl.cpl,ClearMyTracksByProcess 16", # Form Data
                "RunDll32.exe InetCpl.cpl,ClearMyTracksByProcess 32"  # Passwords
            )
        }
        "Chrome" {
            $chromeDataPath = "C:\Users\$userId\AppData\Local\Google\Chrome\User Data\Default"
            $clearCommands += @(
                "taskkill /F /IM chrome.exe /T 2>nul",
                "timeout /T 3 /NOBREAK >nul",
                "del `"$chromeDataPath\Cache\*.*`" /Q /S 2>nul",
                "del `"$chromeDataPath\Cookies`" /Q 2>nul",
                "del `"$chromeDataPath\History`" /Q 2>nul",
                "del `"$chromeDataPath\Web Data`" /Q 2>nul"
            )
        }
        "Edge" {
            $edgeDataPath = "C:\Users\$userId\AppData\Local\Microsoft\Edge\User Data\Default"
            $clearCommands += @(
                "taskkill /F /IM msedge.exe /T 2>nul",
                "timeout /T 3 /NOBREAK >nul",
                "del `"$edgeDataPath\Cache\*.*`" /Q /S 2>nul",
                "del `"$edgeDataPath\Cookies`" /Q 2>nul",
                "del `"$edgeDataPath\History`" /Q 2>nul",
                "del `"$edgeDataPath\Web Data`" /Q 2>nul"
            )
        }
        "All" {
            # Recursively call for each browser
            Clear-BrowserDataDirect -userId $userId -computerName $computerName -browserName "IE"
            Clear-BrowserDataDirect -userId $userId -computerName $computerName -browserName "Chrome"
            Clear-BrowserDataDirect -userId $userId -computerName $computerName -browserName "Edge"
            return
        }
    }

    # Execute commands via PsExec
    foreach ($command in $clearCommands) {
        try {
            Write-Host "Executing: $command" -ForegroundColor Gray
            $result = psexec \\$computerName cmd /c $command 2>&1
            Write-Debug "Command result: $result"
        } catch {
            Write-Warning "Command failed: $command - $($_.Exception.Message)"
        }
    }

    Write-Host "$browserName browser data cleared successfully" -ForegroundColor Green
}

<#
.SYNOPSIS
    Copy browser bookmarks from remote computer
.DESCRIPTION
    Backs up browser bookmarks to various destinations
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to copy bookmarks from
.EXAMPLE
    Copy-BrowserBookmarks -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Supports Chrome and Edge bookmarks, multiple destination options
#>
function Copy-BrowserBookmarks {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Copying browser bookmarks from computer: $computerName (requested by: $userId)"

    Write-Host "Browser Bookmark Copy for '$computerName'" -ForegroundColor Cyan
    Write-Host "=" * 50 -ForegroundColor Gray

    # Browser selection
    Write-Host "`nSelect browser to copy bookmarks from:" -ForegroundColor Yellow
    Write-Host "1. Google Chrome"
    Write-Host "2. Microsoft Edge"
    Write-Host "3. Both browsers"
    Write-Host "0. Cancel"

    $browserChoice = Read-Host "Enter your choice (1-3, 0 to cancel)"

    if ($browserChoice -eq "0") {
        Write-Host "Bookmark copy operation cancelled." -ForegroundColor Yellow
        Read-Host "Press Enter to continue"
        return
    }

    # Destination selection
    Write-Host "`nSelect destination:" -ForegroundColor Yellow
    Write-Host "1. User's Desktop (on same computer)"
    Write-Host "2. User's Home Share"
    Write-Host "3. Different computer"
    Write-Host "0. Cancel"

    $destinationChoice = Read-Host "Enter your choice (1-3, 0 to cancel)"

    if ($destinationChoice -eq "0") {
        Write-Host "Bookmark copy operation cancelled." -ForegroundColor Yellow
        Read-Host "Press Enter to continue"
        return
    }

    try {
        # Get AD user info for home directory if needed
        $adUser = $null
        if ($destinationChoice -eq "2") {
            $adUser = Get-ADUser -Identity $userId -Properties HomeDirectory -ErrorAction Stop
            if (-not $adUser.HomeDirectory) {
                Write-Host "User home directory not configured in AD." -ForegroundColor Red
                Read-Host "Press Enter to continue"
                return
            }
        }

        # Process bookmark copying based on selections
        switch ($browserChoice) {
            "1" { Copy-ChromeBookmarks -userId $userId -computerName $computerName -destinationChoice $destinationChoice -adUser $adUser }
            "2" { Copy-EdgeBookmarks -userId $userId -computerName $computerName -destinationChoice $destinationChoice -adUser $adUser }
            "3" { 
                Copy-ChromeBookmarks -userId $userId -computerName $computerName -destinationChoice $destinationChoice -adUser $adUser
                Copy-EdgeBookmarks -userId $userId -computerName $computerName -destinationChoice $destinationChoice -adUser $adUser
            }
            default {
                Write-Host "Invalid browser choice." -ForegroundColor Red
            }
        }

        # Log the bookmark copy action
        if ($script:logFilePath) {
            $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId copied browser bookmarks from $computerName"
            Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
        }

    } catch {
        Write-Host "Error copying bookmarks: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception copying bookmarks: $($_.Exception)"
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Copy Chrome bookmarks helper function
.DESCRIPTION
    Handles Chrome-specific bookmark copying logic
#>
function Copy-ChromeBookmarks {
    param($userId, $computerName, $destinationChoice, $adUser)
    
    $sourcePath = "\\$computerName\c$\Users\$userId\AppData\Local\Google\Chrome\User Data\Default\Bookmarks"
    
    if (-not (Test-Path $sourcePath)) {
        Write-Host "Chrome bookmarks not found at: $sourcePath" -ForegroundColor Yellow
        return
    }

    $destinationPath = switch ($destinationChoice) {
        "1" { "\\$computerName\c$\Users\$userId\Desktop\ChromeBookmarks_$(Get-Date -Format 'yyyyMMdd_HHmmss')" }
        "2" { "$($adUser.HomeDirectory)\ChromeBookmarks_$(Get-Date -Format 'yyyyMMdd_HHmmss')" }
        "3" { 
            $destComputer = Read-Host "Enter destination computer name"
            "\\$destComputer\c$\Users\$userId\Desktop\ChromeBookmarks_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        }
    }

    Copy-Item -Path $sourcePath -Destination $destinationPath -ErrorAction Stop
    Write-Host "Chrome bookmarks copied to: $destinationPath" -ForegroundColor Green
}

<#
.SYNOPSIS
    Copy Edge bookmarks helper function
.DESCRIPTION
    Handles Edge-specific bookmark copying logic
#>
function Copy-EdgeBookmarks {
    param($userId, $computerName, $destinationChoice, $adUser)
    
    $sourcePath = "\\$computerName\c$\Users\$userId\AppData\Local\Microsoft\Edge\User Data\Default\Bookmarks"
    
    if (-not (Test-Path $sourcePath)) {
        Write-Host "Edge bookmarks not found at: $sourcePath" -ForegroundColor Yellow
        return
    }

    $destinationPath = switch ($destinationChoice) {
        "1" { "\\$computerName\c$\Users\$userId\Desktop\EdgeBookmarks_$(Get-Date -Format 'yyyyMMdd_HHmmss')" }
        "2" { "$($adUser.HomeDirectory)\EdgeBookmarks_$(Get-Date -Format 'yyyyMMdd_HHmmss')" }
        "3" { 
            $destComputer = Read-Host "Enter destination computer name"
            "\\$destComputer\c$\Users\$userId\Desktop\EdgeBookmarks_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        }
    }

    Copy-Item -Path $sourcePath -Destination $destinationPath -ErrorAction Stop
    Write-Host "Edge bookmarks copied to: $destinationPath" -ForegroundColor Green
}

<#
.SYNOPSIS
    Set default PDF application to Adobe on remote computer
.DESCRIPTION
    Configures Windows file associations to use Adobe Acrobat as default PDF handler
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to configure PDF association on
.EXAMPLE
    Set-DefaultPDFApplication -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Requires Adobe Acrobat to be installed on target computer
#>
function Set-DefaultPDFApplication {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Setting default PDF application on computer: $computerName (requested by: $userId)"

    Write-Host "Setting Adobe Acrobat as default PDF application on '$computerName'..." -ForegroundColor Cyan

    try {
        # Define the file association commands
        $associationCommand = 'assoc .pdf=Acrobat.Document.DC'
        $ftypeCommand = 'ftype Acrobat.Document.DC="C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe" "%1"'
        
        Write-Host "Executing file association commands..." -ForegroundColor Yellow
        
        # Execute commands via PsExec
        Write-Host "1. Setting PDF file association..." -ForegroundColor Gray
        $assocResult = psexec.exe \\$computerName cmd.exe /c $associationCommand 2>&1
        Write-Debug "Association result: $assocResult"
        
        Write-Host "2. Setting file type handler..." -ForegroundColor Gray
        $ftypeResult = psexec.exe \\$computerName cmd.exe /c $ftypeCommand 2>&1
        Write-Debug "File type result: $ftypeResult"
        
        # Check if commands were successful
        if ($assocResult -match '.pdf=Acrobat.Document.DC' -and $ftypeResult -match 'Acrobat.Document.DC=') {
            Write-Host "Successfully set Adobe Acrobat as default PDF application on '$computerName'" -ForegroundColor Green
            
            # Log the PDF application change
            if ($script:logFilePath) {
                $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId set default PDF application to Adobe on $computerName"
                Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
            }
        } else {
            throw "Failed to verify file association changes"
        }
        
    } catch {
        Write-Host "Error setting default PDF application: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception setting PDF application: $($_.Exception)"
        
        Write-Host "`nTroubleshooting suggestions:" -ForegroundColor Yellow
        Write-Host "- Verify Adobe Acrobat DC is installed on target computer" -ForegroundColor Gray
        Write-Host "- Check installation path: C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe" -ForegroundColor Gray
        Write-Host "- Ensure administrative privileges on target computer" -ForegroundColor Gray
        Write-Host "- Try running the commands manually on the target computer" -ForegroundColor Gray
    }

    Read-Host "Press Enter to continue"
}