<#
.SYNOPSIS
    Domain controller discovery and validation functions
.DESCRIPTION
    Tests domain controllers for Active Directory Web Services (ADWS) availability and 
    categorizes them for optimal unlock operations. Results are cached in YAML configuration
    for performance optimization. Supports PowerShell AD module and command-line fallbacks.
.FUNCTIONALITY
    - Discovers all domain controllers in current domain
    - Tests ADWS service availability (port 9389)
    - Categories DCs as PowerShell-compatible or command-line only
    - Caches results in YAML configuration for subsequent runs
    - Initializes script-level variables for immediate use
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: Active Directory access, YAML configuration system
    Part of: Jarvis Helpdesk Automation System - Core Functions
#>

# Function to test domain controllers for ADWS service
function Test-DomainControllers {
    # Check if domain controllers are already configured in YAML
    $domainConfigName = "domain_$($script:EnvironmentInfo.Domain -replace '\.', '_')"
    $domainConfig = $script:ConfigManager.LoadConfig($domainConfigName)
    if ($domainConfig -and $domainConfig['DomainControllers'] -and $domainConfig['DomainControllers']['PSDomains'].Count -gt 0) {
        Write-Host "Domain controllers already configured in YAML. Continuing."
        return
    }

    # Get all domain controllers
    $domainControllers = Get-ADDomainController -Filter *

    # Initialize variables
    $cmdDomains = @()
    $PSDomains = @()

    foreach ($dc in $domainControllers) {
        # Get the hostname of the domain controller
        $hostname = $dc.HostName

        # Test the connection to the ADWS service
        $testResult = Test-NetConnection -ComputerName $hostname -Port 9389 -ErrorAction SilentlyContinue

        if ($testResult.TcpTestSucceeded) {
            $PSDomains += $hostname
        } else {
            $cmdDomains += $hostname
        }
    }

    # Update domain YAML configuration with tested domain controllers
    $domainConfig['DomainControllers']['PSDomains'] = $PSDomains
    $domainConfig['DomainControllers']['CMDDomains'] = $cmdDomains
    
    # Save updated domain configuration
    $script:ConfigManager.SaveConfig($domainConfigName, $domainConfig)
    Write-Host "Domain controllers updated in YAML configuration: $domainConfigName.yaml"
    
    # Initialize script-level variables for immediate use
    Initialize-DomainControllerVariables
}

<#
.SYNOPSIS
    Initialize script-level domain controller variables from cached YAML configuration
.DESCRIPTION
    Loads previously cached domain controller information and sets script-level variables
    for use by unlock and other functions. This avoids re-testing DCs on every operation.
#>
function Initialize-DomainControllerVariables {
    # Load cached domain controller configuration
    $domainConfigName = "domain_$($script:EnvironmentInfo.Domain -replace '\.', '_')"
    $domainConfig = $script:ConfigManager.LoadConfig($domainConfigName)
    
    if ($domainConfig -and $domainConfig['DomainControllers']) {
        # Set script-level variables from cached data
        $script:PSDomains = $domainConfig['DomainControllers']['PSDomains'] -as [array]
        $script:cmdDomains = $domainConfig['DomainControllers']['CMDDomains'] -as [array]
        
        Write-Debug "Initialized domain controllers from cache:"
        Write-Debug "PowerShell AD enabled DCs: $($script:PSDomains -join ', ')"
        Write-Debug "Command-line only DCs: $($script:cmdDomains -join ', ')"
        
        return $true
    } else {
        Write-Warning "No cached domain controller configuration found. Run Test-DomainControllers first."
        $script:PSDomains = @()
        $script:cmdDomains = @()
        return $false
    }
}