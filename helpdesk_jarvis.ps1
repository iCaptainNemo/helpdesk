$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf
Set-ExecutionPolicy -ExecutionPolicy Undefined -Scope CurrentUser

Clear-Host
# Import required modules
Import-Module ActiveDirectory

# Get the current domain
$currentDomain = (Get-ADDomain).DNSRoot
Write-Host "Current domain: $currentDomain"

# Get the current user with specific properties
$AdminUser = Get-ADUser -Identity $env:USERNAME -Properties SamAccountName, Name

# Initialize $envVars hashtable
$envVars = @{}

# Import functions from functions directory
. .\functions\Asset-Control.ps1
. .\functions\dd-NetworkPrinter.ps1
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

# Call the function to create the env.ps1 file
if (-not (Test-Path ".\env_$currentDomain.ps1")) {
    Test-DomainControllers
}

# Import variables from env.ps1 file
. .\env_$currentDomain.ps1

function SetGlobalVariable {
    $global:AdminConfig = ".\.env_$($AdminUser.SamAccountName).ps1"
}

# Check if the .env_$AdminConfig.ps1 file exists
$AdminConfig = ".\.env_$($AdminUser.SamAccountName).ps1"
if (Test-Path $AdminConfig) {
    Write-Host "Admin config file exists. Importing."
    . $AdminConfig

    # Check if 'tempPassword' key in $envVars is null
    if ($null -eq $envVars['tempPassword']) {
        $envVars['tempPassword'] = Set-TempPassword
        # Convert the updated hashtable to a list of strings
        $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })
        # Write the updated environmental variables to the $AdminConfig file
        Set-Content -Path $AdminConfig -Value $envVarsList
    }
} else {
    Write-Host "Admin Config does not exist. Creating."
    New-Item -Path $AdminConfig -ItemType File | Out-Null

    # Set 'tempPassword' key in $envVars
    $envVars = @{
        tempPassword = Set-TempPassword
        UserID = $null
    }
    # Convert the hashtable to a list of strings
    $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })
    # Write the environmental variables to the $AdminConfig file
    Set-Content -Path $AdminConfig -Value $envVarsList
}

# Create a hashtable to store the environmental variables
$envVars = @{
    tempPassword = $envVars['tempPassword']
    UserID = $null
}
Write-Host "Admin User: $($AdminUser.SamAccountName)"
Write-Host "Temp Password: $($envVars['tempPassword'])"


# Main loop
while ($true) {
    # Get User ID before entering the main menu
    $envVars['UserID'] = Get-UserId

    # Initialize $logFilePath inside the main loop
    $logFilePath = "\\hssserver037\login-tracking\$($envVars['UserID']).log"

    # Call the main loop function
    Main-Loop
}