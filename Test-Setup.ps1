# Test script to validate the WPF Helpdesk GUI setup
# Run this before launching the main application

param([switch]$Verbose = $false)

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "Helpdesk GUI - WPF Edition - Setup Validation Test" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

$testsPassed = 0
$testsFailed = 0

function Test-Requirement {
    param(
        [string]$TestName,
        [scriptblock]$Test,
        [string]$SuccessMessage,
        [string]$FailureMessage,
        [string]$FixInstructions = ""
    )
    
    Write-Host "Testing: $TestName..." -NoNewline
    
    try {
        $result = & $Test
        if ($result) {
            Write-Host " ✓ PASS" -ForegroundColor Green
            if ($Verbose -and $SuccessMessage) {
                Write-Host "  $SuccessMessage" -ForegroundColor Gray
            }
            $script:testsPassed++
            return $true
        } else {
            Write-Host " ✗ FAIL" -ForegroundColor Red
            Write-Host "  $FailureMessage" -ForegroundColor Yellow
            if ($FixInstructions) {
                Write-Host "  Fix: $FixInstructions" -ForegroundColor Cyan
            }
            $script:testsFailed++
            return $false
        }
    }
    catch {
        Write-Host " ✗ ERROR" -ForegroundColor Red
        Write-Host "  $FailureMessage" -ForegroundColor Yellow
        if ($Verbose) {
            Write-Host "  Error details: $_" -ForegroundColor Gray
        }
        if ($FixInstructions) {
            Write-Host "  Fix: $FixInstructions" -ForegroundColor Cyan
        }
        $script:testsFailed++
        return $false
    }
}

# Test PowerShell version
Test-Requirement -TestName "PowerShell Version (5.1+)" -Test {
    return $PSVersionTable.PSVersion.Major -ge 5 -and 
           ($PSVersionTable.PSVersion.Major -gt 5 -or $PSVersionTable.PSVersion.Minor -ge 1)
} -SuccessMessage "PowerShell version $($PSVersionTable.PSVersion) is supported" `
  -FailureMessage "PowerShell 5.1 or later is required" `
  -FixInstructions "Upgrade PowerShell or use Windows PowerShell 5.1"

# Test .NET Framework assemblies
Test-Requirement -TestName ".NET WPF Assemblies" -Test {
    try {
        Add-Type -AssemblyName PresentationFramework
        Add-Type -AssemblyName PresentationCore  
        Add-Type -AssemblyName WindowsBase
        return $true
    } catch {
        return $false
    }
} -SuccessMessage ".NET Framework WPF assemblies are available" `
  -FailureMessage ".NET Framework 4.7.2+ with WPF support is required" `
  -FixInstructions "Install .NET Framework 4.7.2 or later"

# Test Active Directory module
Test-Requirement -TestName "Active Directory PowerShell Module" -Test {
    return Get-Module -ListAvailable -Name "ActiveDirectory" -ErrorAction SilentlyContinue
} -SuccessMessage "Active Directory module is available" `
  -FailureMessage "Active Directory PowerShell module is not installed" `
  -FixInstructions "Install RSAT-AD-PowerShell: Enable-WindowsOptionalFeature -Online -FeatureName RSATClient-Roles-AD-Powershell"

# Test XAML file
Test-Requirement -TestName "XAML UI File" -Test {
    return Test-Path ".\HelpdeskGUI.xaml"
} -SuccessMessage "XAML file found" `
  -FailureMessage "HelpdeskGUI.xaml file is missing" `
  -FixInstructions "Ensure HelpdeskGUI.xaml is in the current directory"

# Test XAML validity
Test-Requirement -TestName "XAML File Validity" -Test {
    if (Test-Path ".\HelpdeskGUI.xaml") {
        try {
            [xml]$xaml = Get-Content ".\HelpdeskGUI.xaml"
            return $xaml -ne $null
        } catch {
            return $false
        }
    }
    return $false
} -SuccessMessage "XAML file is valid XML" `
  -FailureMessage "XAML file contains syntax errors" `
  -FixInstructions "Check XAML file for XML syntax errors"

# Test functions directory
Test-Requirement -TestName "PowerShell Functions Directory" -Test {
    return Test-Path ".\functions" -PathType Container
} -SuccessMessage "Functions directory exists" `
  -FailureMessage "Functions directory is missing" `
  -FixInstructions "Create the functions directory and copy PowerShell scripts"

# Test key PowerShell functions
$keyFunctions = @("Get-ADObject.ps1", "Unlocker.ps1", "Get-DomainControllers.ps1")
foreach ($func in $keyFunctions) {
    Test-Requirement -TestName "Function: $func" -Test {
        return Test-Path ".\functions\$func"
    } -SuccessMessage "$func is present" `
      -FailureMessage "$func is missing" `
      -FixInstructions "Copy the function from the Backend/functions directory"
}

# Test lib directory
Test-Requirement -TestName "Library Directory" -Test {
    return Test-Path ".\lib" -PathType Container
} -SuccessMessage "Library directory exists" `
  -FailureMessage "Library directory is missing" `
  -FixInstructions "Create the lib directory for SQLite DLL"

# Test SQLite DLL (optional but recommended)
Test-Requirement -TestName "SQLite Library (Optional)" -Test {
    return Test-Path ".\lib\System.Data.SQLite.dll"
} -SuccessMessage "SQLite library is available for database features" `
  -FailureMessage "SQLite library is missing - database features will be disabled" `
  -FixInstructions "Download System.Data.SQLite.dll from https://system.data.sqlite.org and place in lib folder"

# Test database directory
Test-Requirement -TestName "Database Directory" -Test {
    if (-not (Test-Path ".\database" -PathType Container)) {
        New-Item -Path ".\database" -ItemType Directory -Force | Out-Null
    }
    return Test-Path ".\database" -PathType Container
} -SuccessMessage "Database directory ready" `
  -FailureMessage "Cannot create database directory" `
  -FixInstructions "Check write permissions in the current directory"

# Test domain connectivity (if on domain)
if ((Get-WmiObject -Class Win32_ComputerSystem).PartOfDomain) {
    Test-Requirement -TestName "Domain Connectivity" -Test {
        try {
            $domain = Get-ADDomain -ErrorAction Stop
            return $domain -ne $null
        } catch {
            return $false
        }
    } -SuccessMessage "Domain connectivity is working" `
      -FailureMessage "Cannot connect to Active Directory domain" `
      -FixInstructions "Check network connectivity and domain authentication"
} else {
    Write-Host "Testing: Domain Connectivity..." -NoNewline
    Write-Host " SKIP (Not domain-joined)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "Test Results Summary:" -ForegroundColor Cyan
Write-Host "  Tests Passed: $testsPassed" -ForegroundColor Green
Write-Host "  Tests Failed: $testsFailed" -ForegroundColor Red

if ($testsFailed -eq 0) {
    Write-Host ""
    Write-Host "✓ All tests passed! Your environment is ready." -ForegroundColor Green
    Write-Host "  You can now run: .\Start-HelpdeskGUI.ps1" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "⚠ Some tests failed. Please address the issues above." -ForegroundColor Yellow
    Write-Host "  The application may still work with limited functionality." -ForegroundColor Gray
}

Write-Host "===========================================================" -ForegroundColor Cyan
