param (
    [string]$UserID,
    [switch]$StopLoop,
    [switch]$debug = $false
)

$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf

Write-Debug "UserID: $UserID"
Write-Debug "Stop Loop Switch: $stoploop"

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
    $dcList = @{}
    $skippedDCs = @()
    
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        Write-Debug "Current Domain: $($currentDomain)"

        Write-Debug "`nChecking Domain Controller availability..."
        
        $currentDomain.DomainControllers | ForEach-Object {
            $dcName = $_.Name
            Write-Host "Testing DC: $dcName" -NoNewline
            
            if (Test-DomainController -DCName $dcName) {
                $dcList[$dcName] = $_
                Write-Host " - Available" -ForegroundColor Green
            }
            else {
                $skippedDCs += $dcName
                Write-Host " - Unavailable (Skipping)" -ForegroundColor Yellow
            }
        }

        # Get PDC and DDC
        $PDC = $currentDomain.PdcRoleOwner
        $DDC = $currentDomain.RidRoleOwner

        if ($skippedDCs -contains $PDC.Name) {
            Write-Warning "Primary DC ($($PDC.Name)) is not responding!"
        }
        if ($skippedDCs -contains $DDC.Name) {
            Write-Warning "Distributed DC ($($DDC.Name)) is not responding!"
        }

        Write-Host "`nResponsive DCs: $($dcList.Count)" -ForegroundColor Green
        Write-Host "Skipped DCs: $($skippedDCs.Count)" -ForegroundColor Yellow
        
        if ($skippedDCs.Count -gt 0) {
            Write-Host "Skipped Domain Controllers:" -ForegroundColor Yellow
            $skippedDCs | ForEach-Object { Write-Host "- $_" -ForegroundColor Yellow }
        }
        
        Write-Host ""

        return @{
            DcList = $dcList
            PDC = $PDC
            DDC = $DDC
            SkippedDCs = $skippedDCs
        }
    } catch {
        Write-Host "Error getting domain controllers: $_" -ForegroundColor Red
    }
}
# Call the function and store the result in a variable
$result = Get-DomainControllers

# Access the DcList, PDC, and DDC from the result
$dcList = $result.DcList
$PDC = $result.PDC
$DDC = $result.DDC
$global:SkippedDCs = $result.SkippedDCs

# Function: Get-User - Prompt for a user ID and return the sanitized valuefunction Get-User {
function Get-User {
    do {
        do {
            $userId = Read-Host "Enter Locked UserID"
            $userId = $userId.Trim() -replace '[^a-zA-Z0-9_]', ''

            if ([string]::IsNullOrEmpty($userId)) {
                Write-Host "User ID cannot be empty. Please enter a valid user ID."
                Pause
                cls
            }
        } while ([string]::IsNullOrEmpty($userId))

        $searcher = New-Object System.DirectoryServices.DirectorySearcher
        $searcher.Filter = "(sAMAccountName=$userId)"
        $user = $searcher.FindOne()
        Write-Debug "Get-User: User search result - $user"

        if ($user) {
            Write-Host "User found: $($user.Properties['displayName'])"
        } else {
            Write-Host "User does not exist, check ID and try again."
            Pause
            cls
        }
    } while (-not $user)

    return $userId
}

function PrintDebugInfo($dcList) {
    Write-Host "Domain Controllers:"
    foreach ($dc in $dcList.Values) {
        Write-Host $dc.Name
    }
}

# Debug: Print the domain controllers
if ($debug) {
    PrintDebugInfo($dcList)
}

# Function: Get-OU - Get the OU for the user
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

            # The distinguishedName is in the format: CN=<username>,OU=<ou>,DC=<domain>,DC=<com>
            # Split the distinguishedName by the comma character to get the individual parts
            $parts = $distinguishedName.Split(',')

            # The first OU will be the second part of the distinguishedName
            $firstOU = $parts[1].Replace('OU=', '')

            if ($debug) { Write-Host "OU: $firstOU" }
            return $firstOU  # Return the OU
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
        # Skip check if DC is in the SkippedDCs list
        if ($global:SkippedDCs -contains $targetDC) {
            Write-Host "Skipping check for $targetDC - DC is unavailable" -ForegroundColor Yellow
            return
        }

        $searcher = New-Object System.DirectoryServices.DirectorySearcher
        $searcher.Filter = "(sAMAccountName=$userId)"

        # Check if targetDC is not null before setting the SearchRoot
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

    # Define a regular expression pattern to extract the desired part
    $pattern = "^\d+"

    # Create a list of all the matches in the DC names
    $matches = $dcList.Values.Name | Select-String -Pattern $pattern -AllMatches | ForEach-Object { $_.Matches.Value }

    # Check if the OU is in the list of matches
    if ($matches -contains $OU) {

        # If the OU is in the list, find the corresponding DC
        foreach ($dc in $dcList.Values) {
            # Use Select-String to match the pattern and extract the matches
            $dcName = $dc.Name | Select-String -Pattern $pattern -AllMatches | ForEach-Object { $_.Matches.Value }

            # Check if the extracted part of the DC name matches the OU
            if ($dcName -contains $OU) {
                Write-Host "Matched DC: $($dc.Name)" -ForegroundColor Green
                return $dc.Name
            }
        }
    } else {
        Write-Debug "OU $OU not found in the list."
    }

    Write-Debug "No matching DC found for OU: $OU" 
    return "0"  # Return "0" when no OU is matched
}

function Unlock-User {
    param (
        [string]$userId,
        [string]$targetDC,
        [hashtable]$dcList,
        [string]$domainRoot
    )

    # Skip unlock if DC is in the SkippedDCs list
    if ($global:SkippedDCs -contains $targetDC) {
        Write-Host "Skipping unlock for $targetDC - DC is unavailable" -ForegroundColor Yellow
        return
    }

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
                if ($stopLoop -eq $false) {
                    Write-Host "Account unlocked on $($dc.Name)" -BackgroundColor DarkGreen
                } else {
                    Write-Output "Account unlocked on $($dc.Name)"
                }
            } else {
                Write-Output "Error unlocking account on $($dc.Name): User not found"
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
                    Write-Host "Account unlocked on $targetDC" -BackgroundColor DarkGreen
                } else {
                    Write-Output "Error unlocking account on $targetDC User not found"
                }
            } catch {
                Write-Output "Error unlocking account on $targetDC $_"
            }
        } else {
            Write-Output "Error: $targetDC not found in domain controller list"
        }
    }
}


while ($true) {
    # Function: Get-User - Prompt for a user ID and return the sanitized value
    if (!$stoploop) {
        if (-not $debug) {
            cls
        }
    }
    if (-not $UserID) {
        $userId = Get-User
    }

    # Function: Get-OU - Get the OU for the user
    $OU = Get-OU -userId $userId

    # Function: Match-OUtoDC - Match the OU to a domain controller
    $targetDC = Match-OUtoDC -OU $OU -dcList $dcList

    # Function: Check-LockedOut - Check if the user is locked out
    Check-LockedOut -userId $userId -targetDC $targetDC -domainRoot $domainRoot.DomainRoot

    function Unlock-UserWrapper {
        param (
            [string]$userId,
            [string]$targetDC,
            [hashtable]$dcList,
            [string]$domainRoot
        )

        # $unlockPrompt = Read-Host "Unlock user? Enter to continue, 0 to cancel"
        # if ($unlockPrompt -eq '0') {
        #     Write-Host "Unlock operation cancelled."
        #     return
        # }

        Unlock-User -userId $userId -targetDC $targetDC -dcList $dcList -domainRoot $domainRoot
        if ($targetDC -ne '0') {
            Unlock-User -userId $userId -targetDC $PDC -dcList $dcList -domainRoot $domainRoot
            Unlock-User -userId $userId -targetDC $DDC -dcList $dcList -domainRoot $domainRoot
        }

    }

    # Call the wrapper function instead of Unlock-User directly
    Unlock-UserWrapper -userId $userId -targetDC $targetDC -dcList $dcList -domainRoot $domainRoot.DomainRoot

    # Prompt the user to press Enter to reset
    # Read-Host "Press Enter to reset..."
    # pause

    Start-Sleep -Seconds 1

    Write-Debug "$stoploop"

    if (!$stoploop) {
        cls
        $UserID = $null
    }
    else {
        Write-Debug "$stoploop"
        break
    }
}