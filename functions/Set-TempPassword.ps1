# Function to set $tempPassword
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