<#
.SYNOPSIS
    Active Directory object discovery and property retrieval
.DESCRIPTION
    Retrieves comprehensive information about Active Directory objects including users, 
    computers, groups, and print queues. Supports flexible search patterns and displays
    detailed object properties for helpdesk operations.
.PARAMETER object
    The AD object identifier (name, SamAccountName, or partial match)
.FUNCTIONALITY
    - Flexible object search supporting multiple identifier types
    - Comprehensive property retrieval and display
    - Support for users, computers, groups, and print queues
    - Interactive prompting when object parameter not provided
    - Detailed error handling and user feedback
.EXAMPLE
    Get-ADObjectType -object "jdoe"
    Retrieves and displays properties for user or object matching "jdoe"
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: Active Directory PowerShell module (imported by jarvis.ps1)
    Part of: Jarvis Helpdesk Automation System - Utilities
#>

function Get-ADObjectType {
    param (
        [string]$object
    )

    # Prompt for the object if not provided
    if (-not $object) {
        $object = Read-Host "Enter the AD object identifier"
    }

    # Load AD properties configuration
    $adPropsConfig = Get-ADPropertiesConfig
    Write-Debug "AD Properties configuration loaded for object query"
    
    try {
        # Use YAML-configured properties instead of hardcoded '*'
        $properties = $adPropsConfig.PowerShellAD.ObjectProperties.General
        $adObject = Get-ADObject -Filter "Name -like '$object' -or SamAccountName -like '$object*' -or (objectClass -eq 'printQueue' -and Name -like '*$object')" -Properties $properties
        Write-Debug "Get-ADObject querying with properties: $($properties -join ', ')"

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