# Description: This function will return all properties of a user in Active Directory
function Get-ADUserProperties {
    param (
        [string]$userId
    )

    try {
        if ($env:CommandType -eq 'Power') {
            $adUser = Get-ADUser -Identity $userId -Properties *
        } else {
            # Use System.DirectoryServices.DirectorySearcher to get the user properties from Active Directory
            $searcher = New-Object System.DirectoryServices.DirectorySearcher
            $searcher.Filter = "(sAMAccountName=$userId)"
            $user = $searcher.FindOne()

            if ($null -eq $user) {
                throw
            }

            $adUser = $user.GetDirectoryEntry()

            # Get the properties
            $dn = $adUser.distinguishedName
            $samid = $adUser.sAMAccountName
            $sid = $adUser.objectSid
            $desc = $adUser.description
            $memberof = $adUser.memberOf

            if ($null -eq $adUser) {
                throw
            }
        }
        return $adUser
    } catch {
        Write-Host "Error: $_"
        return $null
    }
}