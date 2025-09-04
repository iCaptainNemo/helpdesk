<#
.SYNOPSIS
    LAPS (Local Administrator Password Solution) management functions
.DESCRIPTION
    Provides functions to retrieve LAPS passwords for domain computers
.NOTES
    Author: Helpdesk Team  
    Version: 2.0
    Requires: Active Directory PowerShell module, LAPS read permissions
#>

<#
.SYNOPSIS
    Retrieve LAPS password for a specified computer
.DESCRIPTION
    Queries Active Directory for the LAPS password attribute of a computer object
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to retrieve LAPS password for
.EXAMPLE
    Get-LAPSPassword -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Requires appropriate permissions to read msLAPS-Password attribute
#>
function Get-LAPSPassword {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Retrieving LAPS password for computer: $computerName (requested by: $userId)"

    try {
        # Query AD for computer with LAPS password attribute
        $computer = Get-ADComputer $computerName -Properties "msLAPS-Password" -ErrorAction Stop
    
        # Check if the msLAPS-Password attribute exists and has a value
        if ($computer."msLAPS-Password") {
            Write-Host "LAPS Password for '$computerName':" -ForegroundColor Green
            Write-Host $computer."msLAPS-Password" -ForegroundColor Cyan
            Write-Host "-------------------------------------------------------------------------" -ForegroundColor Gray
            
            # Log the LAPS password retrieval if logging is enabled
            if ($script:logFilePath) {
                $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId retrieved LAPS password for $computerName"
                Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
            }
            
            Write-Debug "Successfully retrieved LAPS password for $computerName"
            return $computer."msLAPS-Password"
        }
        else {
            Write-Host "The LAPS password is not set for computer '$computerName'." -ForegroundColor Yellow
            Write-Host "This could mean:" -ForegroundColor Gray
            Write-Host "- LAPS is not configured on this computer" -ForegroundColor Gray
            Write-Host "- The password has not been set yet" -ForegroundColor Gray
            Write-Host "- You don't have permission to view the password" -ForegroundColor Gray
            
            Write-Debug "LAPS password attribute not found or empty for $computerName"
            return $null
        }
    } 
    catch [Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException] {
        Write-Host "Computer '$computerName' not found in Active Directory." -ForegroundColor Red
        Write-Debug "Computer not found in AD: $computerName"
        return $null
    }
    catch {
        Write-Host "Error retrieving LAPS password for '$computerName': $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception details: $($_.Exception)"
        return $null
    }
    finally {
        Read-Host "Press Enter to continue"
    }
}

<#
.SYNOPSIS
    Check if LAPS is configured for a computer
.DESCRIPTION
    Verifies if a computer has LAPS configuration in Active Directory
.PARAMETER computerName
    Name of the computer to check
.EXAMPLE
    Test-LAPSConfiguration -computerName "COMPUTER01"
#>
function Test-LAPSConfiguration {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Checking LAPS configuration for computer: $computerName"

    try {
        $computer = Get-ADComputer $computerName -Properties "msLAPS-Password", "msLAPS-PasswordExpirationTime" -ErrorAction Stop
        
        $hasPassword = $null -ne $computer."msLAPS-Password"
        $hasExpirationTime = $null -ne $computer."msLAPS-PasswordExpirationTime"
        
        return @{
            ComputerName = $computerName
            HasLAPSPassword = $hasPassword
            HasExpirationTime = $hasExpirationTime
            IsConfigured = $hasPassword -or $hasExpirationTime
            ExpirationTime = $computer."msLAPS-PasswordExpirationTime"
        }
    }
    catch {
        Write-Debug "Error checking LAPS configuration: $($_.Exception.Message)"
        return @{
            ComputerName = $computerName
            HasLAPSPassword = $false
            HasExpirationTime = $false
            IsConfigured = $false
            Error = $_.Exception.Message
        }
    }
}