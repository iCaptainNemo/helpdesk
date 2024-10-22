# Import the Active Directory module
Import-Module ActiveDirectory

param (
    [string]$logFilePath,
    [string]$currentADObjectID
)

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

    # Initialize $logTable as an empty array
    $logTable = @()

    try {
        # Construct the full log file path using the currentADObjectID
        $fullLogFilePath = Join-Path -Path $logFilePath -ChildPath "$currentADObjectID.log"
        Write-Host "Full log file path: $fullLogFilePath"

        # Check if the log file exists
        if (Test-Path $fullLogFilePath -PathType Leaf) {
            $logEntries = Get-Content $fullLogFilePath -Tail 10
            Write-Host "Last 10 login entries.:"
            # Add a line break or additional Write-Host statements for space
            Write-Host "`n"
            foreach ($entry in $logEntries) {
                $parsedInfo = Parse-LogEntry -logEntry $entry
                # Add the log entry to the $logTable array
                $logTable += "$($parsedInfo.PossibleComputerName) $($parsedInfo.Day) $($parsedInfo.Date) $($parsedInfo.Time)"
            }
        } else {
            Write-Host "No computer logs found" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "No computer logs found" -ForegroundColor Yellow
    }
    # Return $logTable as JSON
    return @{
        LogTable = $logTable
    } | ConvertTo-Json -Compress
}

# Call the function and output the result
Show-LastLogEntries -logFilePath $logFilePath