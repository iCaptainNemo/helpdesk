$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf
Set-ExecutionPolicy -ExecutionPolicy Undefined -Scope CurrentUser

# Import the ActiveDirectory module
Import-Module ActiveDirectory

# Get the current user with specific properties
$AdminUser = Get-ADUser -Identity $env:USERNAME -Properties SamAccountName, Name


# Get the current domain
$currentDomain = (Get-ADDomain).DNSRoot
Write-Host "Current domain: $currentDomain"
function Get-CurrentTime {
    Get-Date -Format "yyyy-MM-dd hh:mm:ss tt"
}

# Import variables from env.ps1 file
. .\env_$currentDomain.ps1


$unlockedUsersCount = 0

# Function to unlock AD account on all domain controllers
function Unlock-ADAccountOnAllDomainControllers {
    param (
        [string]$userId
    )

    $dcList = $PSDomains + $cmdDomains

    $jobs = foreach ($targetDC in $dcList) {
        Start-Job -ScriptBlock {
            param ($userId, $targetDC, $PSDomains, $cmdDomains)
            $error.Clear()
            if ($targetDC -in $PSDomains) {
                Unlock-ADAccount -Identity $userId -Server $targetDC -ErrorAction SilentlyContinue -ErrorVariable unlockError
            } elseif ($targetDC -in $cmdDomains) {
                net user $userID /active:yes /Domain
            }
            if ($unlockError) {
                "Error unlocking account: $unlockError"
            } else {
                Write-Host ("Unlocked in " + $targetDC) -BackgroundColor DarkGreen
            }
        } -ArgumentList $userId, $targetDC, $PSDomains, $cmdDomains
    }

    # Receive and print job outputs as they complete
    $jobs | ForEach-Object {
        while ($_ -ne $null -and $_.State -ne 'Completed') {
            if ($_.State -eq 'Failed') {
                Write-Host "Job failed"
                break
            }
            Start-Sleep -Seconds 1
        }
        if ($_.State -eq 'Completed') {
            Receive-Job -Job $_
            Remove-Job -Job $_
        }
    }
}


$unlockedUsersCount = 0
# Function to get probable locked-out users
function Get-ProbableLockedOutUsers {
# Search for all locked-out user accounts
$lockedOutUsers = Search-ADAccount -LockedOut -UsersOnly

# Iterate through all locked-out users and get additional AD properties
$probableLockedOutUsers = foreach ($lockedOutUser in $lockedOutUsers) {
    Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties *
        }

        # Filter locked-out users whose lockoutTime is within X days of the current date, Enabled is True, PasswordExpired is False, and badPwdCount is greater than 0
        $probableLockedOutUsers = $probableLockedOutUsers | Where-Object {
            $_.AccountlockoutTime -ge (Get-Date).AddDays(-1) -and
            $_.Enabled -eq $true
        }
        # Users who are locked out and password is expired
        $lockedoutusersB = $probableLockedOutUsers | Where-Object {
            #$_.LockedOut -eq $true -and
            $_.PasswordExpired -eq $true
        }

        # Users who are locked out and badPwdCount is 0 or null
        $lockedoutusersC = $probableLockedOutUsers | Where-Object {
            #$_.LockedOut -eq $true -and
            ($_.badPwdCount -lt 3 -or $_.badPwdCount -eq $null)
        }

        # The rest of the users
        $lockedoutusersA = $probableLockedOutUsers | Where-Object {
            $_ -notin $lockedoutusersB -and
            $_ -notin $lockedoutusersC
        }
        return @{
            'ProbableLockedOutUsers' = $probableLockedOutUsers
            'LockedOutUsersA' = $lockedoutusersA
            'LockedOutUsersB' = $lockedoutusersB
            'LockedOutUsersC' = $lockedoutusersC
        }
}

function Unlock-Users {
    param (
        [Parameter(Mandatory=$true)]
        [array]$lockedoutusers
    )

    Clear-Host

    $jobs = @()
    $failedUserIds = @()
    $unlockedCount = 0

    foreach ($user in $lockedoutusers) {
        # Skip if the user ID is in the failedUserIds array
        if ($failedUserIds -contains $user.SamAccountName) {
            continue
        }

        $job = Start-Job -ScriptBlock {
            param ($user)

            function Unlock-ADAccountOnAllDomainControllers {
                param (
                    [string]$userId
                )

                $dcList = Get-ADDomainController -Filter *
                foreach ($targetDC in $dcList.Name) {
                    Unlock-ADAccount -Identity $userId -Server $targetDC -ErrorAction SilentlyContinue
                }
            }

            try {
                Unlock-ADAccountOnAllDomainControllers -userId $user.SamAccountName
                return $user.SamAccountName
            } catch {
                return $false
            }
        } -ArgumentList $user

        $jobs += $job
    }

    # Wait for all jobs to complete
    $jobs | Wait-Job | Out-Null

    # Receive and remove completed jobs without displaying job information
    $jobs | ForEach-Object {
        $job = $_
        $result = Receive-Job -Job $job
        Remove-Job -Job $job | Out-Null
        if ($result -ne $false) {
            $unlockedCount++
            Write-Host ("User $result unlocked.") -BackgroundColor DarkGreen
        } else {
            # Ensure that the job has an argument before trying to access it
            if ($job.Command.Arguments) {
                $failedUser = $job.Command.Arguments[0].SamAccountName
                $failedUserIds += $failedUser
                Write-Host "Failed to unlock $failedUser." -ForegroundColor White -BackgroundColor Red
            }
        }
    }

    Write-Host "$($failedUserIds.Count) user(s) failed to unlock."
    return $unlockedCount
}

$restartScript = $true

while ($restartScript) {
    Clear-Host
     # Display the current time
     $currentTime = Get-CurrentTime
     Write-Host "Current Time: $currentTime"
     Write-Host "Unlocked Users Count: $unlockedCount"  -ForegroundColor Green

    #Line break for space
    Write-Host "`n"
    

    # Get probable locked-out users
    $result = Get-ProbableLockedOutUsers
    $probableLockedOutUsers = $result.ProbableLockedOutUsers
    $lockedoutusersA = $result.LockedOutUsersA
    $lockedoutusersB = $result.LockedOutUsersB
    $lockedoutusersC = $result.LockedOutUsersC

    # Display the properties of users in $lockedoutusersA, $lockedoutusersB, and $lockedoutusersC in separate tables
    $noUsersToUnlock = $true

    if ($lockedoutusersA.Count -gt 0) {
        Write-Host "Locked-out users within the last 24 hours:"
        $lockedoutusersA | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, badPwdCount, AccountLockoutTime -AutoSize
        $noUsersToUnlock = $false
    }
    
    if ($lockedoutusersB.Count -gt 0) {
        Write-Host "Locked-out users Password Expired within the last 24 hours:"
        $lockedoutusersB | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, badPwdCount, AccountLockoutTime -AutoSize
        $noUsersToUnlock = $false
    }
    
    if ($lockedoutusersC.Count -gt 0) {
        Write-Host "Locked-out users Bad password attempts < 3 within the last 24 hours:"
        $lockedoutusersC | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, badPwdCount, AccountLockoutTime -AutoSize
        $noUsersToUnlock = $false
    }
    
    if ($noUsersToUnlock) {
        Write-Host "No users to unlock" -ForegroundColor Green
    }

     #Line break for space
     Write-Host "`n"

    # Display the menu for unlocking accounts
    Write-Host "Unlock Account Menu:"
    Write-Host "1. Unlock All Users"
    Write-Host "2. Unlock All With Password Expired Only"
    Write-Host "3. Unlock Users BP < 3"
    Write-Host "4. Auto Unlock Users With Password Expired"
    Write-Host "5. Auto Unlock Users BP < 3"

    $choice = Read-Host "Select an option"

    # Process user's choice
    switch ($choice) {
        1 {
            # Unlock all users
            #Clear-Host
            $unlockedCount += Unlock-Users -lockedoutusers $lockedoutusersA
        }

        2 {
            # Unlock all users with password expired
            #Clear-Host
            $unlockedCount += Unlock-Users -lockedoutusers $lockedoutusersB
        }
        3 {
            #Unlock all users with bad password count = 0 or Null
            #Clear-Host
            $unlockedCount += Unlock-Users -lockedoutusers $lockedoutusersC
        }
        4 {
            # Auto Unlock Users With Password Expired
            # Prompt user for refresh interval
            do {
                $refreshInterval = Read-Host "Enter the refresh interval in minutes (e.g., 1, 5, 10):"
                $refreshInterval = [int]$refreshInterval
            } while ($refreshInterval -le 0)

            
            # Get probable locked-out users
            $result = Get-ProbableLockedOutUsers
            $probableLockedOutUsers = $result.ProbableLockedOutUsers
            $lockedoutusersA = $result.LockedOutUsersA
            $lockedoutusersB = $result.LockedOutUsersB

            # Auto Unlock at specified refresh interval
            do {
                # Clear-Host
                # Write-Host "Auto Unlocking every $refreshInterval minutes. Press Ctrl+C to stop."
                Start-Sleep -Seconds (60 * $refreshInterval)

               if ($lockedoutusersB -ne $null) {
                $unlockedCount += Unlock-Users -lockedoutusers $lockedoutusersB
            } else {
                Write-Host "No Users to unlock"
            }
            } while ($true)
        }
        5 {
            # Auto Unlock Users BP < 3
            # Prompt user for refresh interval
            do {
                $refreshInterval = Read-Host "Enter the refresh interval in minutes (e.g., 1, 5, 10):"
                $refreshInterval = [int]$refreshInterval
            } while ($refreshInterval -le 0)

            # Get probable locked-out users
            $result = Get-ProbableLockedOutUsers
            $probableLockedOutUsers = $result.ProbableLockedOutUsers
            $lockedoutusersA = $result.LockedOutUsersA
            $lockedoutusersB = $result.LockedOutUsersB

            # Auto Unlock at specified refresh interval
            do {
                # Clear-Host
                # Write-Host "Auto Unlocking every $refreshInterval minutes. Press Ctrl+C to stop."
                Start-Sleep -Seconds (60 * $refreshInterval)
                
                $lockedoutusersC = $result.LockedOutUsersC
                if ($lockedoutusersC -ne $null) {
                    $unlockedCount += Unlock-Users -lockedoutusers $lockedoutusersC
                } else {
                    Write-Host "No Users to unlock"
                }
            } while ($true)

        }
    }

        # Add a restart message outside the loop
        Write-Host "Restarting the script..."
}