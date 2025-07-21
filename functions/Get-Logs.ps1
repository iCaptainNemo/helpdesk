param (
    [string]$logFilePath,
    [string]$currentADObjectID
)

# Function to display last 10 log entries with parsed information
function Show-LastLogEntries {
    param (
        [string]$logFilePath,
        [string]$currentADObjectID
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
            Computer = $PossibleComputerName
            Day = $day
            Date = $date
            Time = $time
        }
    }

    # Initialize $logTable as an empty array
    $logTable = @()

    try {
        # Construct the full log file path using the currentADObjectID
        $fullLogFilePath = Join-Path -Path $logFilePath -ChildPath "$currentADObjectID.log"

        # Check if the log file exists
        if (Test-Path $fullLogFilePath -PathType Leaf) {
            $logEntries = Get-Content $fullLogFilePath -Tail 50
            foreach ($entry in $logEntries) {
                $parsedInfo = Parse-LogEntry -logEntry $entry
                # Add the parsed log entry to the $logTable array
                $logTable += [PSCustomObject]@{
                    Computer = $parsedInfo.Computer
                    Day = $parsedInfo.Day
                    Date = $parsedInfo.Date
                    Time = $parsedInfo.Time
                }
            }
        }
    } catch {
        # Handle errors if needed
    }
    # Return $logTable as JSON
    return $logTable | ConvertTo-Json -Compress
}

# Store the result of the function call
$logs = Show-LastLogEntries -logFilePath $logFilePath -currentADObjectID $currentADObjectID

# Output the result as JSON
$logs | ConvertTo-Json -Compress