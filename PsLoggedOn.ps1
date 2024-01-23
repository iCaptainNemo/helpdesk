# Import the Get-UserId function
. .\functions\Get-UserId.ps1

# Import the Get-PossibleComputers function
. .\functions\Asset-Control.ps1

# Define the path to PsLoggedOn
$psLoggedOnPath = ".\Tools\PsLoggedon.exe"

# Get the user ID
$userID = Get-UserId

# Get the list of possible computers
$result = Show-LastLogEntries -logFilePath $logFilePath
$possibleComputers = $result.PossibleComputers

# Display possible computers as a numbered list
Write-Host "Possible Computers:"
for ($i = 0; $i -lt $possibleComputers.Count; $i++) {
    Write-Host "$($i + 1). $($possibleComputers[$i])"

    # Check if the user is logged on to the computer
    $computerName = $possibleComputers[$i]
    $output = & $psLoggedOnPath -l -x \\$computerName | Out-String

    if ($output -match $userID) {
        Write-Host "$userID is logged on to $computerName"
    } else {
        Write-Host "$userID is not logged on to $computerName"
    }
}

Read-Host "Press any key to continue"
```