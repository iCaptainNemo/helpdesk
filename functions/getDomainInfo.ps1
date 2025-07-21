function Get-DomainRoot {
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        $rootDSE = New-Object System.DirectoryServices.DirectoryEntry("LDAP://$($currentDomain.Name)/RootDSE")
        $domainRoot = $rootDSE.defaultNamingContext
        $ldapPath = "LDAP://OU=Domain Controllers,$($domainRoot)"

        return @{
            DomainRoot = $domainRoot
            LdapPath = $ldapPath
        }
    } catch {
        return @{
            Error = $_.Exception.Message
        }
    }
}

function Get-DomainControllers {
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        $domainControllers = $currentDomain.DomainControllers | ForEach-Object {
            $_.Name
        }

        return @{
            DomainControllers = $domainControllers
        }
    } catch {
        return @{
            Error = $_.Exception.Message
        }
    }
}

$domainInfo = Get-DomainRoot
$domainControllers = Get-DomainControllers

$domainData = @{
    DomainInfo = $domainInfo
    DomainControllers = $domainControllers
}

$domainData | ConvertTo-Json -Compress