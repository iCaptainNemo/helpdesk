# Description: This function prompts the user for a User ID and validates that it exists in Active Directory. 
# If the User ID is valid, 
# it is stored in the $envVars hashtable and the $AdminConfig file is updated with the new value.

#$UserID = $UserID.Trim() # Remove any leading or trailing spaces

#if ([string]::IsNullOrWhiteSpace($UserID)) {
#    Write-Host "User ID cannot be blank. Please enter a valid User ID."
#    return
#}
function Get-UserId {
    if ($null -eq $envVars['UserID']) {
        while ($true) {
            $UserID = (Read-Host "Enter User ID").Replace(' ', '')
            try {
                if ($env:CommandType -eq 'Power') {
                    Get-ADUser -Identity $UserID -ErrorAction Stop | Out-Null
                } else {
                    # Use dsquery and dsget to get the user fro
                    $user = & dsquery user -samid $UserID
                    if ($null -eq $user) {
                        throw
                    }
                    $userDetails = & dsget user $user
                    if ($null -eq $userDetails) {
                        throw
                    }
                }
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