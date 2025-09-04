<#
.SYNOPSIS
    Advanced inline user account unlock functionality using cached domain controllers
.DESCRIPTION
    Unlocks user accounts on targeted domain controllers using OU-specific optimization.
    Detects user's Organizational Unit and matches to appropriate domain controllers,
    reducing unlock operations from 26+ DCs to typically 3 essential DCs. Based on the
    advanced Unlocker.ps1 functionality but optimized for inline use within jarvis.ps1.
.PARAMETER userId
    The user ID to unlock
.PARAMETER stopLoop
    If true, suppresses some output for cleaner operation
.EXAMPLE
    Unlock-UserAdvanced -userId "jdoe"
.NOTES
    Author: Helpdesk Team
    Version: 3.0 - Optimized with cached domain controllers
    Requires: Cached domain controllers from jarvis startup
#>

<#
.SYNOPSIS
    Get user's Organizational Unit from Distinguished Name
.DESCRIPTION
    Extracts the first OU from user's Distinguished Name for targeted DC selection
.PARAMETER userId
    The user ID to lookup
.PARAMETER domainRoot
    Domain root DN for LDAP queries
#>
function Get-UserOU {
    param (
        [string]$userId,
        [string]$domainRoot
    )
    
    try {
        $searcher = New-Object System.DirectoryServices.DirectorySearcher
        $searcher.Filter = "(sAMAccountName=$userId)"
        $searcher.SearchRoot = "LDAP://$domainRoot"
        
        $user = $searcher.FindOne()
        Write-Debug "Get-UserOU: User search result - $user"
        
        if ($user) {
            $userEntry = $user.GetDirectoryEntry()
            $distinguishedName = $userEntry.distinguishedName
            
            # Extract OU from DN: CN=user,OU=Department,DC=domain,DC=com
            $parts = $distinguishedName.Split(',')
            
            # Find first OU in the DN
            foreach ($part in $parts) {
                if ($part.Trim().StartsWith('OU=')) {
                    $firstOU = $part.Replace('OU=', '').Trim()
                    Write-Debug "User OU detected: $firstOU"
                    return $firstOU
                }
            }
            
            Write-Debug "No OU found in user DN: $distinguishedName"
            return $null
        } else {
            Write-Warning "User $userId not found for OU detection"
            return $null
        }
    } catch {
        Write-Warning "Error getting user OU: $($_.Exception.Message)"
        return $null
    } finally {
        if ($searcher) {
            $searcher.Dispose()
        }
    }
}

<#
.SYNOPSIS
    Get optimized domain controller list based on user's OU
.DESCRIPTION
    Implements OU-to-DC matching logic similar to root unlocker for targeted unlocks
.PARAMETER userOU
    The user's Organizational Unit
.PARAMETER domainRoot
    Domain root DN for context
#>
function Get-OptimizedDCList {
    param (
        [string]$userOU,
        [string]$domainRoot
    )
    
    $optimizedDCs = @()
    
    if ([string]::IsNullOrEmpty($userOU)) {
        Write-Debug "No OU specified, using essential DCs only"
        # Return essential DCs - prioritize PowerShell-enabled DCs
        if ($script:PSDomains.Count -gt 0) {
            $optimizedDCs += $script:PSDomains[0..([Math]::Min(2, $script:PSDomains.Count - 1))]
        }
        if ($optimizedDCs.Count -lt 3 -and $script:cmdDomains.Count -gt 0) {
            $needed = 3 - $optimizedDCs.Count
            $optimizedDCs += $script:cmdDomains[0..([Math]::Min($needed - 1, $script:cmdDomains.Count - 1))]
        }
        return $optimizedDCs
    }
    
    # OU-specific DC matching (similar to root unlocker's Match-OUtoDC)
    $pattern = "^\d+"  # Extract numeric prefix from OU
    
    if ($userOU -match $pattern) {
        $ouNumber = $matches[0]
        Write-Debug "Looking for DCs matching OU pattern: $ouNumber"
        
        # Check PowerShell-enabled DCs first
        foreach ($dcName in $script:PSDomains) {
            if ($dcName -match $pattern -and $matches[0] -eq $ouNumber) {
                $optimizedDCs += $dcName
                Write-Debug "Matched PowerShell DC: $dcName"
                break  # Found the specific DC for this OU
            }
        }
        
        # Check command-line DCs if no PowerShell match
        if ($optimizedDCs.Count -eq 0) {
            foreach ($dcName in $script:cmdDomains) {
                if ($dcName -match $pattern -and $matches[0] -eq $ouNumber) {
                    $optimizedDCs += $dcName
                    Write-Debug "Matched command-line DC: $dcName"
                    break  # Found the specific DC for this OU
                }
            }
        }
    }
    
    # Always include a few essential DCs for replication coverage
    if ($script:PSDomains.Count -gt 0) {
        $optimizedDCs += $script:PSDomains[0]  # First PowerShell DC (likely PDC)
        if ($script:PSDomains.Count -gt 1 -and $optimizedDCs.Count -lt 3) {
            $optimizedDCs += $script:PSDomains[1]  # Second PowerShell DC
        }
    }
    
    # Remove duplicates and limit to reasonable number
    $optimizedDCs = $optimizedDCs | Select-Object -Unique | Select-Object -First 3
    
    Write-Debug "Optimized DC list ($($optimizedDCs.Count) DCs): $($optimizedDCs -join ', ')"
    return $optimizedDCs
}

function Unlock-UserAdvanced {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$false)]
        [bool]$stopLoop = $true
    )
    
    Write-Debug "Starting advanced unlock for user: $userId"
    
    # Use cached domain controllers for optimal performance
    if (-not $script:PSDomains -and -not $script:cmdDomains) {
        Write-Host "Domain controllers not initialized. Testing now..." -ForegroundColor Yellow
        try {
            Test-DomainControllers
            Initialize-DomainControllerVariables
        } catch {
            Write-Error "Failed to initialize domain controllers: $($_.Exception.Message)"
            return $false
        }
    }
    
    # Get domain root for LDAP operations
    try {
        $domainRoot = (Get-ADDomain).DistinguishedName
        Write-Debug "Domain root: $domainRoot"
    } catch {
        Write-Error "Failed to get domain information: $($_.Exception.Message)"
        return $false
    }
    
    # Get user's OU for targeted unlock (like root unlocker)
    $userOU = Get-UserOU -userId $userId -domainRoot $domainRoot
    
    # Create optimized DC list based on OU matching
    $targetDCs = Get-OptimizedDCList -userOU $userOU -domainRoot $domainRoot
    
    if ($targetDCs.Count -eq 0) {
        Write-Warning "No optimized DCs found, falling back to essential DCs only"
        # Fallback to essential DCs (PDC + first available PowerShell DC)
        $targetDCs = @()
        if ($script:PSDomains.Count -gt 0) {
            $targetDCs += $script:PSDomains[0]  # First PowerShell-enabled DC
        } elseif ($script:cmdDomains.Count -gt 0) {
            $targetDCs += $script:cmdDomains[0]  # First command-line DC
        }
    }
    
    if ($targetDCs.Count -eq 0) {
        Write-Error "No domain controllers available for unlock operation"
        return $false
    }
    
    Write-Debug "Optimized unlock: $userId on $($targetDCs.Count) targeted domain controllers"
    
    $unlockResults = @()
    $successCount = 0
    $errorCount = 0
    
    # Process each domain controller
    foreach ($dcName in $targetDCs) {
        try {
            Write-Debug "Processing DC: $dcName"
            
            # Create LDAP searcher for this DC
            $searcher = New-Object System.DirectoryServices.DirectorySearcher
            $searcher.Filter = "(sAMAccountName=$userId)"
            $searcher.SearchRoot = "LDAP://$dcName/$domainRoot"
            
            # Find the user
            $user = $searcher.FindOne()
            
            if ($user) {
                # Get user entry and unlock by setting lockoutTime to 0
                $userEntry = $user.GetDirectoryEntry()
                $userEntry.Properties["lockoutTime"].Value = 0
                $userEntry.CommitChanges()
                
                $successCount++
                $result = "Account unlocked on $dcName"
                $unlockResults += @{
                    DC = $dcName
                    Status = "Success"
                    Message = $result
                }
                
                if (-not $stopLoop) {
                    Write-Host $result -BackgroundColor DarkGreen
                } else {
                    Write-Debug $result
                }
                
            } else {
                $errorCount++
                $result = "User not found on $dcName"
                $unlockResults += @{
                    DC = $dcName
                    Status = "UserNotFound"
                    Message = $result
                }
                Write-Debug $result
            }
            
        } catch {
            $errorCount++
            $result = "Error unlocking on $dcName`: $($_.Exception.Message)"
            $unlockResults += @{
                DC = $dcName
                Status = "Error" 
                Message = $result
            }
            Write-Debug $result
        } finally {
            # Clean up searcher
            if ($searcher) {
                $searcher.Dispose()
            }
        }
    }
    
    # Summary output
    if ($stopLoop) {
        Write-Host "Unlock Summary:" -ForegroundColor Cyan
        Write-Host "  Successful: $successCount DCs" -ForegroundColor Green
        if ($errorCount -gt 0) {
            Write-Host "  Errors: $errorCount DCs" -ForegroundColor Yellow
        }
        Write-Host "  Total processed: $($targetDCs.Count) DCs" -ForegroundColor Gray
    }
    
    # Return success if at least one DC was unlocked successfully
    $overallSuccess = $successCount -gt 0
    
    Write-Debug "Unlock operation completed. Success: $overallSuccess (Successful: $successCount, Errors: $errorCount)"
    
    return $overallSuccess
}

<#
.SYNOPSIS
    Check if a user account is locked out on domain controllers
.DESCRIPTION
    Checks lockout status using cached domain controllers for performance
.PARAMETER userId
    The user ID to check
.EXAMPLE
    Test-UserLockStatus -userId "jdoe"
#>
function Test-UserLockStatus {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId
    )
    
    Write-Debug "Checking lock status for user: $userId"
    
    # Use cached domain controllers
    if (-not $script:PSDomains -and -not $script:cmdDomains) {
        Write-Warning "Domain controllers not initialized. Cannot check lock status."
        return $false
    }
    
    try {
        $domainRoot = (Get-ADDomain).DistinguishedName
        
        # Check first available DC from PowerShell-enabled DCs (most reliable)
        $dcToCheck = if ($script:PSDomains.Count -gt 0) { $script:PSDomains[0] } else { $script:cmdDomains[0] }
        
        $searcher = New-Object System.DirectoryServices.DirectorySearcher
        $searcher.Filter = "(sAMAccountName=$userId)"
        $searcher.SearchRoot = "LDAP://$dcToCheck/$domainRoot"
        
        $user = $searcher.FindOne()
        
        if ($user) {
            $userEntry = $user.GetDirectoryEntry()
            $isLockedOut = $userEntry.InvokeGet("IsAccountLocked")
            
            Write-Debug "User $userId lock status on $dcToCheck`: $isLockedOut"
            return $isLockedOut
        } else {
            Write-Debug "User $userId not found on $dcToCheck"
            return $false
        }
        
    } catch {
        Write-Debug "Error checking lock status: $($_.Exception.Message)"
        return $false
    } finally {
        if ($searcher) {
            $searcher.Dispose()
        }
    }
}