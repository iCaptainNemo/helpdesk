# Function to unlock AD account on all domain controllers
function Unlock-ADAccountOnAllDomainControllers {
    param (
        [string]$userId
    )

    $dcList = $PSDomains + $cmdDomains
    $netUserCommandExecuted = $false

    $jobs = foreach ($targetDC in $dcList) {
        Start-Job -ScriptBlock {
            param ($userId, $targetDC, $PSDomains, $cmdDomains, $netUserCommandExecuted)
            $error.Clear()
            if ($targetDC -in $PSDomains) {
                Unlock-ADAccount -Identity $userId -Server $targetDC -ErrorAction SilentlyContinue -ErrorVariable unlockError
            } elseif ($targetDC -in $cmdDomains -and !$netUserCommandExecuted) {
                net user $userID /active:yes > $null 2>&1
                $netUserCommandExecuted = $true
            }
            if ($unlockError) {
                "Error unlocking account: $unlockError"
            } else {
                Write-Host ($targetDC) -BackgroundColor DarkGreen
            }
        } -ArgumentList $userId, $targetDC, $PSDomains, $cmdDomains, $netUserCommandExecuted
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