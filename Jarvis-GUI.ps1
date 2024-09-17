param (
    [switch]$Debug  # Parameter to enable debug mode
)

# If the Debug switch is provided, set the debug preference to 'Continue'
if ($Debug) {
    $DebugPreference = 'Continue'
}

# # Import necessary assemblies
# Add-Type -AssemblyName System.Windows.Forms
# Add-Type -AssemblyName System.Drawing

# # Hide the console window
# Add-Type -Name Window -Namespace Console -MemberDefinition '
# [DllImport("Kernel32.dll")]
# public static extern IntPtr GetConsoleWindow();

# [DllImport("user32.dll")]
# public static extern bool ShowWindow(IntPtr hWnd, Int32 nCmdShow);
# '

# $console = [Console.Window]::GetConsoleWindow()

# # 0 hide
# [Console.Window]::ShowWindow($console, 0) | Out-Null


# Import ActiveDirectory module
try {
    Write-Debug "Importing ActiveDirectory module."
    Import-Module ActiveDirectory -ErrorAction Stop
    Write-Verbose "ActiveDirectory module imported successfully."
} catch {
    Write-Error "Failed to import ActiveDirectory module: $_"
    exit 1
}

# Install the powershell-yaml module if it is not already installed
if (-not (Get-Module -ListAvailable -Name powershell-yaml)) {
    try {
        Write-Debug "Installing powershell-yaml module."
        Install-Module -Name powershell-yaml -Force -Scope CurrentUser -ErrorAction Stop
        Write-Verbose "powershell-yaml module installed successfully."
    } catch {
        Write-Error "Failed to install powershell-yaml module: $_"
        exit 1
    }
}

# Import the powershell-yaml module
try {
    Write-Debug "Importing powershell-yaml module."
    Import-Module -Name powershell-yaml -ErrorAction Stop
    Write-Verbose "powershell-yaml module imported successfully."
} catch {
    Write-Error "Failed to import powershell-yaml module: $_"
    exit 1
}

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

# Config checks for admin, tempuser,temp computer, watched items.
$AdminUser = $env:USERNAME
$configs = ".\Config"
$Templates = ".\Templates"
$Admin_Template = "$Templates\Admin_template.yaml"
$Admin = "$configs\${AdminUser}_Config.yaml"
$User_Template = "$Templates\User_Template.yaml"
$User = ".\Users\${UserID}.yaml"
#$CurrentDomainConfig = "$configs\$CurrentDomain.ymal"
#$Adpermissions = "$configs\$Ad-permissions.ymal"

# Function to create the config file from the template
function Create-ConfigFromTemplate {
    param (
        [string]$ConfigFile,
        [string]$TemplateFile
    )

    # Read the template content into a PowerShell object
    $yamlContent = Get-Content -Path $TemplateFile -Raw | ConvertFrom-Yaml

    # Convert the object back to YAML and save it to the new config file
    $yamlContent | ConvertTo-Yaml | Set-Content -Path $ConfigFile

    Write-Host "$ConfigFile created from template."
}

# Function to validate the existing config file and prompt for missing values
function Validate-Config {
    param (
        [string]$ConfigFile
    )

    # Read the config file content into a PowerShell object
    $yamlContent = Get-Content -Path $ConfigFile -Raw | ConvertFrom-Yaml

    # Function to update placeholder values and replace variables
    function UpdateValues {
        param (
            [hashtable]$content
        )

        $updateRequired = $false
        $keysToUpdate = @()

        foreach ($key in $content.Keys) {
            Write-Debug "Checking key: $key with value: $($content[$key])"
            if ($content[$key] -eq '<PLACEHOLDER>') {
                Write-Debug "Found placeholder for key: $key"
                $newValue = Read-Host "Enter value for $key"
                $keysToUpdate += @{ Key = $key; Value = $newValue }
                $updateRequired = $true
            } elseif ($content[$key] -match '^\$') {
                $variableName = $content[$key].TrimStart('$')
                $variableValue = Get-Variable -Name $variableName -ErrorAction SilentlyContinue
                if ($variableValue) {
                    $keysToUpdate += @{ Key = $key; Value = $variableValue.Value }
                    $updateRequired = $true
                }
            }
        }

        foreach ($update in $keysToUpdate) {
            $content[$update.Key] = $update.Value
        }

        return $updateRequired
    }

    # Check for placeholder values and prompt for missing values
    $updateRequired = $false
    foreach ($item in $yamlContent.Admin) {
        $updateRequired = (UpdateValues -content $item) -or $updateRequired
    }

    # Update the config file if any values were missing
    if ($updateRequired) {
        $yamlContent | ConvertTo-Yaml | Set-Content -Path $ConfigFile
        Write-Host "$ConfigFile updated with missing values."
    } else {
        Write-Host "No updates required for $ConfigFile."
    }
}

if (-Not (Test-Path -Path $Admin)) {
    Write-Host "$Admin does not exist. Creating from template."
    Create-ConfigFromTemplate -ConfigFile $Admin -TemplateFile $Admin_Template
}
# Print the file path that is about to be validated
Write-Host "Validating config file: $Admin"

# Validate the existing or newly created config file
Validate-Config -ConfigFile $Admin

# Prompt for userID
$userID = Read-Host "Enter the userID"

# Get user properties using the get-adobject.ps1 script
$userProperties = & ".\functions\get-adobject.ps1" $userID

Write-Host $userProperties
pause

if (-not $userProperties) {
    Write-Error "Failed to retrieve properties for userID: $userID"
    exit 1
}

# Define paths for user template and user config
$User_Template = "$Templates\User_Template.yaml"
$User = ".\Users\${UserID}.yaml"

# Create the user config file from the template
Create-ConfigFromTemplate -ConfigFile $User -TemplateFile $User_Template



# Validate the user config file and fill in variables
Validate-Config -ConfigFile $User

# Write the new user.yaml file to the console
Write-Host "New user config file created: $User"
Pause