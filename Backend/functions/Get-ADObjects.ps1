# Import the Active Directory module
Import-Module ActiveDirectory

# Function to retrieve objects from Active Directory and return selected properties
function Get-ADObjects {
    param (
        [string]$object
    )

    # Prompt for the object if not provided
    if (-not $object) {
        $object = Read-Host "Enter the AD object identifier"
    }

    try {
        # Retrieve the objects from Active Directory with selected properties
        $adObjects = Get-ADObject -Filter "Name -like '$object' -or SamAccountName -like '$object*' -or (objectClass -eq 'printQueue' -and Name -like '*$object')" -Properties CN

        if ($null -eq $adObjects) {
            throw "No objects found matching: $object"
        }

        $results = @()
        foreach ($adObject in $adObjects) {
            $results += [PSCustomObject]@{
                CN = $adObject.CN
            }
        }

        return $results

    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
        return $null
    }
}

# Main script execution
$object = $args[0]
$adObjectProperties = Get-ADObjects -object $object
$adObjectProperties | ConvertTo-Json -Compress