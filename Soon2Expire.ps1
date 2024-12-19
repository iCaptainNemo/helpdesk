Import-Module ActiveDirectory

function Get-CurrentTime {
    Get-Date -Format "yyyy-MM-dd hh:mm:ss tt"
}

# Initialize restart count
$script:restartCount = 0

# Get the MaxPasswordAge from the default domain password policy
$maxPasswordAge = (Get-ADDefaultDomainPasswordPolicy).MaxPasswordAge
Write-Debug "MaxPasswordAge: $maxPasswordAge"

do {
    # Clear the host
    Clear-Host

    # Display the current time
    $currentTime = Get-CurrentTime
    Write-Host "Current Time: $currentTime"

    # Display the restart count
    $script:restartCount++
    Write-Host "Script has restarted $($script:restartCount) times."

   # Get all users
    $users = Get-ADUser -Filter * -Properties PasswordLastSet
    Write-Debug "Retrieved $($users.Count) users"

    # Iterate through all users and check if their password is expiring soon
    $usersWithExpiringPasswords = foreach ($user in $users) {
        # Skip users with a null PasswordLastSet value
        if ($null -eq $user.PasswordLastSet) {
            continue
        }

        $passwordAge = (Get-Date) - $user.PasswordLastSet
        Write-Debug "Password age for $($user.SamAccountName): $($passwordAge.Days) days"

        # If the password age is 1 day less than the MaxPasswordAge, add the user to the list
        if ($passwordAge.Days -eq $maxPasswordAge.Days - 1) {
            Write-Debug "Password for $($user.SamAccountName) is expiring within the next day"
            $user
        }
    }

    # Display the properties of users with expiring passwords in a separate table
    if ($usersWithExpiringPasswords.Count -gt 0) {
        Write-Host "Users with passwords expiring within the next day:"
        $usersWithExpiringPasswords | Sort-Object PasswordLastSet | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, PasswordLastSet -AutoSize
    } else {
        Write-Host "No users with passwords expiring within the next day found."
    }

    # Calculate the time until midnight
    $timeUntilMidnight = (New-TimeSpan -Start (Get-Date) -End (Get-Date).Date.AddDays(1)).TotalSeconds
    Write-Debug "Time until midnight: $timeUntilMidnight seconds"

    # Pause Until any key is pressed then refresh
    pause

} while ($true)