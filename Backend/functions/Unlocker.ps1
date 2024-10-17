param (
    [string]$UserID,
    [switch]$debug = $false
)

$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf

if ($debug) {
    $debugPreferenceChoice = Read-Host "See debug lines (Continue) or debug (Inquire)? Default is Continue. (C/I)"

    if ($debugPreferenceChoice -eq 'I' -or $debugPreferenceChoice -eq 'i') {
        $DebugPreference = 'Inquire'
        Write-Host "Debugging is enabled with Inquire preference" -ForegroundColor Green
    } else {
        $DebugPreference = 'Continue'
        Write-Host "Debugging is enabled with Continue preference" -ForegroundColor Green
    }
}

if (-not $UserID) {
    Write-Host "No UserID provided. Exiting script."
    exit
}

Write-Debug "UserID: $UserID"

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
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        Write-Debug "Current Domain: $($currentDomain)"

        $currentDomain.DomainControllers | ForEach-Object {
            $dcList[$_.Name] = $_
        }

        $PDC = $currentDomain.PdcRoleOwner
        Write-Debug "Primary DC: $($PDC)"

        $DDC = $currentDomain.RidRoleOwner
        Write-Debug "Distributed DC: $($DDC)"
        Write-Debug "Number of domain controllers found: $($dcList.Count)"

        return @{
            DcList = $dcList
            PDC = $PDC
            DDC = $DDC
        }
    } catch {
        Write-Host "Error: $_"
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
        foreach ($dc in $dcList.Values) {
            $searcher.SearchRoot = "LDAP://$($dc.Name)/$domainRoot"
            $user = $searcher.FindOne()
            Write-Debug "Unlock-User: User search result - $user"

            if ($user) {
                $userEntry = $user.GetDirectoryEntry()
                $userEntry.Properties["lockoutTime"].Value = 0
                $userEntry.CommitChanges()
                $unlockResults[$dc.Name] = $true
            } else {
                $unlockResults[$dc.Name] = $false
            }
        }
    } else {
        if ($dcList.ContainsKey($targetDC)) {
            $searcher.SearchRoot = "LDAP://$targetDC/$domainRoot"
            try {
                $user = $searcher.FindOne()
                Write-Debug "Unlock-User2: User search result - $user"
                if ($user) {
                    $userEntry = $user.GetDirectoryEntry()
                    $userEntry.Properties["lockoutTime"].Value = 0
                    $userEntry.CommitChanges()
                    $unlockResults[$targetDC] = $true
                } else {
                    $unlockResults[$targetDC] = $false
                }
            } catch {
                $unlockResults[$targetDC] = $false
            }
        } else {
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

# Output the results as JSON
$unlockResults | ConvertTo-Json -Compress