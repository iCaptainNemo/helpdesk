# Description: This function will return all AD properties of user
function Get-ADUserProperties {
    param (
        [string]$userId,
        [bool]$powershell
    )

    try {
        if ($powershell -eq $true) {
            $adUser = Get-ADUser -Identity $userId -Properties *
        } else {
            # Use System.DirectoryServices.DirectorySearcher to get the user properties from Active Directory
            $searcher = New-Object System.DirectoryServices.DirectorySearcher
            $searcher.Filter = "(sAMAccountName=$userId)"
            $user = $searcher.FindOne()

            if ($null -eq $user) {
                throw
            }

            $adUserEntry = $user.GetDirectoryEntry()

            # Create a custom object and add each property individually
            $adUser = New-Object PSObject
            $adUser | Add-Member -MemberType NoteProperty -Name "User ID" -Value $adUserEntry.sAMAccountName[0]
            $adUser | Add-Member -MemberType NoteProperty -Name "Distinguished Name" -Value $adUserEntry.distinguishedName[0]
            $adUser | Add-Member -MemberType NoteProperty -Name "Description" -Value $adUserEntry.description[0]
            $adUser | Add-Member -MemberType NoteProperty -Name "Member Of" -Value $adUserEntry.memberOf
        }
        return $adUser
    } catch {
        Write-Host "Error: $_"
        return $null
    }
}

# Description: Show AD user properties with color coding
function Show-ADUserProperties {
    param (
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
        elseif ($adUser -is [PSObject]) {
            # Process $adUser as PSObject
            $properties = [ordered]@{
                'User ID' = $adUser.'User ID'
                'Distinguished Name' = $adUser.'Distinguished Name'
                'Description' = $adUser.Description
                'Member Of' = $adUser.'Member Of'
            }
            $properties.GetEnumerator() | Format-Table
        } else {
            Write-Host "Unsupported type for adUser"
        }
}