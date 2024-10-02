# Function to check if the admin user exists, prompt to fill null values, and return the row
function Manage-AdminUser {
    param (
        [string]$dbPath,
        [string]$AdminUser
    )

    # Check if the admin user exists and fetch the row
    $fetchUserQuery = "SELECT * FROM Admin WHERE userID = '$AdminUser';"
    $adminUserRow = Invoke-SqliteQuery -DataSource $dbPath -Query $fetchUserQuery

    if ($adminUserRow.Count -eq 0) {
        # Insert the admin user with default values if not found
        $insertUserQuery = "INSERT INTO Admin (userID, temppassword, logfile) VALUES ('$AdminUser', NULL, NULL);"
        Invoke-SqliteQuery -DataSource $dbPath -Query $insertUserQuery
        Write-Host "Admin user '$AdminUser' inserted into the database."

        # Fetch the newly inserted row
        $adminUserRow = Invoke-SqliteQuery -DataSource $dbPath -Query $fetchUserQuery
    }

    # Prompt to fill in null values
    $fields = @("temppassword", "logfile")
    $updateNeeded = $false
    foreach ($field in $fields) {
        if (-not $adminUserRow.$field) {
            $value = Read-Host "Enter value for $field"
            $updateQuery = "UPDATE Admin SET $field = '$value' WHERE userID = '$AdminUser';"
            Invoke-SqliteQuery -DataSource $dbPath -Query $updateQuery
            $updateNeeded = $true
        }
    }

    # Fetch the updated row if any updates were made
    if ($updateNeeded) {
        $adminUserRow = Invoke-SqliteQuery -DataSource $dbPath -Query $fetchUserQuery
    }

    return $adminUserRow
}