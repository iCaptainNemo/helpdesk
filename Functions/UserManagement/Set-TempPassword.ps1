<#
.SYNOPSIS
    Temporary password management for user account operations
.DESCRIPTION
    Manages temporary password settings for password reset operations. Supports both
    user-defined passwords and automatic seasonal password generation (e.g., Spring2024).
    Integrates with YAML configuration system for consistent password management.
.FUNCTIONALITY
    - Interactive temporary password input with validation
    - Automatic seasonal password generation based on current date
    - Integration with script environment variables (YAML system)
    - Prevents duplicate password prompting within session
.OUTPUTS
    Sets script-level $tempPassword variable for use by password reset functions
.EXAMPLE
    Set-TempPassword
    Prompts for temporary password or generates seasonal default
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: YAML environment configuration system
    Part of: Jarvis Helpdesk Automation System - User Management
#>

function Set-TempPassword {
    if ($script:envVars.ContainsKey('tempPassword') -and $script:envVars['tempPassword']) {
            return
    }
    do {
        $userInput = Read-Host "Enter temp password or use Season-Year format (e.g. Spring2024) for password resets"
        if ($userInput) {
            $tempPassword = $userInput
        } else {
            # Set Temporary Password based on the season and year
            $currentMonth = (Get-Date).Month
            $season = switch ($currentMonth) {
                { $_ -in 3..5 } { 'Spring' }
                { $_ -in 6..8 } { 'Summer' }
                { $_ -in 9..11 } { 'Fall' }
                { $_ -in 1, 2, 12 } { 'Winter' }
            }
            $tempPassword = "$season$(Get-Date -UFormat '%Y')"
        }
        $confirm = Read-Host "Use '$tempPassword'. Is this correct? (n to redo)"
    } while ($confirm -eq 'n')
    # Update the tempPassword in the script environment variables (YAML system)
    $script:envVars['tempPassword'] = $tempPassword
    Write-Debug "Updated temp password in script environment variables"
    
    # TODO: Consider updating admin YAML config file for persistence
    return $tempPassword
}