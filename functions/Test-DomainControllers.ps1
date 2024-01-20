# Function to test domain controllers for ADWS service
function Test-DomainControllers {
    # Check if env.ps1 file already exists
    if (Test-Path ".\env_$currentDomain.ps1") {
        Write-Host "env_$currentDomain.ps1 file already exists. continuing."
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

    # Export variables to env.ps1 file
    $exportScript = @"
    `$PSDomains = @('{0}')
    `$cmdDomains = @('{1}')
"@ -f ($PSDomains -join "', '"), ($cmdDomains -join "', '")

    $exportScript | Out-File -FilePath ".\env_$currentDomain.ps1"
}