
param (
    [string]$UserID,
    [switch]$StopLoop
)


$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf

if ($stoploop -ne $false) {
    $stoploop = $true
}

# Ask the user if they want to enable debugging
$debugging = $false
if ($stoploop) {
    $debugChoice = Read-Host "Do you want to enable debugging? Default no. (Y)"
}
if (($debugChoice -eq 'Y' -or $debugChoice -eq 'y') -and $stoploop) {
    $debugging = $true
    # Ask the user if they want to see debugging lines (Continue), debug (Inquire), or cancel debugging (Cancel)
    $debugPreferenceChoice = Read-Host "See debugging lines (default), debug (Inquire), or cancel debugging (Cancel)? (I/C/Enter)"

    if ($debugPreferenceChoice -eq 'I' -or $debugPreferenceChoice -eq 'i') {
        $DebugPreference = 'Inquire'
        Write-Host "Debugging is enabled with Inquire preference" -ForegroundColor Green
    } elseif ($debugPreferenceChoice -eq 'C' -or $debugPreferenceChoice -eq 'c') {
        $debugging = $false
        Write-Host "Debugging is cancelled" -ForegroundColor DarkGray
    } else {
        $DebugPreference = 'Continue'
        Write-Host "Debugging is enabled with Continue preference" -ForegroundColor Green
    }
} 

function Get-DomainRoot {
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        $rootDSE = New-Object System.DirectoryServices.DirectoryEntry("LDAP://$($currentDomain.Name)/RootDSE")
        $domainRoot = $rootDSE.defaultNamingContext
        $ldapPath = "LDAP://OU=Domain Controllers,$($currentDomain.distinguishedName)"
        if ($debugging) {
            Write-Host "LDAP path: $ldapPath"
            Write-Host "Domain root: $domainRoot"
        }
        return @{
            DomainRoot = $domainRoot
            LdapPath = $ldapPath
        }
    } catch {
        Write-Host "Error: $_"
    }
}

# Call the function and store the result in a variable
$domainRoot = Get-DomainRoot
function Get-DomainControllers {
    $dcList = @{}
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        if ($debugging) { Write-Host "Current Domain: $($currentDomain)" }

        $currentDomain.DomainControllers | ForEach-Object {
            $dcList[$_.Name] = $_
        }

        # Retrieve the primary domain controller (PDC) emulator role owner DN
        $PDC = $currentDomain.PdcRoleOwner
        if ($debugging) { Write-Host "Primary DC: $($PDC)" }

        # Retrieve the distinguished name of the DDC
        $DDC = $currentDomain.RidRoleOwner
        if ($debugging) { Write-Host "Distributed DC: $($DDC)" }

        if ($debugging) { Write-Host "Number of domain controllers found: $($dcList.Count)" }
        return @{
            DcList = $dcList
            PDC = $PDC
            DDC = $DDC
        }
    } catch {
        Write-Host "Error: $_"
    }
}

# Call the function and store the result in a variable
$result = Get-DomainControllers

# Access the DcList, PDC, and DDC from the result
$dcList = $result.DcList
$PDC = $result.PDC
$DDC = $result.DDC

# Function: Get-User - Prompt for a user ID and return the sanitized valuefunction Get-User {
function Get-User {
    do {
        do {
            $userId = Read-Host "Enter Locked UserID"
            $userId = $userId.Trim() -replace '[^a-zA-Z0-9]', ''

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
if ($debugging) {
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

            if ($debugging) { Write-Host "OU: $firstOU" }
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
                Write-Output "Account unlocked on $($dc.Name)" -BackgroundColor DarkGreen
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
                    Write-Output "Account unlocked on $targetDC" -BackgroundColor DarkGreen
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
    if ($debugging) {
        Read-Host "Press Enter to continue"
    } else {
        Start-Sleep -Seconds 1
    }
    if ($stoploop -eq $true -or $stoploop -eq $null) {
        cls
        $UserID = $null
    }
    else {
        break
    }
}