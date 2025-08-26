# Description: This function prompts the user for a User ID and validates that it exists in Active Directory. 

function Get-UserId {
    if ($panesEnabled -eq $true -and $GetUserId -eq $true) {
        while ($true) {
            Clear-Host
            Write-Debug "Panes enabled and GetUserId is true"
            $UserID = (Read-Host "Enter User ID").Replace(' ', '')
            try {
                if ($script:EnvironmentInfo.PowerShellAD -eq $true) {
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
                # Legacy .env file writing removed - now using YAML configuration
                $script:envVars['UserID'] = $UserID
                # UserID is now stored in script scope for YAML system
            } catch {
                #Clear-Host
                Write-Host "Cannot find an object with the given identity. Try again."
            }
        }
    } elseif ($null -eq $envVars['UserID']) {
            while ($true) {
                $UserID = (Read-Host "Enter User ID").Replace(' ', '')
                try {
                if ($script:EnvironmentInfo.PowerShellAD -eq $true) {
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
                # Legacy .env file writing removed - now using YAML configuration
                $script:envVars['UserID'] = $UserID
                # UserID is now stored in script scope for YAML system
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