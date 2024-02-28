
while ($panesEnabled -eq $true -and $ShowLastLogEntries -eq $true) {
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

    # Update the logFilePath
    $logFilePath = $envVars['logFileBasePath'] + $envVars['UserID']

    # Wait until the Changed event is triggered
    Start-Sleep -seconds 3
}

# Function to display last 10 log entries with parsed information
function Show-LastLogEntries {
    param (
        [string]$logFilePath
    )

    # Function to parse log entry
    function Parse-LogEntry {
        param (
            [string]$logEntry
        )

        # Assuming $logEntry has the format "<computername> Tue 12/19/2023 14:49:26.98"
        $components = $logEntry -split ' '
        $PossibleComputerName = $components[0]
        $day = $components[1]
        $date = $components[2]
        $time = $components[3]

        # Return parsed information
        return @{
            PossibleComputerName = $PossibleComputerName
            Day = $day
            Date = $date
            Time = $time
        }
    }

    # Initialize $possibleComputers and $logTable as empty arrays
    $possibleComputers = @()
    $logTable = @()

    try {
        # Check if the log file exists
        if (Test-Path $logFilePath -PathType Leaf) {
            $logEntries = Get-Content $logFilePath -Tail 10
            Write-Host "Last 10 login entries.:"
            # Add a line break or additional Write-Host statements for space
            Write-Host "`n"
            foreach ($entry in $logEntries) {
                $parsedInfo = Parse-LogEntry -logEntry $entry
                # Add the PossibleComputerName to the $possibleComputers array
                $possibleComputers += $parsedInfo.PossibleComputerName
                # Add the log entry to the $logTable array
                $logTable += "$($parsedInfo.PossibleComputerName) $($parsedInfo.Day) $($parsedInfo.Date) $($parsedInfo.Time)"
            }
        } else {
            Write-Host " No computer logs found" -ForegroundColor Yellow
        }
    } catch {
        # Write-Host "Error: $_" -ForegroundColor Red
        Write-Host "No computer logs found" -ForegroundColor Yellow
    }
    # Return $possibleComputers and $logTable
    return @{
        PossibleComputers = $possibleComputers
        LogTable = $logTable
    }
}