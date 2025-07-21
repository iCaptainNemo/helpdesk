# Database utility functions for Helpdesk GUI
# These functions provide a PowerShell interface to the SQLite database

function Connect-Database {
    param([string]$DatabasePath)
    
    if (-not (Test-Path $DatabasePath)) {
        throw "Database file not found: $DatabasePath"
    }
    
    $connectionString = "Data Source=$DatabasePath;Version=3;"
    $connection = New-Object System.Data.SQLite.SQLiteConnection($connectionString)
    $connection.Open()
    return $connection
}

function Invoke-DatabaseQuery {
    param(
        [string]$DatabasePath,
        [string]$Query,
        [hashtable]$Parameters = @{}
    )
    
    $connection = Connect-Database -DatabasePath $DatabasePath
    try {
        $command = New-Object System.Data.SQLite.SQLiteCommand($Query, $connection)
        
        foreach ($param in $Parameters.GetEnumerator()) {
            $command.Parameters.AddWithValue($param.Key, $param.Value) | Out-Null
        }
        
        if ($Query.Trim().ToUpper().StartsWith("SELECT")) {
            $adapter = New-Object System.Data.SQLite.SQLiteDataAdapter($command)
            $dataTable = New-Object System.Data.DataTable
            $adapter.Fill($dataTable) | Out-Null
            
            # Convert DataTable to PowerShell objects
            $results = @()
            foreach ($row in $dataTable.Rows) {
                $obj = New-Object PSObject
                foreach ($column in $dataTable.Columns) {
                    $obj | Add-Member -MemberType NoteProperty -Name $column.ColumnName -Value $row[$column]
                }
                $results += $obj
            }
            return $results
        } else {
            return $command.ExecuteNonQuery()
        }
    }
    finally {
        $connection.Close()
    }
}

# Legacy log functions (for backward compatibility)
# Functions for existing database tables
function Get-DomainControllers {
    param([string]$DatabasePath)
    
    $query = "SELECT ControllerName, Details, Role, Status FROM DomainControllers ORDER BY ControllerName"
    return Invoke-DatabaseQuery -DatabasePath $DatabasePath -Query $query
}

function Update-DomainControllerStatus {
    param(
        [string]$DatabasePath,
        [string]$ControllerName,
        [string]$Status,
        [string]$Details = $null
    )
    
    $parameters = @{
        "@controller" = $ControllerName
        "@status" = $Status
    }
    
    if ($Details) {
        $parameters["@details"] = $Details
        $query = "UPDATE DomainControllers SET Status = @status, Details = @details WHERE ControllerName = @controller"
    } else {
        $query = "UPDATE DomainControllers SET Status = @status WHERE ControllerName = @controller"
    }
    
    Invoke-DatabaseQuery -DatabasePath $DatabasePath -Query $query -Parameters $parameters
}

function Get-Servers {
    param([string]$DatabasePath)
    
    try {
        $connectionString = "Data Source=$DatabasePath"
        $connection = New-Object System.Data.SQLite.SQLiteConnection($connectionString)
        $connection.Open()
        
        $query = "SELECT ServerName, Description, Status, Location, FileShareService, OnlineTime, OfflineTime FROM Servers ORDER BY ServerName"
        $command = New-Object System.Data.SQLite.SQLiteCommand($query, $connection)
        $reader = $command.ExecuteReader()
        
        $servers = @()
        while ($reader.Read()) {
            # Helper function to safely get string value
            $getValue = { param($fieldName)
                $value = $reader[$fieldName]
                if ($value -eq [DBNull]::Value -or $null -eq $value -or [string]::IsNullOrEmpty($value)) {
                    return ""
                } else {
                    return $value.ToString()
                }
            }
            
            $server = [PSCustomObject]@{
                ServerName = & $getValue "ServerName"
                Description = & $getValue "Description"
                Status = if ((& $getValue "Status") -eq "") { "Unknown" } else { & $getValue "Status" }
                Location = & $getValue "Location"
                FileShareService = & $getValue "FileShareService"
                OnlineTime = & $getValue "OnlineTime"
                OfflineTime = & $getValue "OfflineTime"
            }
            $servers += $server
        }
        
        $reader.Close()
        $connection.Close()
        return $servers
    }
    catch {
        Write-Warning "Failed to get servers: $_"
        if ($connection -and $connection.State -eq "Open") {
            $connection.Close()
        }
        return @()
    }
}

function Update-ServerStatus {
    param(
        [string]$DatabasePath,
        [string]$ServerName,
        [string]$Status,
        [string]$Description = $null
    )
    
    $parameters = @{
        "@server" = $ServerName
        "@status" = $Status
        "@timestamp" = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }
    
    if ($Status -eq "Online") {
        $query = "UPDATE Servers SET Status = @status, OnlineTime = @timestamp WHERE ServerName = @server"
    } else {
        $query = "UPDATE Servers SET Status = @status, OfflineTime = @timestamp WHERE ServerName = @server"
    }
    
    if ($Description) {
        $parameters["@description"] = $Description
        $query = $query.Replace("WHERE", ", Description = @description WHERE")
    }
    
    Invoke-DatabaseQuery -DatabasePath $DatabasePath -Query $query -Parameters $parameters
}

function Get-LockedOutUsers {
    param([string]$DatabasePath)
    
    try {
        $connectionString = "Data Source=$DatabasePath"
        $connection = New-Object System.Data.SQLite.SQLiteConnection($connectionString)
        $connection.Open()
        
        $query = "SELECT UserID, name, department, AccountLockoutTime FROM LockedOutUsers ORDER BY AccountLockoutTime DESC"
        $command = New-Object System.Data.SQLite.SQLiteCommand($query, $connection)
        $reader = $command.ExecuteReader()
        
        $users = @()
        while ($reader.Read()) {
            # Helper function to safely get string value
            $getValue = { param($fieldName)
                $value = $reader[$fieldName]
                if ($value -eq [DBNull]::Value -or $null -eq $value -or [string]::IsNullOrEmpty($value)) {
                    return ""
                } else {
                    return $value.ToString()
                }
            }
            
            $user = [PSCustomObject]@{
                UserID = & $getValue "UserID"
                Username = & $getValue "name"
                Department = & $getValue "department"
                LockoutTime = & $getValue "AccountLockoutTime"
            }
            $users += $user
        }
        
        $reader.Close()
        $connection.Close()
        return $users
    }
    catch {
        Write-Warning "Failed to get locked out users: $_"
        if ($connection -and $connection.State -eq "Open") {
            $connection.Close()
        }
        return @()
    }
}

function Remove-LockedOutUser {
    param(
        [string]$DatabasePath,
        [string]$UserID
    )
    
    $parameters = @{ "@userid" = $UserID }
    $query = "DELETE FROM LockedOutUsers WHERE UserID = @userid"
    Invoke-DatabaseQuery -DatabasePath $DatabasePath -Query $query -Parameters $parameters
}

function Update-DomainControllerStatus {
    param(
        [string]$DatabasePath,
        [string]$ControllerName,
        [string]$Status
    )
    
    try {
        $connectionString = "Data Source=$DatabasePath"
        $connection = New-Object System.Data.SQLite.SQLiteConnection($connectionString)
        $connection.Open()
        
        $query = "UPDATE DomainControllers SET Status = @Status WHERE ControllerName = @ControllerName"
        $command = New-Object System.Data.SQLite.SQLiteCommand($query, $connection)
        $command.Parameters.AddWithValue("@Status", $Status) | Out-Null
        $command.Parameters.AddWithValue("@ControllerName", $ControllerName) | Out-Null
        
        $rowsAffected = $command.ExecuteNonQuery()
        $connection.Close()
        
        return $rowsAffected -gt 0
    }
    catch {
        Write-Warning "Failed to update domain controller status: $_"
        if ($connection -and $connection.State -eq "Open") {
            $connection.Close()
        }
        return $false
    }
}

function Update-UserStats {
    param(
        [string]$DatabasePath,
        [string]$UserID,
        [string]$Action = "Helped"
    )
    
    $parameters = @{
        "@userid" = $UserID
        "@timestamp" = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }
    
    # Check if user exists
    $existsQuery = "SELECT UserID FROM Users WHERE UserID = @userid"
    $exists = Invoke-DatabaseQuery -DatabasePath $DatabasePath -Query $existsQuery -Parameters @{ "@userid" = $UserID }
    
    if ($exists) {
        # Update existing user
        switch ($Action) {
            "Unlocked" {
                $query = "UPDATE Users SET TimesUnlocked = TimesUnlocked + 1, LastHelped = @timestamp WHERE UserID = @userid"
            }
            "PasswordReset" {
                $query = "UPDATE Users SET PasswordResets = PasswordResets + 1, LastHelped = @timestamp WHERE UserID = @userid"
            }
            default {
                $query = "UPDATE Users SET TimesHelped = TimesHelped + 1, LastHelped = @timestamp WHERE UserID = @userid"
            }
        }
    } else {
        # Create new user
        switch ($Action) {
            "Unlocked" {
                $query = "INSERT INTO Users (UserID, LastHelped, TimesUnlocked, PasswordResets, TimesHelped) VALUES (@userid, @timestamp, 1, 0, 0)"
            }
            "PasswordReset" {
                $query = "INSERT INTO Users (UserID, LastHelped, TimesUnlocked, PasswordResets, TimesHelped) VALUES (@userid, @timestamp, 0, 1, 0)"
            }
            default {
                $query = "INSERT INTO Users (UserID, LastHelped, TimesUnlocked, PasswordResets, TimesHelped) VALUES (@userid, @timestamp, 0, 0, 1)"
            }
        }
    }
    
    Invoke-DatabaseQuery -DatabasePath $DatabasePath -Query $query -Parameters $parameters
}

function Get-CurrentDomain {
    param([string]$DatabasePath)
    
    $query = "SELECT DomainName, PDC, DDC FROM CurrentDomain LIMIT 1"
    return Invoke-DatabaseQuery -DatabasePath $DatabasePath -Query $query
}
