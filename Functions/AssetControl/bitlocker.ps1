<#
.SYNOPSIS
    BitLocker recovery key management functions
.DESCRIPTION
    Provides functions to retrieve BitLocker recovery keys from Active Directory
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: Active Directory PowerShell module, BitLocker recovery key read permissions
#>

<#
.SYNOPSIS
    Retrieve BitLocker recovery keys for a specified computer
.DESCRIPTION
    Queries Active Directory for all BitLocker recovery information associated with a computer
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to retrieve BitLocker recovery keys for
.EXAMPLE
    Get-BitLockerRecovery -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Requires appropriate permissions to read msFVE-RecoveryInformation objects
#>
function Get-BitLockerRecovery {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Retrieving BitLocker recovery keys for computer: $computerName (requested by: $userId)"

    try {
        # Get the computer's distinguished name
        $computer = Get-ADComputer -Identity $computerName -ErrorAction Stop
        $distinguishedName = $computer.DistinguishedName
        
        Write-Debug "Computer DN: $distinguishedName"
        
        # Load AD properties configuration and query for BitLocker recovery information
        $adPropsConfig = Get-ADPropertiesConfig
        $bitLockerProperties = $adPropsConfig.PowerShellAD.ObjectProperties.BitLocker
        $bitLockerRecoveryInfo = Get-ADObject -Filter { ObjectClass -eq "msFVE-RecoveryInformation" } -SearchBase $distinguishedName -Properties $bitLockerProperties -ErrorAction Stop
        Write-Debug "BitLocker query using properties: $($bitLockerProperties -join ', ')"
        
        if ($bitLockerRecoveryInfo) {
            Write-Host "`nBitLocker Recovery Keys for '$computerName':" -ForegroundColor Green
            Write-Host "=" * 60 -ForegroundColor Gray
            
            # Sort by creation date (newest first) and display all keys
            $sortedKeys = $bitLockerRecoveryInfo | Sort-Object whenCreated -Descending
            $latestKey = $sortedKeys | Select-Object -First 1
            
            foreach ($key in $sortedKeys) {
                $isLatest = ($key -eq $latestKey)
                
                if ($isLatest) {
                    Write-Host "`n[LATEST] Created: $($key.whenCreated)" -ForegroundColor Yellow
                    Write-Host "Recovery Password: $($key.'msFVE-RecoveryPassword')" -ForegroundColor Green
                } else {
                    Write-Host "`nCreated: $($key.whenCreated)" -ForegroundColor Cyan
                    Write-Host "Recovery Password: $($key.'msFVE-RecoveryPassword')" -ForegroundColor White
                }
            }
            
            Write-Host "`n" + "=" * 60 -ForegroundColor Gray
            Write-Host "Total recovery keys found: $($bitLockerRecoveryInfo.Count)" -ForegroundColor Cyan
            
            # Log the BitLocker key retrieval if logging is enabled
            if ($script:logFilePath) {
                $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId retrieved BitLocker recovery keys for $computerName"
                Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
            }
            
            Write-Debug "Successfully retrieved $($bitLockerRecoveryInfo.Count) BitLocker recovery keys"
        } else {
            Write-Host "No BitLocker recovery information found for '$computerName'." -ForegroundColor Yellow
            Write-Host "`nThis could mean:" -ForegroundColor Gray
            Write-Host "- BitLocker is not enabled on this computer" -ForegroundColor Gray
            Write-Host "- Recovery keys have not been backed up to AD" -ForegroundColor Gray
            Write-Host "- You don't have permission to view recovery keys" -ForegroundColor Gray
            Write-Host "- The computer hasn't reported keys to AD yet" -ForegroundColor Gray
            
            Write-Debug "No BitLocker recovery information found for $computerName"
        }
    }
    catch [Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException] {
        Write-Host "Computer '$computerName' not found in Active Directory." -ForegroundColor Red
        Write-Debug "Computer not found in AD: $computerName"
    }
    catch {
        Write-Host "Error retrieving BitLocker recovery information for '$computerName':" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Debug "Exception details: $($_.Exception)"
    }
    finally {
        Read-Host "Press Enter to continue"
    }
}

<#
.SYNOPSIS
    Check BitLocker status for multiple computers
.DESCRIPTION
    Quickly check which computers have BitLocker recovery keys in AD
.PARAMETER computerNames
    Array of computer names to check
.EXAMPLE
    Test-BitLockerStatus -computerNames @("COMPUTER01", "COMPUTER02")
#>
function Test-BitLockerStatus {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string[]]$computerNames
    )

    Write-Debug "Checking BitLocker status for $($computerNames.Count) computers"

    $results = @()
    
    foreach ($computerName in $computerNames) {
        try {
            $computer = Get-ADComputer -Identity $computerName -ErrorAction Stop
            $bitLockerInfo = Get-ADObject -Filter { ObjectClass -eq "msFVE-RecoveryInformation" } -SearchBase $computer.DistinguishedName -ErrorAction SilentlyContinue
            
            $results += [PSCustomObject]@{
                ComputerName = $computerName
                HasRecoveryKeys = $null -ne $bitLockerInfo
                KeyCount = if ($bitLockerInfo) { $bitLockerInfo.Count } else { 0 }
                Status = if ($bitLockerInfo) { "Keys Available" } else { "No Keys Found" }
            }
        }
        catch {
            $results += [PSCustomObject]@{
                ComputerName = $computerName
                HasRecoveryKeys = $false
                KeyCount = 0
                Status = "Error: $($_.Exception.Message)"
            }
        }
    }
    
    return $results | Format-Table -AutoSize
}