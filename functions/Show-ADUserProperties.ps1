# Description: Show AD user properties with color coding
function Show-ADUserProperties {
    param (
        [Microsoft.ActiveDirectory.Management.ADUser]$adUser
    )

    if ($adUser) {
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
}