# Function to retrieve an object from Active Directory and return its properties
# Note: ActiveDirectory module is imported by the main jarvis.ps1 script
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

# Main script execution - only run when called directly, not when dot-sourced
if ($MyInvocation.InvocationName -ne '.') {
    $object = $args[0]
    $properties = Get-ADObjectType -object $object
    $properties
}