<#
.SYNOPSIS
    Active Directory user property management and display functions
.DESCRIPTION
    Provides functions to retrieve and display comprehensive AD user information including
    group memberships, account status, password information, and lockout details.
    Supports both PowerShell AD module and DirectorySearcher fallback methods.
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: Active Directory access, PowerShell AD module (preferred) or WMI fallback
    Part of: Jarvis Helpdesk Automation System
#>

Write-Debug "Value of panesEnabled: $panesEnabled"

# Legacy loop function - kept for compatibility but wrapped in function
# This is an infinite loop that will keep running until you stop the script
while ($panesEnabled -eq $true -and $ADUserProp -eq $true) {
    Write-Debug "All conditions met, proceeding..."
    if (-not $DebugPreference -eq 'Continue') { Clear-Host }

    # Get the updated UserID from script environment variables (YAML system)
    $userId = $script:envVars['UserID']
    Write-Debug "$userID"

    # Re-run the Get-ADUserProperties and Show-ADUserProperties functions with the updated UserID
    $adUser = Get-ADUserProperties -userId $script:envVars['UserID']
    Show-ADUserProperties -userId $script:envVars['UserID'] -adUser $adUser

    # Wait until the Changed event is triggered
    Start-Sleep -seconds 3

}
function Get-DomainControllers {
    $dcList = @{}
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        Write-Debug "Current Domain: $($currentDomain)"

        $currentDomain.DomainControllers | ForEach-Object {
            $dcList[$_.Name] = $_
        }

        # Retrieve the primary domain controller (PDC) emulator role owner DN
        $PDC = $currentDomain.PdcRoleOwner
        Write-Debug "Primary DC: $($PDC)"

        # Retrieve the distinguished name of the DDC
        $DDC = $currentDomain.RidRoleOwner
        Write-Debug "Distributed DC: $($DDC)"
        Write-Debug "Number of domain controllers found: $($dcList.Count)"

        return @{
            DcList = $dcList
            PDC = $PDC
            DDC = $DDC
        }
    } catch {
        Write-Host "Error: $_"
    }
}

$domainControllers = Get-DomainControllers
$PDC = $domainControllers.PDC
function Get-ADUserProperties {
    param (
        [string]$userId
    )
    
    # Load AD properties configuration
    $adPropsConfig = Get-ADPropertiesConfig
    Write-Debug "AD Properties configuration loaded for user query"
    
    try {
        if ($script:EnvironmentInfo.PowerShellAD -eq $true) {
            # Use YAML-configured properties instead of hardcoded '*'
            $properties = $adPropsConfig.PowerShellAD.UserProperties.All
            $adUser = Get-ADUser -Identity $userId -Properties $properties -Server $PDC
            Write-Debug "Get-ADUser returned: $adUser"
        } else {
            # Use System.DirectoryServices.DirectorySearcher to get the user properties from Active Directory
            $searcher = New-Object System.DirectoryServices.DirectorySearcher
            $searcher.Filter = "(sAMAccountName=$userId)"
            
            # Use YAML-configured properties for DirectorySearcher
            $dsProperties = $adPropsConfig.DirectorySearcher.UserProperties.All
            $searcher.PropertiesToLoad.AddRange($dsProperties)
            Write-Debug "DirectorySearcher will query properties: $($dsProperties -join ', ')"

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

                Write-Debug "DirectorySearcher returned: $adUser"
            } else {
                throw
            }
        }

        # Convert $adUser to a hashtable
        $UserVars = @{}
        $adUser.PSObject.Properties | ForEach-Object { $UserVars[$_.Name] = $_.Value }

       # Store the $adUser hashtable
       # $UserConfig = ".\.users\$userId.ps1"
       # $UserProps = "`$UserVars = @{}" + ($UserVars.GetEnumerator() | ForEach-Object { "`n`$UserVars['$($_.Key)'] = '$($_.Value)'" })
        #Set-Content -Path $UserConfig -Value ($UserProps -join "`n")


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
    
    # Load AD properties configuration to determine what to display
    $adPropsConfig = Get-ADPropertiesConfig
    Write-Debug "AD Properties configuration loaded for display formatting"

    if ($adUser -is [Microsoft.ActiveDirectory.Management.ADUser]) {
        # Process $adUser as Microsoft.ActiveDirectory.Management.ADUser
        # Build display properties dynamically from YAML config
        $properties = [ordered]@{}
        
        # Define display property mapping in desired display order (friendly name -> AD property name)
        $displayMappingOrder = @(
            @{ DisplayName = 'User ID'; PropertyName = 'SamAccountName' }
            @{ DisplayName = 'Given Name'; PropertyName = 'GivenName' }
            @{ DisplayName = 'Display Name'; PropertyName = 'DisplayName' }
            @{ DisplayName = 'Title'; PropertyName = 'Title' }
            @{ DisplayName = 'HomeShare'; PropertyName = 'HomeDirectory' }
            @{ DisplayName = 'Email'; PropertyName = 'EmailAddress' }
            @{ DisplayName = 'Department'; PropertyName = 'Department' }
            @{ DisplayName = 'Telephone'; PropertyName = 'telephoneNumber' }
            @{ DisplayName = 'Account Lockout Time'; PropertyName = 'AccountLockoutTime' }
            @{ DisplayName = 'Last Bad Password Attempt'; PropertyName = 'LastBadPasswordAttempt' }
            @{ DisplayName = 'Bad Logon Count'; PropertyName = 'BadLogonCount' }
            @{ DisplayName = 'Bad Password Count'; PropertyName = 'badPwdCount' }
        )
        
        # Get the properties that were actually retrieved based on YAML config
        if ($adPropsConfig.PowerShellAD.UserProperties.UseAllProperties -eq $true) {
            # If using all properties, show all mapped display properties in order
            foreach ($mapping in $displayMappingOrder) {
                $displayName = $mapping.DisplayName
                $adProperty = $mapping.PropertyName
                if ($adUser.PSObject.Properties[$adProperty]) {
                    $properties[$displayName] = $adUser.$adProperty
                }
            }
        } else {
            # Only show properties that were configured to be retrieved, in order
            $retrievedProperties = $adPropsConfig.PowerShellAD.UserProperties.Core + $adPropsConfig.PowerShellAD.UserProperties.Extended
            foreach ($mapping in $displayMappingOrder) {
                $displayName = $mapping.DisplayName
                $adProperty = $mapping.PropertyName
                if ($retrievedProperties -contains $adProperty -and $adUser.PSObject.Properties[$adProperty]) {
                    $properties[$displayName] = $adUser.$adProperty
                }
            }
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
        
        # Define display property mapping for DirectorySearcher in desired order (friendly name -> LDAP attribute)
        $dsDisplayMappingOrder = @(
            @{ DisplayName = 'User ID'; PropertyName = 'sAMAccountName' }
            @{ DisplayName = 'Given Name'; PropertyName = 'givenName' }
            @{ DisplayName = 'Display Name'; PropertyName = 'displayName' }
            @{ DisplayName = 'Full Name'; PropertyName = 'cn' }
            @{ DisplayName = 'Surname'; PropertyName = 'sn' }
            @{ DisplayName = 'Title'; PropertyName = 'title' }
            @{ DisplayName = 'Email'; PropertyName = 'mail' }
            @{ DisplayName = 'Department'; PropertyName = 'department' }
            @{ DisplayName = 'Telephone'; PropertyName = 'telephoneNumber' }
            @{ DisplayName = 'Home Directory'; PropertyName = 'homeDirectory' }
            @{ DisplayName = 'User Principal Name'; PropertyName = 'userPrincipalName' }
            @{ DisplayName = 'Distinguished Name'; PropertyName = 'distinguishedName' }
            @{ DisplayName = 'Lockout Time'; PropertyName = 'lockoutTime' }
            @{ DisplayName = 'Password Last Set'; PropertyName = 'pwdLastSet' }
            @{ DisplayName = 'User Account Control'; PropertyName = 'userAccountControl' }
        )
        
        # Build display object dynamically from YAML config, maintaining order
        $customUser = [ordered]@{}
        $retrievedProperties = $adPropsConfig.DirectorySearcher.UserProperties.All
        
        # Only add properties that were configured to be retrieved and have values, in order
        foreach ($mapping in $dsDisplayMappingOrder) {
            $displayName = $mapping.DisplayName
            $ldapAttribute = $mapping.PropertyName
            if ($retrievedProperties -contains $ldapAttribute) {
                $propertyValue = $adUser.Properties[$ldapAttribute].Value
                if ($null -ne $propertyValue -and $propertyValue -ne "") {
                    $customUser[$displayName] = $propertyValue
                }
            }
        }

        # Display properties in a table
        $customUser.GetEnumerator() | Format-Table Name, Value -AutoSize
    } else {
        Write-Host "Unsupported type for adUser"
    }
}
