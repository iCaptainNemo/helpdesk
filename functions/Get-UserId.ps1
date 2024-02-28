# Description: This function prompts the user for a User ID and validates that it exists in Active Directory. 

function Get-UserId {
    if ($panesEnabled -eq $true -and $GetUserId -eq $true) {
        while ($true) {
            Clear-Host
            $UserID = (Read-Host "Enter User ID").Replace(' ', '')
            try {
                if ($powershell -eq $true) {
                    Get-ADUser -Identity $UserID -ErrorAction Stop | Out-Null
                } else {
                    # Use dsquery and dsget to get the user from AD
                    $user = & dsquery user -samid $UserID
                    if ($null -eq $user) {
                        throw
                    }
                    $userDetails = & dsget user $user
                    if ($null -eq $userDetails) {
                        throw
                    }
                }
                $AdminConfig = ".\.env\.env_$env:USERNAME.ps1"
                $envVars['UserID'] = $UserID
                # Convert the updated hashtable to a list of strings
                $envVarsList = "`$envVars = @{}" + ($envVars.GetEnumerator() | ForEach-Object { "`n`$envVars['$($_.Key)'] = '$($_.Value)'" })
                # Write the updated environmental variables to the $AdminConfig file
                Set-Content -Path $AdminConfig -Value ($envVarsList -join "`n")
            } catch {
                #Clear-Host
                Write-Host "Cannot find an object with the given identity. Try again."
            }
        }
    } elseif ($null -eq $envVars['UserID']) {
            while ($true) {
                $UserID = (Read-Host "Enter User ID").Replace(' ', '')
                try {
                if ($powershell -eq $true) {
                    Get-ADUser -Identity $UserID -ErrorAction Stop | Out-Null
                } else {
                    # Use dsquery and dsget to get the user from AD
                    $user = & dsquery user -samid $UserID
                    if ($null -eq $user) {
                        throw
                    }
                    $userDetails = & dsget user $user
                    if ($null -eq $userDetails) {
                        throw
                    }
                }
                $AdminConfig = ".\.env\.env_$env:USERNAME.ps1"
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