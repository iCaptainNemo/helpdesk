# Import the Active Directory module
Import-Module ActiveDirectory

# Retrieve an object from Active Directory and return its properties.
# In search mode a wildcard SamAccountName match can return several objects
# (e.g. "o0614" also matches "o0614-t"); when that happens we return a candidate
# list ({ __multipleMatches = true; Matches = [...] }) so the UI can disambiguate.
# The UI then re-queries the chosen object with -exact to get a single result.
#
# NOTE on JSON depth: the full-property object must serialize at the default depth
# (2). A deeper depth explodes complex AD attributes (nTSecurityDescriptor, ACLs,
# certificates) into megabytes and overruns the child-process stdout buffer. The
# small candidate list holds only simple strings, so it uses a slightly deeper
# depth safely.
function Get-ADObjectType {
    param (
        [string]$object,
        [bool]$exact
    )

    if (-not $object) {
        $object = Read-Host "Enter the AD object identifier"
    }

    try {
        if ($exact) {
            # Exact resolution of a specific pick (SamAccountName is unique)
            $adObjects = Get-ADObject -Filter "SamAccountName -eq '$object' -or Name -eq '$object'" -Properties *
        } else {
            # Broad search (wildcard) — may match multiple objects
            $adObjects = Get-ADObject -Filter "Name -like '$object' -or SamAccountName -like '$object*' -or (objectClass -eq 'printQueue' -and Name -like '*$object')" -Properties *
        }

        if ($null -eq $adObjects) {
            throw "No objects found matching: $object"
        }

        $list = @($adObjects)

        # Search mode with more than one candidate → return the small pick list
        if (-not $exact -and $list.Count -gt 1) {
            $matchList = foreach ($o in $list) {
                @{
                    Name              = $o.Name
                    SamAccountName    = $o.SamAccountName
                    ObjectClass       = $o.ObjectClass
                    DisplayName       = $o.DisplayName
                    DistinguishedName = $o.DistinguishedName
                }
            }
            return (@{
                __multipleMatches = $true
                Matches           = @($matchList)
                Query             = $object
            } | ConvertTo-Json -Compress -Depth 4)
        }

        # Single match (or exact resolution): return the object's flat properties
        $adObject = $list[0]

        $adObjectProperties = @{}
        $adObject.PSObject.Properties | ForEach-Object {
            $value = $_.Value
            if ($_.Value -is [datetime]) {
                $value = [math]::Round((Get-Date $_.Value).ToUniversalTime().Subtract([datetime]'1970-01-01').TotalMilliseconds)
            } elseif ($_.Value -is [string]) {
                $value = $_.Value -replace '\\', '\' # Replace double backslashes with single backslashes
            }
            $adObjectProperties[$_.Name] = $value
        }

        # Default depth (2) — matches the long-standing behavior and keeps output bounded
        return ($adObjectProperties | ConvertTo-Json -Compress)

    } catch {
        Write-Error "Error retrieving AD object: $_"
        return 'null'
    }
}

# Main script execution — the function already returns a JSON string
$object = $args[0]
$exact = ($args.Count -gt 1 -and $args[1] -eq 'exact')
Get-ADObjectType -object $object -exact $exact
