$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf
Set-ExecutionPolicy -ExecutionPolicy Undefined -Scope CurrentUser

Write-Host "Enable debugging? Default false. (y/n):" -NoNewline
$debugChoice = Read-Host

if ($debugChoice -eq 'Y' -or $debugChoice -eq 'y') {
    $debugging = $true
    Write-Host "Debugging is enabled" -ForegroundColor Green
} else {
    $debugging = $false
    Write-Host "Debugging is disabled" -ForegroundColor DarkGray
}

# Import required modules
Import-Module ActiveDirectory

# Get the current domain and enviroment type
try {
    Write-Host "Checking if powershell AD Module is enabled..." -ForegroundColor Yellow
    $currentDomain = (Get-ADDomain -ErrorAction SilentlyContinue -WarningAction SilentlyContinue).DNSRoot
    $env:CommandType = "Power"
    $powershell = $true
    $WMI = $false
} catch {
    try {
        $currentDomain = (Get-WmiObject -Class Win32_ComputerSystem).Domain
        $env:CommandType = "WMI"
        $powershell = $false
        $WMI = $true
    } catch {
        Write-Host "Error getting domain. Due to restrictive environment this script is unable to perform. Press any key to exit." -ForegroundColor Red
        $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit
    }
}

Write-Host "Current domain: $currentDomain"

# Environment type
if ($powershell) {
    Write-Host "Powershell Commands: Enabled" -ForegroundColor Green
} else {
    Write-Host "Powershell Commands: Disabled" -ForegroundColor DarkGray
}

if ($wmi) {
    Write-Host "WMI Commands: Enabled" -ForegroundColor Red
} else {
    Write-Host "WMI Commands: Disabled" -ForegroundColor DarkGray
}

# Get the current user with specific properties
try {
    # Assign the USERNAME environment variable to $AdminUser
    $AdminUser = $env:USERNAME
} catch {
    Write-Host "Error getting user. Setting default AdminUserID to 404."
    $AdminUser = New-Object PSObject -Property @{
        SamAccountName = 404
        Name = "Unknown"
    }
}

# Initialize variables hashtable
$envVars = @{}
$UserVars = @{}

# Import functions from functions directory
. .\functions\Asset-Control.ps1
. .\functions\Add-NetworkPrinter.ps1
. .\functions\ADUserProp.ps1
. .\functions\Get-UserId.ps1
. .\functions\Invoke-SCCMRemoteTool.ps1
. .\functions\Main-Loop.ps1
. .\functions\Remove-UserId.ps1
. .\functions\Set-TempPassword.ps1
. .\functions\Show-LastLogEntries.ps1
. .\functions\Test-DomainControllers.ps1
. .\functions\Unlock-ADAccountOnAllDomainControllers.ps1
. .\functions\Clear-Browsers.ps1

# Create env.ps1 file if missing and test domain controllers
if (-not (Test-Path ".\.env\.env_$currentDomain.ps1")) {
    Test-DomainControllers
}

# Import variables from env.ps1 file
. .\.env\.env_$currentDomain.ps1

function SetGlobalVariable {
    $global:AdminConfig = ".\.env_$env:USERNAME.ps1"
}

# Check if the .env_$AdminConfig.ps1 file exists
$AdminConfig = ".\.env\.env_$env:USERNAME.ps1"
if (Test-Path $AdminConfig) {
    Write-Host "Admin config exists. " -NoNewline; Write-Host "Imported." -ForegroundColor Green
    . $AdminConfig


    # Check if 'tempPassword' key in $envVars is null
    if ($null -eq $envVars['tempPassword']) {
        $envVars['tempPassword'] = Set-TempPassword
    }

    # Check if 'logFilePath' key in $envVars is null
    if ($null -eq $envVars['logFileBasePath']) {
        $envVars['logFileBasePath'] = Read-Host "Log Path not set. Enter Log Path or leave blank to disable log parsing."
    }

    # Set 'logPathBoolean' key in $envVars
    $envVars['logPathBoolean'] = $null -ne $envVars['logFileBasePath'] -and $envVars['logFileBasePath'] -ne ""

    # Convert the updated hashtable to a list of strings
    $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = `"$($_.Value)`"" })
    # Write the updated environmental variables to the $AdminConfig file
    Set-Content -Path "$AdminConfig" -Value $envVarsList
} else {
    Write-Host "Admin Config does not exist. Creating."
    New-Item -Path $AdminConfig -ItemType File | Out-Null

    # Check if 'logFilePath' key in $envVars is null
    if ($null -eq $envVars['logFileBasePath']) {
        $envVars['logFileBasePath'] = Read-Host "Log Path not set. Enter Log Path or leave blank to disable log parsing."
    }

    # Set 'logPathBoolean' key in $envVars
    $envVars['logPathBoolean'] = $null -ne $envVars['logFileBasePath'] -and $envVars['logFileBasePath'] -ne "" -as [bool]

    # Set 'tempPassword' and 'logFilePath' keys in $envVars
    $envVars = @{
        tempPassword = Set-TempPassword
        logFilePath = $envVars['logFileBasePath']
        UserID = $null
        logPathBoolean = $envVars['logPathBoolean']
    }
    # Convert the hashtable to a list of strings
    $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = `"$($_.Value)`"" })
    # Write the environmental variables to the $AdminConfig file
    Set-Content -Path "$AdminConfig" -Value $envVarsList
}

# Create a hashtable to store the environmental variables
$envVars = @{
    tempPassword = $envVars['tempPassword']
    logFileBasePath = $envVars['logFileBasePath']
    UserID = $null
    logPathBoolean = $null -ne $envVars['logFileBasePath'] -and $envVars['logFileBasePath'] -ne ""
}

Write-Host "Admin User: " -NoNewline; Write-Host "$env:USERNAME" -ForegroundColor Cyan
Write-Host "Temp Password: " -NoNewline; Write-Host "$($envVars['tempPassword'])" -ForegroundColor Yellow
Write-Host "Logfile Path: " -NoNewline; Write-Host "$($envVars['logFileBasePath'])" -ForegroundColor Yellow

Write-Host "Enable panes? Default false. (y/n):" -NoNewline
$paneChoice = Read-Host

if ($paneChoice -eq 'Y' -or $paneChoice -eq 'y') {
    $panesEnabled = $true
} else {
    $panesEnabled = $false
}

if ($panesEnabled) {
    Write-Host "Panes: Enabled" -ForegroundColor Green
    Write-Host "Select a function to run in the pane:"
    Write-Host "1. Asset-Control"
    Write-Host "2. Add-NetworkPrinter"
    Write-Host "3. ADUserProp"
    Write-Host "4. Get-UserId"
    Write-Host "5. Invoke-SCCMRemoteTool"
    Write-Host "6. Main-Loop"
    Write-Host "7. Remove-UserId"
    Write-Host "8. Set-TempPassword"
    Write-Host "9. Show-LastLogEntries"
    Write-Host "10. Test-DomainControllers"
    Write-Host "11. Unlock-ADAccountOnAllDomainControllers"
    Write-Host "12. Clear-Browsers"
    Write-Host "13. Exit"

    $functionChoice = Read-Host

    $AssetControl = $false
    $AddNetworkPrinter = $false
    $ADUserProp = $false
    $GetUserId = $false
    $InvokeSCCMRemoteTool = $false
    $MainLoop = $false
    $RemoveUserId = $false
    $SetTempPassword = $false
    $ShowLastLogEntries = $false
    $TestDomainControllers = $false
    $UnlockADAccountOnAllDomainControllers = $false
    $ClearBrowsers = $false

    switch ($functionChoice) {
        '1' { $AssetControl = $true; . .\functions\Asset-Control.ps1 }
        '2' { $AddNetworkPrinter = $true; . .\functions\Add-NetworkPrinter.ps1 }
        '3' { $ADUserProp = $true; . .\functions\ADUserProp.ps1 }
        '4' { $GetUserId = $true; . .\functions\Get-UserId.ps1 }
        '5' { $InvokeSCCMRemoteTool = $true; . .\functions\Invoke-SCCMRemoteTool.ps1 }
        '6' { $MainLoop = $true; . .\functions\Main-Loop.ps1 }
        '7' { $RemoveUserId = $true; . .\functions\Remove-UserId.ps1 }
        '8' { $SetTempPassword = $true; . .\functions\Set-TempPassword.ps1 }
        '9' { $ShowLastLogEntries = $true; . .\functions\Show-LastLogEntries.ps1 }
        '10' { $TestDomainControllers = $true; . .\functions\Test-DomainControllers.ps1 }
        '11' { $UnlockADAccountOnAllDomainControllers = $true; . .\functions\Unlock-ADAccountOnAllDomainControllers.ps1 }
        '12' { $ClearBrowsers = $true; . .\functions\Clear-Browsers.ps1 }
        '13' { break }
        default {
            Write-Host "Invalid choice. Please select a valid function."
        }
    }
} else {
Write-Host "Panes: Disabled" -ForegroundColor DarkGray
}


# Main loop
while ($true) {
    # Get User ID before entering the main menu
    $envVars['UserID'] = Get-UserId

    # Initialize $logFilePath inside the main loop
    if ($envVars['logPathBoolean']) {
        $logFilePath = $envVars['logFileBasePath'] + $envVars['UserID'] + '.log'
    }


    # Call the main loop function
    Main-Loop
}