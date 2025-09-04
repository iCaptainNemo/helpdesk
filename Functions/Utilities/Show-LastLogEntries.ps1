
<#
.SYNOPSIS
    Domain-specific log entry management and display functions for user activity tracking
.DESCRIPTION
    Provides functions to monitor, parse, and display user activity log entries.
    Supports continuous monitoring and intelligent parsing of computer access logs
    for helpdesk operations and computer selection assistance.
    
    ⚠️  REQUIRES DOMAIN-SPECIFIC CUSTOMIZATION:
    This file must be customized for each domain's log format and storage system.
    The log parsing logic, file paths, and computer name extraction must be adapted
    to match your domain's specific logging implementation. At minimum, the system
    must be able to extract computer names from log entries for Jarvis to function.
.FUNCTIONALITY
    - Parses log entries to extract computer names and access timestamps
    - Displays configurable number of unique computers with most recent access times
    - Supports continuous monitoring mode for real-time updates
    - Handles duplicate computer entries and maintains chronological order
    - Uses admin configuration for display preferences and log format settings
.CUSTOMIZATION
    1. Update log file path patterns in logFilePath construction
    2. Modify Parse-LogEntry function to match your domain's log format
    3. Adjust computer name extraction logic (PossibleComputerName field)
    4. Update date/time parsing to match your log timestamp format
    5. Configure admin YAML file Logging section with domain-specific settings
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: Log file access, YAML environment configuration, domain-specific customization
    Part of: Jarvis Helpdesk Automation System - Utilities
#>

# This function would run a continuous loop if needed - moved to function definition
function Start-LogEntriesMonitor {
    while ($panesEnabled -eq $true -and $ShowLastLogEntries -eq $true) {
        Write-Debug "All conditions met, proceeding..."
        if (-not $DebugPreference -eq 'Continue') { Clear-Host }

        # Get the UserID of the person being helped for their computer logs
        $userId = $script:envVars['UserID']
        Write-Debug "User being helped: $userId"

        # Construct logFilePath from domain configuration + user being helped ID
        if ($script:DomainConfig -and $script:DomainConfig['Environment'] -and $script:DomainConfig['Environment']['LogFilePath']) {
            $logBasePath = $script:DomainConfig['Environment']['LogFilePath']
            $logFilePath = Join-Path $logBasePath "$userId.log"
            Write-Debug "Log file path constructed for user being helped: $logFilePath"
        } else {
            Write-Debug "No log file path configured in domain settings"
            $logFilePath = $null
        }

        # Wait until the Changed event is triggered
        Start-Sleep -seconds 3
    }
}

# Function to display configurable log entries with parsed information
function Show-LastLogEntries {
    param (
        [string]$logFilePath = $null
    )
    
    # If no logFilePath provided, construct from domain configuration + user being helped
    if ([string]::IsNullOrEmpty($logFilePath)) {
        if ($script:DomainConfig -and $script:DomainConfig['Environment'] -and $script:DomainConfig['Environment']['LogFilePath']) {
            # Use the ID of the user being helped to find their computer logs
            $currentUserId = $script:envVars['UserID']
            $logBasePath = $script:DomainConfig['Environment']['LogFilePath']
            
            if ($currentUserId) {
                Write-Debug "Join-Path inputs: BasePath='$logBasePath', UserId='$currentUserId'"
                $logFilePath = Join-Path $logBasePath "$currentUserId.log"
                Write-Debug "Join-Path result: '$logFilePath'"
                Write-Debug "Constructed log file path for user being helped ($currentUserId): $logFilePath"
            } else {
                Write-Debug "No user ID available for log path construction"
                return @{ PossibleComputers = @(); LogTable = @() }
            }
        } else {
            Write-Debug "No log file path configured in domain settings"
            return @{ PossibleComputers = @(); LogTable = @() }
        }
    }

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
        Write-Debug "Checking log file path: '$logFilePath'"
        Write-Debug "Log file path length: $($logFilePath.Length) characters"
        Write-Debug "Log file path type: $($logFilePath.GetType())"
        
        # Check if the log file exists
        if (Test-Path $logFilePath -PathType Leaf) {
            Write-Debug "Log file found, reading entries from: '$logFilePath'"
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
            
            # Get configurable log entry count from admin configuration
            $logEntryCount = 10  # Default fallback
            if ($script:AdminConfig -and $script:AdminConfig['Display'] -and $script:AdminConfig['Display']['LogEntryCount']) {
                $logEntryCount = $script:AdminConfig['Display']['LogEntryCount']
                Write-Debug "Using admin-configured log entry count: $logEntryCount"
            }
            
            # Safety check to ensure valid count
            if ($logEntryCount -le 0 -or $null -eq $logEntryCount) {
                $logEntryCount = 10
                Write-Debug "Invalid log entry count, using default: 10"
            }
            
            Write-Host "Last $logEntryCount unique computers (most recent access):" -ForegroundColor Green
            Write-Host ""
            
            # Sort by oldest access time first, then take configured count and reverse for bottom-most recent display
            $topUniqueComputers = $uniqueComputers.Values | 
                Sort-Object { $_.DateTime } -Descending | 
                Select-Object -First $logEntryCount |
                Sort-Object { $_.DateTime }
            Write-Host ""
            
            foreach ($computerEntry in $topUniqueComputers) {
                $parsedInfo = $computerEntry.ParsedInfo
                # Add the PossibleComputerName to the $possibleComputers array
                $possibleComputers += $parsedInfo.PossibleComputerName
                # Add the log entry to the $logTable array (maintaining original format)
                $logTable += "$($parsedInfo.PossibleComputerName) $($parsedInfo.Day) $($parsedInfo.Date) $($parsedInfo.Time)"
            }
        } else {
            Write-Host " No computer logs found at: $logFilePath" -ForegroundColor Yellow
            Write-Debug "Log file does not exist at: $logFilePath"
        }
    } catch {
        Write-Host "Error accessing log file at: $logFilePath - $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception details: $($_.Exception)"
    }
    # Return $possibleComputers and $logTable
    return @{
        PossibleComputers = $possibleComputers
        LogTable = $logTable
    }
}