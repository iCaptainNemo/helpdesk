# Function to set $tempPassword
function Set-TempPassword {
    if ($envVars.ContainsKey('tempPassword')) {
        $useExisting = Read-Host "Use existing temporary password $($envVars['tempPassword'])? (y/n)"
        if ($useExisting -eq 'y') {
            return $envVars['tempPassword']
        }
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
    # Update the tempPassword in the $envVars hashtable
    $envVars['tempPassword'] = $tempPassword
    # Convert the updated hashtable to a list of strings
    $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })
    # Write the updated environmental variables to the $AdminConfig file
    Set-Content -Path "$AdminConfig" -Value ($envVarsList -join "`n")
    return $tempPassword
}