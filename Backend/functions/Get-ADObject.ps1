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

        # Manually construct the JSON output
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

        return $adObjectProperties

    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
        return $null
    }
}

# Main script execution
$object = $args[0]
$adObjectProperties = Get-ADObjectType -object $object
$adObjectProperties | ConvertTo-Json -Compress