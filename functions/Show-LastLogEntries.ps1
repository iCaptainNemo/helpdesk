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

        # Assuming $logEntry has the format "TAD062DT379527 Tue 12/19/2023 14:49:26.98"
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
            Write-Host "Last 10 login entries with parsed information:"
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