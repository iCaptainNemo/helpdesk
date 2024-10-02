# Import ActiveDirectory module
try {
    Write-Debug "Importing ActiveDirectory module."
    Import-Module ActiveDirectory -ErrorAction Stop
    Write-Verbose "ActiveDirectory module imported successfully."
} catch {
    Write-Error "Failed to import ActiveDirectory module: $_"
    exit 1
}

# Import PSSQLite module
try {
    if (-not (Get-Module -ListAvailable -Name PSSQLite)) {
        Write-Debug "PSSQLite module not found. Installing PSSQLite module."
        Install-Module -Name PSSQLite -Force -Scope CurrentUser -ErrorAction Stop
        Write-Verbose "PSSQLite module installed successfully."
    }
    Write-Debug "Importing PSSQLite module."
    Import-Module -Name PSSQLite -ErrorAction Stop
    Write-Verbose "PSSQLite module imported successfully."
} catch {
    Write-Error "Failed to import or install PSSQLite module: $_"
    exit 1
}

#Dot Source Manage-User function
. "$PSScriptRoot\Manage-User.ps1"

# Function to fetch user from the Users table
function Get-User {
    param (
        [string]$dbPath,
        [string]$userID
    )
    
    Write-Debug "Fetching user '$userID' from the database."

    # Always call Manage-User to ensure the user is inserted or updated
    Manage-User -dbPath $dbPath -userID $userID

    # Fetch the user row after Manage-User has run
    $fetchUserQuery = "SELECT * FROM Users WHERE UserID = '$userID';"
    $userRow = Invoke-SqliteQuery -DataSource $dbPath -Query $fetchUserQuery

    return $userRow
}

# Main script execution
$user = Get-User -dbPath $dbPath -userID $userID
$user
