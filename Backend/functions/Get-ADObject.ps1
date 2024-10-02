# Import the Active Directory module
Import-Module ActiveDirectory

# Function to retrieve an object from Active Directory and return its properties
function Get-ADObjectType {
    param (
        [string]$object
    )

    # Prompt for the object if not provided
    if (-not $object) {
        $object = Read-Host "Enter the AD object identifier"
    }

    try {
        # Retrieve the objects from Active Directory with all properties
        $adObject = Get-ADObject -Filter "Name -like '$object' -or SamAccountName -like '$object*' -or (objectClass -eq 'printQueue' -and Name -like '*$object')" -Properties *

        if ($null -eq $adObject) {
            throw "No objects found matching: $object"
        }

        # Create a custom object with properties
        $properties = [PSCustomObject]@{}
        $adObject.PSObject.Properties | ForEach-Object {
            $properties | Add-Member -MemberType NoteProperty -Name $_.Name -Value $_.Value
        }

        return $properties

    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
        return $null
    }
}

# Main script execution
$object = $args[0]
$properties = Get-ADObjectType -object $object
$properties