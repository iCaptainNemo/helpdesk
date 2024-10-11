# Import the Active Directory module
Import-Module ActiveDirectory

# Function to retrieve domain controllers
function Get-DomainControllers {
    $dcList = @{ }
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        $currentDomain.DomainControllers | ForEach-Object {
            $dcList[$_.Name] = $_
        }

        # Retrieve the primary domain controller (PDC) emulator role owner DN
        $PDC = $currentDomain.PdcRoleOwner

        return @{
            DcList = $dcList
            PDC = $PDC
        }
    } catch {
        Write-Output "Error: $_"
    }
}

# Retrieve domain controllers
$domainControllers = Get-DomainControllers
$PDC = $domainControllers.PDC

# Retrieve all locked-out users
$lockedOutUsers = Search-ADAccount -LockedOut -UsersOnly

# Iterate through all locked-out users and get additional AD properties
$lockedOutUsersWithProperties = foreach ($lockedOutUser in $lockedOutUsers) {
    Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties SamAccountName, Name, Department, AccountLockoutTime, Enabled
}

# Filter locked-out users whose lockoutTime is within the last day and are enabled
$filteredLockedOutUsers = $lockedOutUsersWithProperties | Where-Object {
    $_.AccountLockoutTime -ge (Get-Date).AddDays(-1) -and $_.Enabled -eq $true
}

# Manually construct the JSON output
$filteredLockedOutUsersJson = $filteredLockedOutUsers | ForEach-Object {
    @{
        SamAccountName = $_.SamAccountName
        Name = $_.Name
        Department = $_.Department
        AccountLockoutTime = [math]::Round((Get-Date $_.AccountLockoutTime).ToUniversalTime().Subtract([datetime]'1970-01-01').TotalMilliseconds)
        Enabled = $_.Enabled
    }
} | ConvertTo-Json -Compress

# Output the JSON
$filteredLockedOutUsersJson