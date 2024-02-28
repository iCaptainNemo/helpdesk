
if ($debugging) { Write-Host "Value of panesEnabled: $panesEnabled" -ForegroundColor Magenta }
if ($debugging) { Write-Host "Value of ADUserProp: $ADUserProp" -ForegroundColor Magenta }
if ($debugging) { pause }

#This is an infinite loop that will keep running until you stop the script
while ($panesEnabled -eq $true -and $ADUserProp -eq $true) {
    if ($debugging) { 
        Write-Host "All conditions met, proceeding..." -ForegroundColor Magenta 
    }
    Clear-Host

    # Resolve the path to the AdminConfig file
    $AdminConfig = Resolve-Path ".\.env\.env_$env:USERNAME.ps1"

    if ($debugging) { Write-Host "AdminConfig file changed, re-running functions..." -ForegroundColor Magenta}

    # Source the AdminConfig file to get the updated variables
    . $AdminConfig

    # Get the updated UserID
    $userId = $envVars['UserID']
    if ($debugging) { Write-Host "$userID" -ForegroundColor Magenta}

    # Re-run the Get-ADUserProperties and Show-ADUserProperties functions with the updated UserID
    $adUser = Get-ADUserProperties -userId $envVars['UserID']
    Show-ADUserProperties -userId $envVars['UserID'] -adUser $adUser

    # Wait until the Changed event is triggered
    Start-Sleep -seconds 3

}
function Get-ADUserProperties {
    param (
        [string]$userId
    )

    try {
        if ($powershell -eq $true) {
            $adUser = Get-ADUser -Identity $userId -Properties *
            if ($debugging) { Write-Host "Get-ADUser returned: $adUser" }
        } else {
            # Use System.DirectoryServices.DirectorySearcher to get the user properties from Active Directory
            $searcher = New-Object System.DirectoryServices.DirectorySearcher
            $searcher.Filter = "(sAMAccountName=$userId)"
            
            # Specify which properties to retrieve
            $searcher.PropertiesToLoad.AddRange(@("cn", "distinguishedName", "displayName", "givenName", "sn", "userPrincipalName", "mail", "memberOf", "lockoutTime", "pwdLastSet", "userAccountControl"))

            # Perform the search
            $result = $searcher.FindOne()

            # Check if the user was found
            if ($result -ne $null) {
                $user = $result.GetDirectoryEntry()

                # Access user properties
                $cn = $user.Properties["cn"].Value
                $distinguishedName = $user.Properties["distinguishedName"].Value
                $displayName = $user.Properties["displayName"].Value
                $givenName = $user.Properties["givenName"].Value
                $sn = $user.Properties["sn"].Value
                $userPrincipalName = $user.Properties["userPrincipalName"].Value
                $mail = $user.Properties["mail"].Value
                $memberOf = $user.Properties["memberOf"].Value

                # Convert lockoutTime and pwdLastSet from FILETIME to DateTime
                # Check if lockoutTime and pwdLastSet are not System.__ComObject before converting
                $lockoutTime = if ($user.Properties["lockoutTime"].Value -isnot [System.__ComObject]) { [DateTime]::FromFileTime($user.Properties["lockoutTime"].Value) } else { $null }
                $pwdLastSet = if ($user.Properties["pwdLastSet"].Value -isnot [System.__ComObject]) { [DateTime]::FromFileTime($user.Properties["pwdLastSet"].Value) } else { $null }

                $userAccountControl = $user.Properties["userAccountControl"].Value

                $adUser = $user

                if ($debugging) { Write-Host "DirectorySearcher returned: $adUser" }
            } else {
                throw
            }
        }

        # Convert $adUser to a hashtable
        $UserVars = @{}
        $adUser.PSObject.Properties | ForEach-Object { $UserVars[$_.Name] = $_.Value }

        # Store the $adUser hashtable
        $UserConfig = ".\.users\$userId.ps1"
        $UserProps = "`$UserVars = @{}" + ($UserVars.GetEnumerator() | ForEach-Object { "`n`$UserVars['$($_.Key)'] = '$($_.Value)'" })
        Set-Content -Path $UserConfig -Value ($UserProps -join "`n")


        return $adUser
    } catch {
        Write-Host "Error: $_"
        return $null
    }
}
# Description: Show AD user properties with color coding
function Show-ADUserProperties {
    param (
        [string]$userId,
        $adUser
    )

    if ($adUser -is [Microsoft.ActiveDirectory.Management.ADUser]) {
        # Process $adUser as Microsoft.ActiveDirectory.Management.ADUser
        $properties = [ordered]@{
                'User ID'                   = $adUser.SamAccountName
                'Given Name'                = $adUser.GivenName
                'Display Name'              = $adUser.DisplayName
                'Email'                     = $adUser.EmailAddress
                'Department'                = $adUser.Department
                'Telephone'                 = $adUser.telephoneNumber
                'Account Lockout Time'      = $adUser.AccountLockoutTime
                'Last Bad Password Attempt' = $adUser.LastBadPasswordAttempt
                'Bad Logon Count'           = $adUser.BadLogonCount
                'Bad Password Count'        = $adUser.badPwdCount
            }
            # Display properties with color coding
            $properties.GetEnumerator() | Format-Table

            # Get the groups the user is a member of
            $groups = $adUser.MemberOf | ForEach-Object {
                # Get the group name from the distinguished name
                ($_ -split ',')[0].Substring(3)
            }

            # Display the groups in a table
            $groups | Format-Table -Property @{Name='Group'; Expression={$_}}

            Write-Host ""

            # Color coding for Password Expired
            $passwordExpired = $adUser.PasswordExpired
            if ($passwordExpired) {
                Write-Host "Password Expired: Expired" -ForegroundColor Red
            } else {
                Write-Host "Password Expired: Not Expired" -ForegroundColor Green
            }
            # Color coding for Password Last Set age
            $passwordLastSet = $adUser.PasswordLastSet
            if ($null -ne $passwordLastSet) {
                $daysSinceLastSet = (Get-Date) - $passwordLastSet
                $passwordAge = [math]::Round($daysSinceLastSet.TotalDays)
        
                if ($passwordAge -le 14) {
                    Write-Host "Password Last Set: $($passwordLastSet.ToString('yyyy-MM-dd HH:mm:ss')) ($passwordAge days old)" -ForegroundColor Green
                } elseif ($passwordAge -gt 46) {
                    Write-Host "Password Last Set: $($passwordLastSet.ToString('yyyy-MM-dd HH:mm:ss')) ($passwordAge days old)" -ForegroundColor Red
                } else {
                    Write-Host "Password Last Set: $($passwordLastSet.ToString('yyyy-MM-dd HH:mm:ss')) ($passwordAge days old)" -ForegroundColor Yellow
                }
            } else {
                Write-Host "Password Last Set: Not available" -ForegroundColor Yellow
            }

            # Color coding for LockedOut
            $lockedOut = $adUser.LockedOut
            if ($lockedOut) {
                Write-Host "LockedOut: True" -ForegroundColor Red
            } else {
                Write-Host "LockedOut: False" -ForegroundColor Green
            }

            # Color coding for Disabled
            $disabled = $adUser.Enabled -eq $false
            if ($disabled) {
                Write-Host "Disabled: True" -ForegroundColor Red
            } else {
                Write-Host "Disabled: False" -ForegroundColor Green
            }
        }
    elseif ($adUser -is [System.DirectoryServices.DirectoryEntry]) {
        # Process $adUser as System.DirectoryServices.DirectoryEntry

        # Create a custom object and add each property individually
        $customUser = New-Object PSObject
        $customUser | Add-Member -MemberType NoteProperty -Name "User ID" -Value $adUser.Properties["sAMAccountName"].Value
        $customUser | Add-Member -MemberType NoteProperty -Name "Full Name" -Value $adUser.Properties["cn"].Value
      #  $customUser | Add-Member -MemberType NoteProperty -Name "Distinguished Name" -Value $adUser.Properties["distinguishedName"].Value
      #  $customUser | Add-Member -MemberType NoteProperty -Name "Display Name" -Value $adUser.Properties["displayName"].Value
      #  $customUser | Add-Member -MemberType NoteProperty -Name "Given Name" -Value $adUser.Properties["givenName"].Value
      #  $customUser | Add-Member -MemberType NoteProperty -Name "Surname (Last Name)" -Value $adUser.Properties["sn"].Value
      #  $customUser | Add-Member -MemberType NoteProperty -Name "User Principal Name" -Value $adUser.Properties["userPrincipalName"].Value
        $customUser | Add-Member -MemberType NoteProperty -Name "Email" -Value $adUser.Properties["mail"].Value
      #  $customUser | Add-Member -MemberType NoteProperty -Name "Member Of" -Value $adUser.Properties["memberOf"].Value
        $customUser | Add-Member -MemberType NoteProperty -Name "Lockout Time" -Value $adUser.Properties["lockoutTime"].Value
        $customUser | Add-Member -MemberType NoteProperty -Name "Password Last Set" -Value $adUser.Properties["pwdLastSet"].Value
      #  $customUser | Add-Member -MemberType NoteProperty -Name "User Account Control" -Value $adUser.Properties["userAccountControl"].Value

        # Display properties in a table
        $customUser | Format-List
    } else {
        Write-Host "Unsupported type for adUser"
    }
}
