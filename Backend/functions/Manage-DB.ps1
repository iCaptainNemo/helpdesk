# Function to ensure the database exists and has the correct schema
function Manage-DB {
    param (
        [string]$dbPath
    )

    # Define the tables and their columns
    $tables = @(
        @{
            Name = "Admin"
            Columns = @(
                "userID TEXT PRIMARY KEY",
                "temppassword TEXT",
                "logfile TEXT"
            )
        },
        @{
            Name = "Users"
            Columns = @(
                "UserID TEXT PRIMARY KEY",
                "LastHelped DATETIME",
                "TimesUnlocked INT",
                "PasswordResets INT",
                "badPwdCount INT",
                "City TEXT",
                "Created DATETIME",
                "department TEXT",
                "givenName TEXT",
                "homeDirectory TEXT",
                "lastLogon DATETIME",
                "Modified DATETIME",
                "badPasswordTime DATETIME",
                "lockoutTime DATETIME",
                "mail TEXT",
                "pwdLastSet DATETIME",
                "sn TEXT",
                "streetAddress TEXT",
                "telephoneNumber TEXT",
                "Title TEXT",
                "MemberOf TEXT",
                "Computers TEXT"
            )
        }
    )

    # Create the database and tables if they do not exist
    foreach ($table in $tables) {
        $tableName = $table.Name
        $columns = $table.Columns -join ", "
        $createTableQuery = "CREATE TABLE IF NOT EXISTS $tableName ($columns);"
        Invoke-SqliteQuery -DataSource $dbPath -Query $createTableQuery

        # Check for missing columns and add them if necessary
        $existingColumnsQuery = "PRAGMA table_info($tableName);"
        $existingColumns = Invoke-SqliteQuery -DataSource $dbPath -Query $existingColumnsQuery | Select-Object -ExpandProperty name

        foreach ($column in $table.Columns) {
            $columnName = $column.Split(" ")[0]
            if ($existingColumns -notcontains $columnName) {
                $addColumnQuery = "ALTER TABLE $tableName ADD COLUMN $column;"
                Invoke-SqliteQuery -DataSource $dbPath -Query $addColumnQuery
            }
        }

        # Create an index on UserID if the table is Users
        if ($tableName -eq "Users") {
            $createIndexQuery = "CREATE INDEX IF NOT EXISTS idx_UserID ON Users (UserID);"
            Invoke-SqliteQuery -DataSource $dbPath -Query $createIndexQuery
        }
    }
}