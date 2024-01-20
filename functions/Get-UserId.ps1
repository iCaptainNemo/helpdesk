# Description: This function prompts the user for a User ID and validates that it exists in Active Directory. If the User ID is valid, it is stored in the $envVars hashtable and the $AdminConfig file is updated with the new value.
function Get-UserId {
    if ($null -eq $envVars['UserID']) {
        while ($true) {
            $UserID = (Read-Host "Enter User ID").Replace(' ', '')
            try {
                Get-ADUser -Identity $UserID -ErrorAction Stop | Out-Null
                $envVars['UserID'] = $UserID
                # Convert the updated hashtable to a list of strings
                $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })
                # Write the updated environmental variables to the $AdminConfig file
                Set-Content -Path $AdminConfig -Value ($envVarsList -join "`n")
                return $UserID
            } catch {
                #Clear-Host
                Write-Host "Cannot find an object with the given identity. Try again."
            }
        }
    } else {
        return $envVars['UserID']
    }
}