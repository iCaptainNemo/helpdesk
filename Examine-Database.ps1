# Script to examine the existing database structure
Add-Type -LiteralPath ".\lib\System.Data.SQLite.dll"

$connectionString = "Data Source=.\database\database.db;Version=3;"
$connection = New-Object System.Data.SQLite.SQLiteConnection($connectionString)
$connection.Open()

Write-Host "=== Tables in your database ===" -ForegroundColor Green

# Get all tables
$command = New-Object System.Data.SQLite.SQLiteCommand("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;", $connection)
$reader = $command.ExecuteReader()

$tables = @()
while ($reader.Read()) {
    $tableName = $reader[0]
    $tables += $tableName
    Write-Host "- $tableName" -ForegroundColor Cyan
}
$reader.Close()

Write-Host "`n=== Table Structures ===" -ForegroundColor Green

# Get structure for each table
foreach ($table in $tables) {
    Write-Host "`nTable: $table" -ForegroundColor Yellow
    $command = New-Object System.Data.SQLite.SQLiteCommand("PRAGMA table_info($table);", $connection)
    $reader = $command.ExecuteReader()
    
    while ($reader.Read()) {
        $columnName = $reader[1]
        $columnType = $reader[2]
        $notNull = if ($reader[3] -eq 1) { "NOT NULL" } else { "" }
        $primaryKey = if ($reader[5] -eq 1) { "PRIMARY KEY" } else { "" }
        Write-Host "  $columnName $columnType $notNull $primaryKey" -ForegroundColor Gray
    }
    $reader.Close()
}

$connection.Close()
Write-Host "`nDatabase examination complete!" -ForegroundColor Green
