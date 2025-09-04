<#
.SYNOPSIS
    Network connectivity testing functions for Asset Control
.DESCRIPTION
    Provides functions to test network connectivity to remote computers using various methods
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: PowerShell 5.1+, Network connectivity
#>

<#
.SYNOPSIS
    Test network connectivity to a remote computer
.DESCRIPTION
    Tests connectivity using Test-Connection (PowerShell AD) or WMI (fallback mode)
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to test connectivity to
.EXAMPLE
    Test-ComputerConnection -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Uses different methods based on available PowerShell modules
#>
function Test-ComputerConnection {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Testing connection to computer: $computerName (requested by: $userId)"
    
    Write-Host "Testing connection to '$computerName'..." -ForegroundColor Cyan

    # Check if PowerShell AD module is available for enhanced testing
    if ($script:EnvironmentInfo.PowerShellAD -eq $true) {
        Write-Debug "Using PowerShell AD method for connection testing"
        Test-PowerShellConnection -computerName $computerName
    } else {
        Write-Debug "Using WMI fallback method for connection testing"  
        Test-WMIConnection -computerName $computerName
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Test connection using PowerShell Test-Connection cmdlet
.DESCRIPTION
    Uses Test-Connection with multiple tests and detailed reporting
.PARAMETER computerName
    Name of the computer to test
#>
function Test-PowerShellConnection {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    try {
        Write-Host "Performing connectivity tests..." -ForegroundColor Yellow
        
        # Test 1: Basic ping test
        Write-Host "1. Basic ping test: " -NoNewline
        if (Test-Connection -ComputerName $computerName -Count 1 -Quiet -ErrorAction Stop) {
            Write-Host "SUCCESS" -ForegroundColor Green
            $pingSuccess = $true
        } else {
            Write-Host "FAILED" -ForegroundColor Red
            $pingSuccess = $false
        }

        # Test 2: Detailed ping with statistics
        if ($pingSuccess) {
            Write-Host "2. Detailed ping statistics: " -ForegroundColor Yellow
            $pingResults = Test-Connection -ComputerName $computerName -Count 4 -ErrorAction Stop
            
            foreach ($result in $pingResults) {
                $responseTime = $result.ResponseTime
                $color = if ($responseTime -lt 50) { "Green" } elseif ($responseTime -lt 200) { "Yellow" } else { "Red" }
                Write-Host "   Response from $($result.Address): time=$($responseTime)ms" -ForegroundColor $color
            }
            
            # Calculate statistics
            $avgResponseTime = ($pingResults | Measure-Object -Property ResponseTime -Average).Average
            Write-Host "   Average response time: $([math]::Round($avgResponseTime, 2))ms" -ForegroundColor Cyan
        }

        # Test 3: Port tests for common services
        if ($pingSuccess) {
            Write-Host "3. Service port tests:" -ForegroundColor Yellow
            Test-ServicePorts -computerName $computerName
        }

        # Test 4: DNS resolution test
        Write-Host "4. DNS resolution test: " -NoNewline
        try {
            $dnsResult = Resolve-DnsName -Name $computerName -ErrorAction Stop
            Write-Host "SUCCESS" -ForegroundColor Green
            Write-Host "   IP Address: $($dnsResult.IPAddress)" -ForegroundColor Cyan
        } catch {
            Write-Host "FAILED" -ForegroundColor Red
            Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
        }

    } catch {
        Write-Host "Connection test failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "PowerShell connection test exception: $($_.Exception)"
    }
}

<#
.SYNOPSIS
    Test connection using WMI as fallback method
.DESCRIPTION
    Uses WMI queries for connectivity testing when PowerShell AD is not available
.PARAMETER computerName
    Name of the computer to test
#>
function Test-WMIConnection {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    try {
        Write-Host "Using WMI connection test..." -ForegroundColor Yellow
        
        # Test WMI connectivity
        Write-Host "WMI connectivity test: " -NoNewline
        $computer = Get-WmiObject -Class Win32_ComputerSystem -ComputerName $computerName -ErrorAction Stop
        
        if ($computer) {
            Write-Host "SUCCESS" -ForegroundColor Green
            Write-Host "Computer Details:" -ForegroundColor Cyan
            Write-Host "   Name: $($computer.Name)" -ForegroundColor White
            Write-Host "   Domain: $($computer.Domain)" -ForegroundColor White
            Write-Host "   Manufacturer: $($computer.Manufacturer)" -ForegroundColor White
            Write-Host "   Model: $($computer.Model)" -ForegroundColor White
        }
    } catch {
        Write-Host "FAILED" -ForegroundColor Red
        Write-Host "WMI connection error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "WMI connection test exception: $($_.Exception)"
    }
}

<#
.SYNOPSIS
    Test common service ports on remote computer
.DESCRIPTION
    Tests connectivity to common Windows service ports
.PARAMETER computerName
    Name of the computer to test ports on
#>
function Test-ServicePorts {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    $commonPorts = @(
        @{ Port = 135; Service = "RPC Endpoint Mapper" },
        @{ Port = 139; Service = "NetBIOS Session Service" },
        @{ Port = 445; Service = "SMB/CIFS" },
        @{ Port = 3389; Service = "Remote Desktop" },
        @{ Port = 5985; Service = "WinRM HTTP" },
        @{ Port = 5986; Service = "WinRM HTTPS" }
    )

    foreach ($portTest in $commonPorts) {
        Write-Host "   $($portTest.Service) (port $($portTest.Port)): " -NoNewline
        
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $connect = $tcpClient.BeginConnect($computerName, $portTest.Port, $null, $null)
            $wait = $connect.AsyncWaitHandle.WaitOne(3000, $false)
            
            if ($wait) {
                try {
                    $tcpClient.EndConnect($connect)
                    Write-Host "OPEN" -ForegroundColor Green
                } catch {
                    Write-Host "CLOSED" -ForegroundColor Red
                }
            } else {
                Write-Host "TIMEOUT" -ForegroundColor Yellow
            }
            
            $tcpClient.Close()
        } catch {
            Write-Host "ERROR" -ForegroundColor Red
        }
    }
}

<#
.SYNOPSIS
    Comprehensive network diagnostics for a computer
.DESCRIPTION
    Performs extended network diagnostics including trace route and advanced tests
.PARAMETER computerName
    Name of the computer to diagnose
.EXAMPLE
    Get-NetworkDiagnostics -computerName "COMPUTER01"
#>
function Get-NetworkDiagnostics {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Host "Starting comprehensive network diagnostics for '$computerName'..." -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Gray

    # Basic connectivity
    Test-PowerShellConnection -computerName $computerName

    # Network path analysis
    Write-Host "`n5. Network path analysis:" -ForegroundColor Yellow
    try {
        Write-Host "Running traceroute (this may take a moment)..." -ForegroundColor Gray
        $traceResults = Test-NetConnection -ComputerName $computerName -TraceRoute -ErrorAction Stop
        
        Write-Host "Trace route to $computerName :" -ForegroundColor Cyan
        foreach ($hop in $traceResults.TraceRoute) {
            Write-Host "   $hop" -ForegroundColor White
        }
    } catch {
        Write-Host "Traceroute failed: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host "`n" + "=" * 60 -ForegroundColor Gray
    Write-Host "Network diagnostics completed." -ForegroundColor Green
}