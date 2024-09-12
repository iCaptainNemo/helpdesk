# Get an active directory object instead of using every specific cmdlet
# Usage: ./Get-ADObject.ps1 "USERID" | Format-Table -AutoSize
# $properties = Get-ADObjectType -object $object
# $properties | Format-Table -AutoSize

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
        $adObjects = Get-ADObject -Filter "Name -like '$object' -or SamAccountName -like '$object*' -or (objectClass -eq 'printQueue' -and Name -like '*$object')" -Properties *

        if ($null -eq $adObjects) {
            throw "No objects found matching: $object"
        }

        # Return the properties as an array of custom objects
        $properties = $adObjects | ForEach-Object {
            $_.PSObject.Properties | ForEach-Object {
                [PSCustomObject]@{
                    Property = $_.Name
                    Value    = $_.Value
                }
            }
        }

        return $properties

    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
        return @()
    }
}

# Main script execution
$object = $args[0]
$properties = Get-ADObjectType -object $object
$properties