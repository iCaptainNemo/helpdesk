# Remove the 'UserID' key from the $envVars hashtable and write the updated environmental variables to the $AdminConfig file
function Remove-UserId {
    param (
        [string]$AdminConfig
    )

    # Set 'UserID' key in $envVars to null
    $envVars['UserID'] = $null

    # Convert the updated hashtable to a list of strings
    $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })

    # Write the updated environmental variables to the $AdminConfig file
    Set-Content -Path $AdminConfig -Value ($envVarsList -join "`n")
}