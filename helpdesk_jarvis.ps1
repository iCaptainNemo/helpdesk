$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf
Set-ExecutionPolicy -ExecutionPolicy Undefined -Scope CurrentUser

Clear-Host
# Import required modules
Import-Module ActiveDirectory

# Get the current domain
try {
    $currentDomain = (Get-ADDomain -ErrorAction SilentlyContinue -WarningAction SilentlyContinue).DNSRoot
} catch {
    Write-Host "Error getting domain. Setting default domain to 403." -ForegroundColor Red
    $currentDomain = 403
}
Write-Host "Current domain: $currentDomain"

# Get the current user with specific properties
try {
    $AdminUser = Get-ADUser -Identity $env:USERNAME -Properties SamAccountName, Name -ErrorAction SilentlyContinue
} catch {
    Write-Host "Error getting user. Setting default AdminUserID to 404."
    $AdminUser = New-Object PSObject -Property @{
        SamAccountName = 404
        Name = "Unkown"
    }
}

# Initialize $envVars hashtable
$envVars = @{}

# Import functions from functions directory
. .\functions\Asset-Control.ps1
. .\functions\Add-NetworkPrinter.ps1
. .\functions\Test-AssetConnection.ps1
. .\functions\Get-ADUserProperties.ps1
. .\functions\Get-UserId.ps1
. .\functions\Invoke-SCCMRemoteTool.ps1
. .\functions\Main-Loop.ps1
. .\functions\Remove-UserId.ps1
. .\functions\Set-TempPassword.ps1
. .\functions\Show-ADUserProperties.ps1
. .\functions\Show-LastLogEntries.ps1
. .\functions\Test-DomainControllers.ps1
. .\functions\Unlock-ADAccountOnAllDomainControllers.ps1
. .\functions\Clear-Browsers.ps1

# Call the function to create the env.ps1 file
if (-not (Test-Path ".\.env\.env_$currentDomain.ps1")) {
    Test-DomainControllers
}

# Import variables from env.ps1 file
. .\.env\.env_$currentDomain.ps1

function SetGlobalVariable {
    $global:AdminConfig = ".\.env_$($AdminUser.SamAccountName).ps1"
}

# Check if the .env_$AdminConfig.ps1 file exists
$AdminConfig = ".\.env\.env_$($AdminUser.SamAccountName).ps1"
if (Test-Path $AdminConfig) {
    Write-Host "Admin config file exists. " -NoNewline; Write-Host "Imported." -ForegroundColor Green
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

Write-Host "Admin User: " -NoNewline; Write-Host "$($AdminUser.SamAccountName)" -ForegroundColor Cyan
Write-Host "Temp Password: " -NoNewline; Write-Host "$($envVars['tempPassword'])" -ForegroundColor Yellow
Write-Host "Logfile Path: " -NoNewline; Write-Host "$($envVars['logFileBasePath'])" -ForegroundColor Yellow


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