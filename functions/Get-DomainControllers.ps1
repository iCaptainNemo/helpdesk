function Get-DomainControllers {
    $dcList = @{ }
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()

        $currentDomain.DomainControllers | ForEach-Object {
            $dcList[$_.Name] = $_
        }

        $PDC = $currentDomain.PdcRoleOwner
        $DDC = $currentDomain.RidRoleOwner

        $result = @{
            DcList = $dcList
            PDC = $PDC
            DDC = $DDC
            DomainName = $currentDomain.Name
        }

        $result | ConvertTo-Json -Compress
    } catch {
        Write-Error "Error: $_"
    }
}

Get-DomainControllers