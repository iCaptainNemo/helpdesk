<#
.SYNOPSIS
    Jarvis Helpdesk Automation Script - Main Aggregator
    
.DESCRIPTION
    This is the main entry point for the Jarvis helpdesk automation system.
    It orchestrates the loading of modules, configuration management, and user interaction.
    
    ARCHITECTURE OVERVIEW:
    - Main aggregator script that dot-sources modular functions from ./functions/
    - Uses hybrid persistence: SQLite DB + YAML configs + PowerShell env files
    - Supports both PowerShell AD modules and WMI fallback for restricted environments
    - Per-user configuration files for session persistence
    
    MULTI-AGENT CONSIDERATIONS:
    - File locking may occur with simultaneous users
    - SQLite database provides better concurrency than file-based configs
    - Each agent gets unique environment files based on $env:USERNAME
    
.PARAMETER Debug
    Enables verbose debug output and logging for troubleshooting (provided by CmdletBinding)
    
.EXAMPLE
    .\jarvis.ps1
    Runs the script in normal mode
    
.EXAMPLE
    .\jarvis.ps1 -Debug
    Runs the script with debug output enabled
    
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: PowerShell 5.1+, ActiveDirectory module, powershell-yaml module
    
    DEPENDENCIES:
    - ActiveDirectory PowerShell module (with WMI fallback)
    - powershell-yaml module (auto-installed if missing)
    - SQLite module (for database operations)
    
    FILE STRUCTURE:
    - ./functions/ - Modular function library
    - ./.env/ - Environment and configuration files
    - ./Config/ - YAML configuration files
    - ./db/ - SQLite database files
    - ./Templates/ - YAML templates for new configurations
#>

[CmdletBinding()]
param (
    # No custom parameters needed - using built-in CmdletBinding Debug support
)

#region INITIALIZATION
# ============================================================================
# SCRIPT INITIALIZATION AND ENVIRONMENT SETUP
# ============================================================================

# Configure debug output if requested via -Debug switch
# CmdletBinding() provides -Debug parameter automatically
if ($PSBoundParameters['Debug']) {
    $DebugPreference = 'Continue'
    $VerbosePreference = 'Continue'
    Write-Debug "Debug mode enabled - verbose output activated"
}

# Clear screen and set window properties (skip in debug mode for better troubleshooting)
if (-not $PSBoundParameters['Debug']) { Clear-Host }
$Host.UI.RawUI.WindowTitle = "Jarvis Helpdesk - $(Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf)"
Write-Debug "Window title set and screen cleared"

# Set execution policy for script operations
try {
    Set-ExecutionPolicy -ExecutionPolicy Undefined -Scope CurrentUser -Force
    Write-Debug "Execution policy set successfully"
} catch {
    Write-Warning "Could not set execution policy: $($_.Exception.Message)"
}
#endregion

#region MODULE_MANAGEMENT
# ============================================================================
# MODULE IMPORTS AND DEPENDENCY MANAGEMENT
# ============================================================================

# Import ActiveDirectory module with error handling
try {
    Import-Module ActiveDirectory -ErrorAction Stop
    Write-Debug "ActiveDirectory module imported successfully"
} catch {
    Write-Warning "ActiveDirectory module not available: $($_.Exception.Message)"
    Write-Host "Will attempt WMI fallback for domain operations" -ForegroundColor Yellow
}

# Install and import powershell-yaml module
try {
    if (-not (Get-Module -ListAvailable -Name powershell-yaml)) {
        Write-Host "Installing powershell-yaml module..." -ForegroundColor Yellow
        Install-Module -Name powershell-yaml -Force -Scope CurrentUser -ErrorAction Stop
        Write-Debug "powershell-yaml module installed successfully"
    }
    Import-Module -Name powershell-yaml -ErrorAction Stop
    Write-Debug "powershell-yaml module imported successfully"
} catch {
    Write-Error "Failed to install/import powershell-yaml module: $($_.Exception.Message)"
    Write-Host "YAML functionality will not be available. Press any key to exit." -ForegroundColor Red
    $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
#endregion

#region DOMAIN_DETECTION
# ============================================================================
# DOMAIN ENVIRONMENT DETECTION AND CAPABILITY ASSESSMENT  
# ============================================================================

# Display script banner
Write-Host "Jarvis Helpdesk Automation Script" -ForegroundColor Green
Write-Host "Initializing environment detection..." -ForegroundColor Cyan
Write-Host ""

# Determine domain and available command types (PowerShell AD vs WMI)
# This affects which cmdlets are available for Active Directory operations
$script:EnvironmentInfo = @{
    Domain = $null
    CommandType = $null
    PowerShellAD = $false
    WMIFallback = $false
}

try {
    # Attempt to use PowerShell AD module (preferred method)
    Write-Debug "Attempting to detect domain using PowerShell AD module"
    $script:EnvironmentInfo.Domain = (Get-ADDomain -ErrorAction Stop -WarningAction SilentlyContinue).DNSRoot
    $script:EnvironmentInfo.CommandType = "PowerShell"
    $script:EnvironmentInfo.PowerShellAD = $true
    $env:CommandType = "Power"  # Legacy environment variable for backward compatibility
    Write-Debug "Successfully detected domain using PowerShell AD: $($script:EnvironmentInfo.Domain)"
} catch {
    Write-Debug "PowerShell AD module failed, attempting WMI fallback: $($_.Exception.Message)"
    try {
        # Fallback to WMI for restricted environments
        $script:EnvironmentInfo.Domain = (Get-WmiObject -Class Win32_ComputerSystem -ErrorAction Stop).Domain
        $script:EnvironmentInfo.CommandType = "WMI" 
        $script:EnvironmentInfo.WMIFallback = $true
        $env:CommandType = "WMI"  # Legacy environment variable for backward compatibility
        Write-Debug "Successfully detected domain using WMI: $($script:EnvironmentInfo.Domain)"
    } catch {
        # Complete failure - cannot determine domain
        Write-Error "Unable to determine domain information using either PowerShell AD or WMI"
        Write-Host "This script requires domain connectivity to function. Possible causes:" -ForegroundColor Red
        Write-Host "- Not connected to domain network" -ForegroundColor Red  
        Write-Host "- Insufficient permissions" -ForegroundColor Red
        Write-Host "- Domain controller unavailable" -ForegroundColor Red
        Write-Host "`nPress any key to exit." -ForegroundColor Red
        $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# Display environment status
Write-Host "Current domain: " -NoNewLine
Write-Host "$($script:EnvironmentInfo.Domain)" -ForegroundColor Green

if ($script:EnvironmentInfo.PowerShellAD) {
    Write-Host "PowerShell AD Environment: " -NoNewline
    Write-Host "Enabled" -ForegroundColor Green
}

if ($script:EnvironmentInfo.WMIFallback) {
    Write-Host "WMI Fallback Mode: " -NoNewline
    Write-Host "Active" -ForegroundColor Yellow
}

# Environment info is now stored in $script:EnvironmentInfo hashtable
# Functions access this via $script:EnvironmentInfo.PowerShellAD, $script:EnvironmentInfo.WMIFallback, etc.
Write-Debug "Environment detection complete. PowerShellAD=$($script:EnvironmentInfo.PowerShellAD), WMIFallback=$($script:EnvironmentInfo.WMIFallback), Domain=$($script:EnvironmentInfo.Domain)"
#endregion

#region USER_IDENTIFICATION
# ============================================================================
# CURRENT USER IDENTIFICATION AND SESSION SETUP
# ============================================================================

# Get current user context for session management
# Each helpdesk agent gets their own configuration and session data
try {
    $script:AdminUser = $env:USERNAME
    if ([string]::IsNullOrEmpty($script:AdminUser)) {
        throw "USERNAME environment variable is null or empty"
    }
    Write-Debug "Current admin user identified: $script:AdminUser"
} catch {
    Write-Warning "Unable to determine current user: $($_.Exception.Message)"
    Write-Host "Setting fallback admin user identifier" -ForegroundColor Yellow
    $script:AdminUser = "UNKNOWN_USER_$(Get-Random -Maximum 9999)"
}

# Initialize session variable containers
# These hashtables store runtime configuration and user session data
$script:envVars = @{}      # Environment and configuration variables
$script:UserVars = @{}     # Current user being helped session data

Write-Debug "Session variables initialized for admin user: $script:AdminUser"
#endregion

#region FUNCTION_LOADING
# ============================================================================
# MODULAR FUNCTION LIBRARY LOADING
# ============================================================================

# Define the Functions directory with new modular structure
$FunctionsPath = Join-Path $PSScriptRoot "Functions"
Write-Debug "Loading functions from: $FunctionsPath"

# Define function directories in load order (core functions first)
$FunctionDirectories = @(
    @{ Path = "Core"; Required = $true },
    @{ Path = "UserManagement"; Required = $true },
    @{ Path = "Utilities"; Required = $true },
    @{ Path = "AssetControl"; Required = $true }
    # Note: Standalone directory is intentionally excluded - these are standalone scripts
)

# Load functions from each directory
$FunctionLoadErrors = @()
$TotalFunctionsLoaded = 0

foreach ($directory in $FunctionDirectories) {
    $directoryPath = Join-Path $FunctionsPath $directory.Path
    Write-Debug "Loading functions from directory: $($directory.Path)"
    
    if (Test-Path $directoryPath) {
        # Get all PowerShell files in the directory
        $functionFiles = Get-ChildItem -Path $directoryPath -Filter "*.ps1" -File
        
        foreach ($functionFile in $functionFiles) {
            try {
                Write-Debug "Loading function file: $($directory.Path)\$($functionFile.Name)"
                . $functionFile.FullName
                Write-Debug "Successfully loaded: $($directory.Path)\$($functionFile.Name)"
                $TotalFunctionsLoaded++
            } catch {
                $errorMessage = "Failed to load $($directory.Path)\$($functionFile.Name): $($_.Exception.Message)"
                Write-Error $errorMessage
                $FunctionLoadErrors += $errorMessage
            }
        }
        
        Write-Debug "Loaded $($functionFiles.Count) functions from $($directory.Path)"
    } else {
        $missingMessage = "Function directory not found: $($directory.Path)"
        if ($directory.Required) {
            Write-Error $missingMessage
            $FunctionLoadErrors += $missingMessage
        } else {
            Write-Warning $missingMessage
        }
    }
}

# Report function loading results
if ($FunctionLoadErrors.Count -gt 0) {
    Write-Warning "Some functions failed to load ($($FunctionLoadErrors.Count) errors):"
    $FunctionLoadErrors | ForEach-Object { Write-Warning "  $_" }
} else {
    Write-Debug "All functions loaded successfully"
}

Write-Debug "Total functions loaded: $TotalFunctionsLoaded"
Write-Host "Modular function system initialized - $TotalFunctionsLoaded functions loaded" -ForegroundColor Green
#endregion

#region CONFIGURATION_MANAGEMENT
# ============================================================================
# CONFIGURATION FILES AND DOMAIN CONTROLLER SETUP
# ============================================================================

# Ensure .env directory exists for configuration files
$EnvPath = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $EnvPath)) {
    try {
        New-Item -Path $EnvPath -ItemType Directory -Force | Out-Null
        Write-Debug "Created .env directory: $EnvPath"
    } catch {
        Write-Error "Failed to create .env directory: $($_.Exception.Message)"
        exit 1
    }
}

# Domain-specific environment file setup
$DomainEnvFile = Join-Path $EnvPath ".env_$($script:EnvironmentInfo.Domain).ps1"
if (-not (Test-Path $DomainEnvFile)) {
    Write-Host "Domain environment file not found. Testing domain controllers..." -ForegroundColor Yellow
    try {
        Test-DomainControllers
        Write-Debug "Domain controller test completed, environment file should be created"
    } catch {
        Write-Error "Failed to test domain controllers: $($_.Exception.Message)"
        Write-Warning "Continuing without domain controller verification"
    }
}

# Import domain-specific variables if available
if (Test-Path $DomainEnvFile) {
    try {
        . $DomainEnvFile
        Write-Debug "Successfully imported domain environment variables from: $DomainEnvFile"
    } catch {
        Write-Warning "Failed to import domain environment variables: $($_.Exception.Message)"
    }
} else {
    Write-Warning "Domain environment file not found: $DomainEnvFile"
}

# Legacy function for backward compatibility
function SetGlobalVariable {
    $global:AdminConfig = Join-Path $EnvPath "env_$($script:AdminUser).ps1"
    Write-Debug "Global AdminConfig set to: $global:AdminConfig"
}

# Enhanced YAML configuration management system
# Handles domain, admin, and user configurations using template-based approach
class YamlConfigManager {
    [string]$ConfigPath
    [string]$TemplatePath

    YamlConfigManager() {
        $this.ConfigPath = Join-Path $PSScriptRoot "Config"
        $this.TemplatePath = Join-Path $PSScriptRoot "Templates"
    }

    # Create configuration from template with placeholder replacement
    [void] CreateFromTemplate([string]$templateName, [string]$outputName, [hashtable]$replacements) {
        $templateFile = Join-Path $this.TemplatePath "$templateName.yaml"
        $outputFile = Join-Path $this.ConfigPath "$outputName.yaml"
        
        if (-not (Test-Path $templateFile)) {
            throw "Template file not found: $templateFile"
        }
        
        try {
            $templateContent = Get-Content -Path $templateFile -Raw -ErrorAction Stop
            
            # Replace placeholders
            foreach ($key in $replacements.Keys) {
                $placeholder = "<$($key.ToUpper())>"
                # Escape backslashes only once for YAML string literals
                $value = $replacements[$key] -replace '\\', '\\\\'
                $templateContent = $templateContent -replace [regex]::Escape($placeholder), $value
            }
            
            # Ensure output directory exists
            if (-not (Test-Path $this.ConfigPath)) {
                New-Item -Path $this.ConfigPath -ItemType Directory -Force | Out-Null
            }
            
            Set-Content -Path $outputFile -Value $templateContent -ErrorAction Stop
            Write-Debug "Created configuration file: $outputFile"
        } catch {
            throw "Failed to create configuration from template: $($_.Exception.Message)"
        }
    }

    # Load YAML configuration file
    [hashtable] LoadConfig([string]$configName) {
        $configFile = Join-Path $this.ConfigPath "$configName.yaml"
        Write-Debug "Attempting to load config file: $configFile"
        
        if (Test-Path $configFile) {
            try {
                $yamlContent = Get-Content -Path $configFile -Raw -ErrorAction Stop
                Write-Debug "YAML content length: $($yamlContent.Length) characters"
                Write-Debug "YAML content preview: $($yamlContent.Substring(0, [Math]::Min(100, $yamlContent.Length)))"
                
                $config = $yamlContent | ConvertFrom-Yaml -ErrorAction Stop
                Write-Debug "YAML converted successfully. Type: $($config.GetType())"
                Write-Debug "Config keys: $($config.Keys -join ', ')"
                Write-Debug "Loaded configuration: $configFile"
                return $config
            } catch {
                Write-Error "Failed to load YAML configuration $configFile`: $($_.Exception.Message)"
                Write-Debug "Exception details: $($_.Exception)"
                return @{}
            }
        } else {
            Write-Error "Configuration file not found: $configFile"
            return @{}
        }
    }

    # Save configuration to YAML file
    [void] SaveConfig([string]$configName, [hashtable]$config) {
        $configFile = Join-Path $this.ConfigPath "$configName.yaml"
        
        try {
            $yamlContent = $config | ConvertTo-Yaml -ErrorAction Stop
            
            # Ensure output directory exists
            if (-not (Test-Path $this.ConfigPath)) {
                New-Item -Path $this.ConfigPath -ItemType Directory -Force | Out-Null
            }
            
            Set-Content -Path $configFile -Value $yamlContent -ErrorAction Stop
            Write-Debug "Saved configuration: $configFile"
        } catch {
            Write-Error "Failed to save YAML configuration $configFile`: $($_.Exception.Message)"
        }
    }

    # Check if configuration exists
    [bool] ConfigExists([string]$configName) {
        $configFile = Join-Path $this.ConfigPath "$configName.yaml"
        return (Test-Path $configFile)
    }
}
#endregion

#region YAML_CONFIG_INITIALIZATION  
# ============================================================================
# YAML-BASED CONFIGURATION SYSTEM INITIALIZATION
# ============================================================================

# Initialize YAML configuration manager
$script:ConfigManager = [YamlConfigManager]::new()

# Domain configuration setup
$domainConfigName = "domain_$($script:EnvironmentInfo.Domain -replace '\.', '_')"
if (-not $script:ConfigManager.ConfigExists($domainConfigName)) {
    Write-Host "Creating domain configuration for $($script:EnvironmentInfo.Domain)..." -ForegroundColor Yellow
    
    # Get logfile path from existing .env file or prompt user
    $logFilePath = ""
    $existingEnvFile = Join-Path $EnvPath ".env_$($script:EnvironmentInfo.Domain).ps1"
    if (Test-Path $existingEnvFile) {
        # Extract logfile path from existing .env file for migration
        $envContent = Get-Content $existingEnvFile -Raw
        if ($envContent -match '\$envVars\[[''"]logFileBasePath[''""]\]\s*=\s*[''"]([^''"]+)[''"]') {
            $logFilePath = $matches[1]
            Write-Debug "Migrated logfile path from existing config: $logFilePath"
        }
    }
    
    if ([string]::IsNullOrEmpty($logFilePath)) {
        $logFilePath = Read-Host "Enter logfile base path (e.g., \\server\logs\) or leave blank to disable logging"
    }
    
    # Create domain configuration from template
    $domainReplacements = @{
        DOMAIN_NAME = $script:EnvironmentInfo.Domain
        LOGFILE_PATH = $logFilePath
    }
    
    try {
        $script:ConfigManager.CreateFromTemplate("Domain_Template", $domainConfigName, $domainReplacements)
        Write-Host "Domain configuration created successfully" -ForegroundColor Green
    } catch {
        Write-Error "Failed to create domain configuration: $($_.Exception.Message)"
    }
}

# Load domain configuration
$script:DomainConfig = $script:ConfigManager.LoadConfig($domainConfigName)
Write-Debug "Domain configuration type: $($script:DomainConfig.GetType())"
Write-Debug "Domain configuration keys: $($script:DomainConfig.Keys -join ', ')"
if ($script:DomainConfig -and $script:DomainConfig['Environment']) {
    Write-Debug "Domain loaded successfully: $($script:DomainConfig['Environment']['Domain'])"
} else {
    Write-Error "Failed to load domain configuration properly"
}

# Admin user configuration setup  
$adminConfigName = "admin_$($script:AdminUser)"
if (-not $script:ConfigManager.ConfigExists($adminConfigName)) {
    Write-Host "Creating admin configuration for $($script:AdminUser)..." -ForegroundColor Yellow
    
    $tempPassword = ""
    if ($script:DomainConfig.Settings -and $script:DomainConfig.Settings.DefaultTempPassword) {
        $useDefault = Read-Host "Use default temp password? (Y/n)"
        if ($useDefault -ne 'n' -and $useDefault -ne 'N') {
            $tempPassword = ""  # Will use domain default
        }
    }
    
    if ([string]::IsNullOrEmpty($tempPassword)) {
        $tempPassword = Read-Host "Enter temp password for $($script:AdminUser) (leave blank for domain default)"
    }
    
    # Ask for log entry display preference
    $logEntryCount = Read-Host "How many recent computer log entries should be displayed? (default: 10)"
    if ([string]::IsNullOrEmpty($logEntryCount) -or -not ($logEntryCount -match '^\d+$')) {
        $logEntryCount = 10
        Write-Host "Using default: 10 log entries" -ForegroundColor Gray
    } else {
        $logEntryCount = [int]$logEntryCount
        Write-Host "Set to display: $logEntryCount log entries" -ForegroundColor Green
    }
    
    # Create admin configuration from template
    $adminReplacements = @{
        ADMIN_USERNAME = $script:AdminUser
        TEMP_PASSWORD = $tempPassword
        LOG_ENTRY_COUNT = $logEntryCount
    }
    
    try {
        $script:ConfigManager.CreateFromTemplate("Admin_Template", $adminConfigName, $adminReplacements)
        Write-Host "Admin configuration created successfully" -ForegroundColor Green
    } catch {
        Write-Error "Failed to create admin configuration: $($_.Exception.Message)"
    }
}

# Load admin configuration
$script:AdminConfig = $script:ConfigManager.LoadConfig($adminConfigName)
Write-Debug "Admin configuration type: $($script:AdminConfig.GetType())"
Write-Debug "Admin configuration keys: $($script:AdminConfig.Keys -join ', ')"
if ($script:AdminConfig -and $script:AdminConfig['Admin']) {
    Write-Debug "Admin loaded successfully: $($script:AdminConfig['Admin']['Username'])"
} else {
    Write-Error "Failed to load admin configuration properly"
}

# Migration notice for legacy .env files
$legacyEnvFile = Join-Path $EnvPath ".env_$($script:AdminUser).ps1"
if (Test-Path $legacyEnvFile) {
    Write-Host "Legacy .env file detected. YAML configuration is now active." -ForegroundColor Yellow
    Write-Host "Legacy file: $legacyEnvFile" -ForegroundColor Gray
}

# Create runtime environment variables from YAML configuration
$script:envVars = @{
    tempPassword = if ($script:AdminConfig -and $script:AdminConfig['Admin'] -and $script:AdminConfig['Admin']['TempPassword']) { 
        $script:AdminConfig['Admin']['TempPassword'] 
    } elseif ($script:DomainConfig -and $script:DomainConfig['Settings']) {
        $script:DomainConfig['Settings']['DefaultTempPassword']
    } else { 
        "TempPass123!" 
    }
    logFileBasePath = if ($script:DomainConfig -and $script:DomainConfig['Environment']) {
        $script:DomainConfig['Environment']['LogFilePath']
    } else {
        ""
    }
    UserID = $null
    logPathBoolean = $false
}

# Set logPathBoolean after logFileBasePath is set
$script:envVars['logPathBoolean'] = $null -ne $script:envVars['logFileBasePath'] -and $script:envVars['logFileBasePath'] -ne ""

# Display current configuration
Write-Host "Configuration Summary:" -ForegroundColor Cyan
Write-Host "Domain: " -NoNewline; Write-Host "$(if ($script:DomainConfig -and $script:DomainConfig['Environment']) { $script:DomainConfig['Environment']['Domain'] } else { 'N/A' })" -ForegroundColor Green
Write-Host "Admin User: " -NoNewline; Write-Host "$(if ($script:AdminConfig -and $script:AdminConfig['Admin']) { $script:AdminConfig['Admin']['Username'] } else { $script:AdminUser })" -ForegroundColor Green
Write-Host "Temp Password: " -NoNewline; Write-Host "$($script:envVars['tempPassword'])" -ForegroundColor Yellow
Write-Host "Logfile Path: " -NoNewline; Write-Host "$($script:envVars['logFileBasePath'])" -ForegroundColor Yellow
Write-Host ""

# Initialize domain controller variables from cache for performance optimization
Write-Host "Initializing domain controllers..." -ForegroundColor Cyan
try {
    if (Initialize-DomainControllerVariables) {
        Write-Host "Domain controllers loaded from cache" -ForegroundColor Green
        Write-Debug "Available DCs - PowerShell: $($script:PSDomains.Count), Command-line: $($script:cmdDomains.Count)"
    } else {
        Write-Host "No cached domain controllers found - will test on first unlock" -ForegroundColor Yellow
    }
} catch {
    Write-Warning "Failed to initialize domain controllers: $($_.Exception.Message)"
    Write-Debug "Exception details: $($_.Exception)"
    $script:PSDomains = @()
    $script:cmdDomains = @()
}
Write-Host ""

Write-Host "Press any key to continue..." -ForegroundColor Gray
$host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
#endregion


# Main loop
while ($true) {
    # Get User ID before entering the main menu
    if (-not $PSBoundParameters['Debug']) { Clear-Host }
    $script:envVars['UserID'] = Get-UserId

    # Initialize $logFilePath inside the main loop and make it available to functions
    if ($script:envVars['logPathBoolean']) {
        $script:logFilePath = $script:envVars['logFileBasePath'] + $script:envVars['UserID'] + '.log'
        Write-Debug "Log file path set to: $script:logFilePath"
    } else {
        $script:logFilePath = $null
        Write-Debug "Log file path disabled (logPathBoolean is false)"
    }

    # Call the main loop function
    Main-Loop
}