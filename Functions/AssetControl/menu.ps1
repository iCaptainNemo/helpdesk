<#
.SYNOPSIS
    Dynamic Asset Control menu system handler
.DESCRIPTION
    Provides computer selection and dynamic menu system for Asset Control features.
    Reads YAML configuration to build menu options and dispatch function calls.
.PARAMETER userId
    The user ID for context
.EXAMPLE
    Asset-Control -userId "jdoe"
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: YAML configuration file at Config/AssetControlMenu.yaml
#>

function Asset-Control {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$false)]
        [string]$computerName 
    )

    Write-Debug "Starting Asset-Control for user: $userId"

    # Check if PowerShell AD module is available
    if ($script:EnvironmentInfo.PowerShellAD -eq $true) {

        # Add a line break for spacing
        Write-Host "`n"

        # Get possible computers from log entries
        $result = Show-LastLogEntries
        $possibleComputers = $result.PossibleComputers

        # Remove duplicates and sort
        $possibleComputers = $possibleComputers | Sort-Object | Get-Unique

        # Display possible computers as a numbered list
        Write-Host "Possible Computers:"
        $psLoggedOnPath = ".\Tools\PsLoggedon.exe"
        $computerStatus = @{}

        # Cast into array for indexing
        $possibleComputers = [array]$possibleComputers

        for ($i = 0; $i -lt $possibleComputers.Count; $i++) {
            $computerName = $possibleComputers[$i]

            # Check if the computer is part of the domain
            $computerInDomain = Get-ADComputer -Filter {Name -eq $computerName} -ErrorAction SilentlyContinue

            if ($null -eq $computerInDomain) {
                Write-Host "$($i + 1). $computerName - Not part of domain" -ForegroundColor DarkGray
                continue
            }

            # Check if the user is logged on to the computer (with caching)
            if ($computerStatus.ContainsKey($computerName)) {
                $isUserLoggedIn = $computerStatus[$computerName]
            } else {
                try {
                    $output = & $psLoggedOnPath -l -x \\$computerName | Out-String
                    $isUserLoggedIn = $output -match $userId
                    $computerStatus[$computerName] = $isUserLoggedIn
                } catch {
                    Write-Host ("Error running PsLoggedOn for " + $computerName + ": " + $_.Exception.Message) -ForegroundColor Red
                    continue
                }
            }

            # Color code based on login status
            if ($isUserLoggedIn) {
                Write-Host "$($i + 1). $computerName" -ForegroundColor Green
            } else {
                Write-Host "$($i + 1). $computerName"
            }
        }
    }

    # Prompt for Computer Name or number
    $input = Read-Host "Enter Computer Name or number (1-10, C to cancel):"

    # Check if the input is 'C' or 'c' to cancel
    if ($input -eq 'C' -or $input -eq 'c') {
        Write-Host "Selection cancelled."
        return
    } elseif ($input -match '^[1-9]$|^10$') {
        # Map number to computer name
        $computerName = $possibleComputers[$input - 1]
    } else {
        # Use input as computer name
        $computerName = $input
    }

    Write-Host "`n"
    Write-Host "Selected computer: $computerName"

    # Display computer information if PowerShell AD is available
    if ($script:EnvironmentInfo.PowerShellAD -eq $true) {
        Show-ComputerInfo -computerName $computerName
    }

    # Load and display dynamic menu
    Show-AssetControlMenu -userId $userId -computerName $computerName
}

<#
.SYNOPSIS
    Display computer information and properties
.DESCRIPTION
    Shows computer properties including group membership, OU, and connectivity status
.PARAMETER computerName
    Name of the computer to display information for
#>
function Show-ComputerInfo {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    try {
        $computer = Get-ADComputer $computerName -Properties *
        if ($computer) {

            # Get the OU of the computer
            $ou = ($computer.DistinguishedName -replace '^CN=.*?,(.*?),(DC=.*)$', '$1').Replace(',', '/').Replace('CN=Computers', '').Trim()

            # Display properties with color coding
            $properties = @(
                @{ Name = 'Computer Reachable'; Value = if (Test-Connection -Count 1 -ComputerName $computerName -Quiet) { 'True' } else { 'False' } }
                @{ Name = 'IPv4 Address'; Value = $computer.IPv4Address }
                @{ Name = 'OU'; Value = $ou }
            )

            # Display with color coding
            $properties | ForEach-Object {
                $propertyName = $_.Name
                $propertyValue = $_.Value

                if ($propertyName -eq 'OU' -and $propertyValue -eq 'OU=HS Computers') {
                    Write-Host "${propertyName}: ${propertyValue}" -ForegroundColor Red
                } elseif ([string]::IsNullOrEmpty($propertyValue)) {
                    Write-Host "${propertyName}: ${propertyValue}" -ForegroundColor Red
                } else {
                    Write-Host "${propertyName}: ${propertyValue}" -ForegroundColor Green
                }
            }
            Write-Host "`n"
        }
    } catch {
        Write-Host "Error getting properties for $computerName $_" -ForegroundColor Red
    }
}

<#
.SYNOPSIS
    Display dynamic Asset Control menu based on YAML configuration
.DESCRIPTION
    Loads menu configuration from YAML file and creates interactive menu system
.PARAMETER userId
    The user ID for context
.PARAMETER computerName
    The target computer name
#>
function Show-AssetControlMenu {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    $configPath = Join-Path $PSScriptRoot "..\..\Config\AssetControlMenu.yaml"
    Write-Debug "Loading Asset Control menu config from: $configPath"

    # Load menu configuration
    if (-not (Test-Path $configPath)) {
        Write-Error "Asset Control menu configuration not found: $configPath"
        Write-Host "Falling back to basic menu..." -ForegroundColor Yellow
        Show-BasicAssetMenu -userId $userId -computerName $computerName
        return
    }

    try {
        $menuConfig = Get-Content $configPath -Raw | ConvertFrom-Yaml
        Write-Debug "Menu configuration loaded successfully"
    } catch {
        Write-Error "Failed to load menu configuration: $($_.Exception.Message)"
        Write-Host "Falling back to basic menu..." -ForegroundColor Yellow
        Show-BasicAssetMenu -userId $userId -computerName $computerName
        return
    }

    # Display dynamic menu
    while ($true) {
        Write-Host "`n$($menuConfig.menu.title)" -ForegroundColor Cyan
        if ($menuConfig.menu.description) {
            Write-Host $menuConfig.menu.description -ForegroundColor Gray
        }
        Write-Host ""

        # Show only enabled menu items - sort numerically by converting id to integer
        $enabledItems = $menuConfig.menu.items | Where-Object { $_.enabled -eq $true } | Sort-Object { [int]$_.id }

        foreach ($item in $enabledItems) {
            Write-Host "$($item.id). $($item.name)"
        }

        Write-Host "0. Back to Main Menu"
        Write-Host ""

        $choice = Read-Host "Enter your choice"

        if ($choice -eq "0") { 
            return 
        }

        # Find selected menu item
        $selectedItem = $enabledItems | Where-Object { $_.id -eq [int]$choice }
        if ($selectedItem) {
            try {
                $functionName = $selectedItem.function
                Write-Debug "Attempting to call function: $functionName"
                
                # Check if function exists
                if (Get-Command $functionName -ErrorAction SilentlyContinue) {
                    # Call the function with parameters
                    & $functionName -userId $userId -computerName $computerName
                    
                    # Clear screen and redisplay context for clean menu experience
                    if (-not $DebugPreference -eq 'Continue') { 
                        Clear-Host 
                        
                        # Redisplay selected computer context
                        Write-Host "Selected computer: $computerName" -ForegroundColor Cyan
                        
                        # Show computer information if PowerShell AD is available
                        if ($script:EnvironmentInfo.PowerShellAD -eq $true) {
                            Show-ComputerInfo -computerName $computerName
                        }
                        Write-Host ""
                    }
                } else {
                    Write-Host "Function not found: $functionName" -ForegroundColor Red
                    Write-Host "Please check that the module '$($selectedItem.module).ps1' is loaded" -ForegroundColor Yellow
                    Read-Host "Press Enter to continue"
                }
            } catch {
                Write-Host "Error executing $($selectedItem.name): $($_.Exception.Message)" -ForegroundColor Red
                Write-Debug "Exception details: $($_.Exception)"
                Read-Host "Press Enter to continue"
            }
        } else {
            Write-Host "Invalid choice" -ForegroundColor Red
            Start-Sleep 1
        }
    }
}

<#
.SYNOPSIS
    Fallback basic menu if YAML configuration fails
.DESCRIPTION
    Provides essential Asset Control functions when YAML system is unavailable
.PARAMETER userId
    The user ID for context
.PARAMETER computerName
    The target computer name
#>
function Show-BasicAssetMenu {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    while ($true) {
        Write-Host "`nBasic Asset Control Menu" -ForegroundColor Yellow
        Write-Host "1. Test Connection"
        Write-Host "2. Get LAPS Password"
        Write-Host "3. Get BitLocker Recovery"
        Write-Host "0. Back to Main Menu"

        $choice = Read-Host "Enter your choice"

        switch ($choice) {
            '1' {
                if (Test-Connection -ComputerName $computerName -Count 1 -Quiet) {
                    Write-Host "Connection to $computerName successful" -ForegroundColor Green
                } else {
                    Write-Host "Connection to $computerName failed" -ForegroundColor Red
                }
                Read-Host "Press Enter to continue"
            }
            '2' {
                if (Get-Command "Get-LAPSPassword" -ErrorAction SilentlyContinue) {
                    $lapsPassword = Get-LAPSPassword -computerName $computerName
                    Write-Host "LAPS Password: $lapsPassword" -ForegroundColor Cyan
                } else {
                    Write-Host "LAPS function not available" -ForegroundColor Red
                }
                Read-Host "Press Enter to continue"
            }
            '3' {
                try {
                    $distinguishedName = (Get-ADComputer -Identity $computerName -ErrorAction Stop).DistinguishedName
                    # Load AD properties configuration for BitLocker query
                    $adPropsConfig = Get-ADPropertiesConfig
                    $bitLockerProperties = $adPropsConfig.PowerShellAD.ObjectProperties.BitLocker
                    $bitLockerRecoveryInfo = Get-ADObject -Filter { ObjectClass -eq "msFVE-RecoveryInformation" } -SearchBase $distinguishedName -Properties $bitLockerProperties
                    
                    if ($bitLockerRecoveryInfo) {
                        $latestRecoveryKey = $bitLockerRecoveryInfo | Sort-Object whenCreated -Descending | Select-Object -First 1
                        Write-Host "`nLatest Recovery Key:" -ForegroundColor Yellow
                        Write-Host "Date: $($latestRecoveryKey.whenCreated)" -ForegroundColor Yellow
                        Write-Host "Recovery Password: $($latestRecoveryKey.'msFVE-RecoveryPassword')" -ForegroundColor Green
                    } else {
                        Write-Host "No BitLocker recovery info found for $computerName" -ForegroundColor Yellow
                    }
                } catch {
                    Write-Host "Error retrieving BitLocker recovery info: $($_.Exception.Message)" -ForegroundColor Red
                }
                Read-Host "Press Enter to continue"
            }
            '0' { return }
            default {
                Write-Host "Invalid choice" -ForegroundColor Red
                Start-Sleep 1
            }
        }
    }
}