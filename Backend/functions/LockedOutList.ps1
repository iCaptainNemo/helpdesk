<#
.SYNOPSIS
    Retrieves list of locked out AD users within last 24 hours
.DESCRIPTION
    Queries Active Directory for locked out users, filters for enabled accounts
    locked in last 24 hours, returns JSON formatted results
.OUTPUTS
    JSON object with LockedOutUsers array containing user details
#>

# Import required AD module for domain operations
Import-Module ActiveDirectory

# Helper function to get domain controller information
function Get-DomainControllers {
    $dcList = @{ }
    try {
        # Get current domain context
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        
        # Build dictionary of domain controllers
        $currentDomain.DomainControllers | ForEach-Object {
            $dcList[$_.Name] = $_
        }

        # Get PDC emulator for consistent lockout status (name only - Search-ADAccount/
        # Get-ADUser -Server expects a DNS/NetBIOS name, not the DomainController object)
        $PDC = $currentDomain.PdcRoleOwner.Name

        return @{
            DcList = $dcList  # All DCs for potential future use
            PDC = $PDC       # Primary DC for lockout checks
        }
    } catch {
        Write-Output "Error: $_"
    }
}

# Get DC info for domain queries
$domainControllers = Get-DomainControllers
$PDC = $domainControllers.PDC

# Target the PDC emulator explicitly - lockout status is authoritative there, and
# otherwise the AD module's own locator can silently land on a different DC whose
# ADWS happens to be down, throwing ADServerDownException. Fall back to the module's
# default locator only if PDC resolution itself failed above.
$serverParam = @{}
if ($PDC) {
    $serverParam['Server'] = $PDC
}

# Query AD for any locked out users
$lockedOutUsers = Search-ADAccount -LockedOut -UsersOnly @serverParam

# Return empty array if no locked accounts found
if (!$lockedOutUsers -or $lockedOutUsers.Count -eq 0) {
    # Return empty array in JSON format
    Write-Output "[]"
    exit
}

# Get additional user properties needed for display
$lockedOutUsersWithProperties = foreach ($lockedOutUser in $lockedOutUsers) {
    Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties SamAccountName, Name, Department, AccountLockoutTime, Enabled @serverParam
}

# Filter for:
# 1. Accounts locked within last 24 hours
# 2. Currently enabled accounts only
$filteredLockedOutUsers = $lockedOutUsersWithProperties | Where-Object {
    $_.AccountLockoutTime -ge (Get-Date).AddDays(-1) -and $_.Enabled -eq $true
}

# Transform AD objects to custom JSON structure
# Convert lockout time to Unix timestamp for frontend
$filteredLockedOutUsersJson = $filteredLockedOutUsers | ForEach-Object {
    @{
        SamAccountName = $_.SamAccountName
        Name = $_.Name
        Department = $_.Department
        AccountLockoutTime = [math]::Round((Get-Date $_.AccountLockoutTime).ToUniversalTime().Subtract([datetime]'1970-01-01').TotalMilliseconds)
        Enabled = $_.Enabled
    }
} | ConvertTo-Json -Compress

# Return JSON formatted results
$filteredLockedOutUsersJson