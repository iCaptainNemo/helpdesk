
while ($panesEnabled -eq $true -and $ShowLastLogEntries -eq $true) {
    Write-Debug "All conditions met, proceeding..."
    Clear-Host

    # Get the updated UserID from script environment variables (YAML system)
    $userId = $script:envVars['UserID']
    Write-Debug "$userID"

    # Update the logFilePath from script variables
    $logFilePath = $script:envVars['logFileBasePath'] + $script:envVars['UserID']

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
            # Get all log entries (not just last 10)
            $allLogEntries = Get-Content $logFilePath
            
            # Create hashtable to track latest entry for each computer
            $uniqueComputers = @{}
            
            foreach ($entry in $allLogEntries) {
                $parsedInfo = Parse-LogEntry -logEntry $entry
                $computerName = $parsedInfo.PossibleComputerName
                
                # Convert date/time to sortable format for comparison
                try {
                    $dateTimeString = "$($parsedInfo.Date) $($parsedInfo.Time)"
                    $dateTime = [DateTime]::Parse($dateTimeString)
                    
                    # Only keep this entry if it's the latest for this computer
                    if (-not $uniqueComputers.ContainsKey($computerName) -or $dateTime -gt $uniqueComputers[$computerName].DateTime) {
                        $uniqueComputers[$computerName] = @{
                            ParsedInfo = $parsedInfo
                            DateTime = $dateTime
                            OriginalEntry = $entry
                        }
                    }
                } catch {
                    # If date parsing fails, still include the entry but with current time for sorting
                    Write-Debug "Failed to parse date for entry: $entry"
                    if (-not $uniqueComputers.ContainsKey($computerName)) {
                        $uniqueComputers[$computerName] = @{
                            ParsedInfo = $parsedInfo
                            DateTime = Get-Date
                            OriginalEntry = $entry
                        }
                    }
                }
            }
            
            # Sort by oldest access time first, then take top 10 and reverse for bottom-most recent display
            $top10UniqueComputers = $uniqueComputers.Values | 
                Sort-Object { $_.DateTime } -Descending | 
                Select-Object -First 10 |
                Sort-Object { $_.DateTime }
            
            Write-Host "Last 10 unique computers (most recent access):" -ForegroundColor Green
            Write-Host ""
            
            foreach ($computerEntry in $top10UniqueComputers) {
                $parsedInfo = $computerEntry.ParsedInfo
                # Add the PossibleComputerName to the $possibleComputers array
                $possibleComputers += $parsedInfo.PossibleComputerName
                # Add the log entry to the $logTable array (maintaining original format)
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