param (
    [switch]$Debug  # Parameter to enable debug mode
)

# If the Debug switch is provided, set the debug preference to 'Continue'
if ($Debug) {
    $DebugPreference = 'Continue'
}

# Clear the screen
cls

# Write a debug message if debug mode is enabled
Write-Debug "Debug mode is enabled."

# Set the window title to the name of the script file
$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf

# Set the execution policy to Undefined for the current user scope
Set-ExecutionPolicy -ExecutionPolicy Undefined -Scope CurrentUser

# Import ActiveDirectory module
# Import ActiveDirectory module
Import-Module ActiveDirectory

# Install the powershell-yaml module if it is not already installed
if (-not (Get-Module -ListAvailable -Name powershell-yaml)) {
    Install-Module -Name powershell-yaml -Force -Scope CurrentUser
}
# Import the powershell-yaml module
Import-Module -Name powershell-yaml

# Display the script title
Write-Host "Jarvis Helpdesk Automation Script" -ForegroundColor Green
Write-Host ""

# Get the current domain and enviroment type
try {
    #Write-Host "Checking if powershell AD Module is enabled..." -ForegroundColor Yellow
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

Write-Host "Current domain: " -NoNewLine
Write-Host "$currentDomain" -ForegroundColor Green

# Environment type
if ($powershell) {
    Write-Host "Powershell Enviroment: " -NoNewline
    Write-Host "Enabled" -ForegroundColor Green
}

if ($wmi) {
    Write-Host "WMI Commands: " -NoNewline
    Write-Host "Enabled" -ForegroundColor Yellow
}

# Get the current user with specific properties
try {
    # Assign the USERNAME environment variable to $AdminUser
    $AdminUser = $env:USERNAME
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
# Initialize variables hashtable
$envVars = @{}
$UserVars = @{}
$UserVars = @{}

# Import functions from functions directory
. .\functions\Asset-Control.ps1
. .\functions\Add-NetworkPrinter.ps1
. .\functions\Set-TempPassword.ps1
. .\functions\ADUserProp.ps1
. .\functions\Get-UserId.ps1
. .\functions\Invoke-SCCMRemoteTool.ps1
. .\functions\Main-Loop.ps1
. .\functions\Remove-UserId.ps1
. .\functions\Show-LastLogEntries.ps1
. .\functions\Test-DomainControllers.ps1
. .\functions\Unlock-ADAccountOnAllDomainControllers.ps1
. .\functions\Clear-Browsers.ps1

# Create env.ps1 file if missing and test domain controllers
# Create env.ps1 file if missing and test domain controllers
if (-not (Test-Path ".\.env\.env_$currentDomain.ps1")) {
    Test-DomainControllers
}

# Import variables from env.ps1 file
. .\.env\.env_$currentDomain.ps1

function SetGlobalVariable {
    $global:AdminConfig = ".\.env_$env:USERNAME.ps1"
}


# YAML handler class
class YamlHandler {
    [string]$FilePath

    YamlHandler([string]$fileName) {
        $this.FilePath = ".\.env\$fileName.yaml"
    }

    [hashtable] Import() {
        if (Test-Path $this.FilePath) {
            $yamlContent = Get-Content -Path $this.FilePath -Raw
            $variables = $yamlContent | ConvertFrom-Yaml
            return $variables
        } else {
            Write-Host "YAML file not found: $this.FilePath"
            return @{}
        }
    }

    [void] Export([hashtable]$variables) {
        $yamlContent = $variables | ConvertTo-Yaml
        Set-Content -Path $this.FilePath -Value $yamlContent
    }
}

# Check if the .env_$AdminConfig.ps1 file exists
$AdminConfig = ".\.env\.env_$env:USERNAME.ps1"
$AdminConfig = ".\.env\.env_$env:USERNAME.ps1"
if (Test-Path $AdminConfig) {
    Write-Host "Admin User config:" -NoNewline; Write-Host "Imported." -ForegroundColor Green
    Write-Host "Admin User config:" -NoNewline; Write-Host "Imported." -ForegroundColor Green
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

Write-Host "Temp Password: " -NoNewline; Write-Host "$($envVars['tempPassword'])" -ForegroundColor Yellow
Write-Host "Logfile Path: " -NoNewline; Write-Host "$($envVars['logFileBasePath'])" -ForegroundColor Yellow
Write-Host ""

# Call the Set-TempPassword function
Set-TempPassword
Pause


# Main loop
while ($true) {
    # Get User ID before entering the main menu
    Clear-Host
    Clear-Host
    $envVars['UserID'] = Get-UserId

    # Initialize $logFilePath inside the main loop
    if ($envVars['logPathBoolean']) {
        $logFilePath = $envVars['logFileBasePath'] + $envVars['UserID'] + '.log'
    }


    # Call the main loop function
    Main-Loop
}