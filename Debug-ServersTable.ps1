# Debug script to examine Servers table data
Add-Type -LiteralPath ".\lib\System.Data.SQLite.dll"

$connectionString = "Data Source=.\database\database.db;Version=3;"
$connection = New-Object System.Data.SQLite.SQLiteConnection($connectionString)
$connection.Open()

Write-Host "=== Servers Table Sample Data ===" -ForegroundColor Green

$command = New-Object System.Data.SQLite.SQLiteCommand("SELECT ServerName, Status, OnlineTime, OfflineTime FROM Servers LIMIT 5;", $connection)
$reader = $command.ExecuteReader()

while ($reader.Read()) {
    $serverName = $reader[0]
    $status = $reader[1]
    $onlineTime = $reader[2]
    $offlineTime = $reader[3]
    
    Write-Host "Server: $serverName" -ForegroundColor Yellow
    Write-Host "  Status: $status" -ForegroundColor Gray
    Write-Host "  OnlineTime: '$onlineTime' (Type: $($onlineTime.GetType().Name))" -ForegroundColor Gray
    Write-Host "  OfflineTime: '$offlineTime' (Type: $($offlineTime.GetType().Name))" -ForegroundColor Gray
    Write-Host ""
}
$reader.Close()
$connection.Close()

Write-Host "Debug complete!" -ForegroundColor Green
