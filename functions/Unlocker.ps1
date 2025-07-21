param (
    [string]$UserID,
    [switch]$debug = $false
)

$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf

Write-Debug "UserID: $UserID"
Write-Debug "Stop Loop Switch: $stoploop"

if (-not $UserID) {
    Write-Host "No UserID provided. Exiting script."
    exit
}

Write-Debug "UserID: $UserID"

function Test-DomainController {
    param (
        [string]$DCName,
        [int]$TimeoutMilliseconds = 2000
    )
    
    Write-Debug "Testing connection to $DCName"
    try {
        # Test basic connectivity first
        $ping = New-Object System.Net.NetworkInformation.Ping
        $result = $ping.Send($DCName, $TimeoutMilliseconds)
        
        if ($result.Status -eq 'Success') {
            # Test LDAP connectivity using .NET instead of Test-Connection
            try {
                $ldapConnection = New-Object System.DirectoryServices.DirectoryEntry("LDAP://$DCName")
                if ($ldapConnection.Name -ne $null) {
                    Write-Debug "LDAP connection successful to $DCName"
                    return $true
                }
            }
            catch {
                Write-Debug "LDAP connection failed to $DCName : $_"
                return $false
            }
            finally {
                if ($ldapConnection) {
                    $ldapConnection.Dispose()
                }
            }
        }
        return $false
    }
    catch {
        Write-Debug "DC $DCName is not responding: $_"
        return $false
    }
}

function Get-DomainRoot {
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        $rootDSE = New-Object System.DirectoryServices.DirectoryEntry("LDAP://$($currentDomain.Name)/RootDSE")
        $domainRoot = $rootDSE.defaultNamingContext
        $ldapPath = "LDAP://OU=Domain Controllers,$($currentDomain.distinguishedName)"

        Write-Debug "LDAP path: $ldapPath"
        Write-Debug "Domain root: $domainRoot"

        return @{
            DomainRoot = $domainRoot
            LdapPath = $ldapPath
        }
    } catch {
        Write-Host "Error: $_"
    }
}

$domainRoot = Get-DomainRoot

function Get-DomainControllers {
    $dcList = @{ }
    $skippedDCs = @()
    
    try {
        # Get current domain context
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        
        # Test each DC and build dictionary of available ones
        $currentDomain.DomainControllers | ForEach-Object {
            $dcName = $_.Name
            if (Test-DomainController -DCName $dcName) {
                $dcList[$dcName] = $_
            } else {
                $skippedDCs += $dcName
            }
        }

        # Get PDC emulator
        $PDC = $currentDomain.PdcRoleOwner
        
        # Check if PDC is available
        if ($skippedDCs -contains $PDC.Name) {
            Write-Debug "Primary DC ($($PDC.Name)) is not responding!"
            $PDC = $null
        }

        return @{
            DcList = $dcList       # Only available DCs
            PDC = $PDC            # PDC if available
            SkippedDCs = $skippedDCs  # List of unavailable DCs
        }
    } catch {
        Write-Debug "Error: $_"
    }
}

$result = Get-DomainControllers
$dcList = $result.DcList
$PDC = $result.PDC
$DDC = $result.DDC

function Get-OU {
    param (
        [string]$userId
    )

    try {
        $searcher = New-Object System.DirectoryServices.DirectorySearcher
        $searcher.Filter = "(sAMAccountName=$userId)"
        $user = $searcher.FindOne()
        Write-Debug "Get-OU: User search result - $user"

        if ($user) {
            $userEntry = $user.GetDirectoryEntry()
            $distinguishedName = $userEntry.distinguishedName
            $parts = $distinguishedName.Split(',')
            $firstOU = $parts[1].Replace('OU=', '')

            if ($debug) { Write-Host "OU: $firstOU" }
            return $firstOU
        } else {
            Write-Host "User does not exist, check ID and try again."
        }
    } catch {
        Write-Host "Error: $_"
    }
}

function Check-LockedOut {
    param (
        [string]$userId,
        [string]$targetDC,
        [string]$domainRoot
    )

    try {
        $searcher = New-Object System.DirectoryServices.DirectorySearcher
        $searcher.Filter = "(sAMAccountName=$userId)"
        
        if ($targetDC -ne 0) {
            $searcher.SearchRoot = "LDAP://$targetDC/$domainRoot"
        } else {
            Write-Debug "Skipping check for user on null Domain Controller"
            return
        }

        $user = $searcher.FindOne()
        Write-Debug "Check-LockedOut: User search result - $user"

        if ($user -ne $null) {
            $userEntry = $user.GetDirectoryEntry()
            $isLockedOut = $userEntry.InvokeGet("IsAccountLocked")
            if ($isLockedOut) {
                Write-Host "Locked Out: True" -ForegroundColor Red
            } else {
                Write-Host "Locked Out: False" -ForegroundColor Green
            }
        } else {
            Write-Host "User not found on the target Domain Controller" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Error: $_"
    }
}

function Match-OUtoDC {
    param (
        [string]$OU,
        [hashtable]$dcList
    )

    $pattern = "^\d+"
    $matches = $dcList.Values.Name | Select-String -Pattern $pattern -AllMatches | ForEach-Object { $_.Matches.Value }

    if ($matches -contains $OU) {
        foreach ($dc in $dcList.Values) {
            $dcName = $dc.Name | Select-String -Pattern $pattern -AllMatches | ForEach-Object { $_.Matches.Value }
            if ($dcName -contains $OU) {
                Write-Host "Matched DC: $($dc.Name)" -ForegroundColor Green
                return $dc.Name
            }
        }
    } else {
        Write-Debug "OU $OU not found in the list."
    }

    Write-Debug "No matching DC found for OU: $OU" 
    return "0"
}

function Unlock-User {
    param (
        [string]$userId,
        [string]$targetDC,
        [hashtable]$dcList,
        [string]$domainRoot
    )

    $searcher = New-Object System.DirectoryServices.DirectorySearcher
    $searcher.Filter = "(sAMAccountName=$userId)"

    if ($targetDC -eq "0") {
        # Only attempt unlock on available DCs from dcList
        foreach ($dc in $dcList.Values) {
            $searcher.SearchRoot = "LDAP://$($dc.Name)/$domainRoot"
            try {
                $user = $searcher.FindOne()
                Write-Debug "Unlock-User: User search result on $($dc.Name) - $user"

                if ($user) {
                    $userEntry = $user.GetDirectoryEntry()
                    try {
                        $userEntry.Properties["lockoutTime"].Value = 0
                        $userEntry.CommitChanges()
                        $unlockResults[$dc.Name] = $true
                        Write-Debug "Successfully unlocked user on $($dc.Name)"
                    } catch {
                        if ($_.Exception.Message -match "Access is denied") {
                            $unlockResults[$dc.Name] = "Access Denied"
                        } else {
                            $unlockResults[$dc.Name] = "An Error Occurred"
                        }
                        Write-Debug "Error unlocking on $($dc.Name): $_"
                    }
                } else {
                    $unlockResults[$dc.Name] = $false
                    Write-Debug "User not found on $($dc.Name)"
                }
            } catch {
                $unlockResults[$dc.Name] = "An Error Occurred"
                Write-Debug "Error searching on $($dc.Name): $_"
            }
        }
    } else {
        # Single DC unlock attempt
        if ($dcList.ContainsKey($targetDC)) {
            # ...existing single DC code is good...
        } else {
            Write-Debug "Target DC $targetDC not in available DC list"
            $unlockResults[$targetDC] = $false
        }
    }
}

$unlockResults = @{}

$OU = Get-OU -userId $UserID
$targetDC = Match-OUtoDC -OU $OU -dcList $dcList
Check-LockedOut -userId $UserID -targetDC $targetDC -domainRoot $domainRoot.DomainRoot

Unlock-User -userId $UserID -targetDC $targetDC -dcList $dcList -domainRoot $domainRoot.DomainRoot
if ($targetDC -ne '0') {
    Unlock-User -userId $UserID -targetDC $PDC -dcList $dcList -domainRoot $domainRoot.DomainRoot
    Unlock-User -userId $UserID -targetDC $DDC -dcList $dcList -domainRoot $domainRoot.DomainRoot
}

# Determine the final result
$finalResult = if ($unlockResults.Values -contains $true) {
    "$UserID Unlocked"
} elseif ($unlockResults.Values -contains "Access Denied") {
    "Access Denied"
} else {
    "An Error Occurred"
}

# Output the final result as JSON
$finalResult | ConvertTo-Json -Compress