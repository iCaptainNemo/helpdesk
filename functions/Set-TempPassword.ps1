# Function to set $tempPassword
function Set-TempPassword {
    do {
        $userInput = Read-Host "The temp password is not set. Enter one to use or press enter to use the default"
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
        $confirm = Read-Host "You entered '$tempPassword'. Is this correct? (press enter for yes, n for no)"
    } while ($confirm -eq 'n')

    # Update the tempPassword in the $envVars hashtable
    $envVars['tempPassword'] = $tempPassword

    # Convert the updated hashtable to a list of strings
    $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })
    # Write the updated environmental variables to the $AdminConfig file
    Set-Content -Path ".\.env\$AdminConfig" -Value ($envVarsList -join "`n")

    return $tempPassword
}