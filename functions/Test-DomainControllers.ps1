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
}