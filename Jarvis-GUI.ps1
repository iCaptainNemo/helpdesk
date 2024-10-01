param (
    [switch]$Debug  # Parameter to enable debug mode
)

# If the Debug switch is provided, set the debug preference to 'Continue'
if ($Debug) {
    $DebugPreference = 'Continue'
}

# Import functions
. .\functions\Hide-Console.ps1
. .\functions\Manage-DB.ps1
. .\functions\Manage-AdminUser.ps1
. .\functions\Manage-User.ps1

## Call functions needed at start
# Hide-Console


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


# Get the current domain and enviroment type
try {
    #Write-Host "Checking if powershell AD Module is enabled..." -ForegroundColor Yellow
    $currentDomain = (Get-ADDomain -ErrorAction SilentlyContinue -WarningAction SilentlyContinue).DNSRoot
    $env:CommandType = "Power"
    $powershell = $true
    $WMI = $false
    } catch {
        try {
            $currentDomain = (Get-WmiObject -Class Win32_ComputerSystem).Domain
            $env:CommandType = "WMI"
            $powershell = $false
            $WMI = $true
        } catch {
            Write-Host "Error getting domain. Due to restrictive environment this script is unable to perform. Press any key to exit." -ForegroundColor Red
            $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit
        }
}


# Database path
$dbPath = ".\db\database.db"

# Ensure the database and schema are correct
Manage-DB -dbPath $dbPath

# Ensure the admin user exists, prompt for null values, and return the row
$AdminUser = $env:USERNAME.ToUpper()
$admin = Manage-AdminUser -dbPath $dbPath -AdminUser $AdminUser

# Print out the row for the current admin user
Write-Host "Admin user Settings:"
$admin.userID
$admin.temppassword
$admin.logfile

# Prompt for userID
$userID = Read-Host "Enter the userID"
$userID = $userID.ToUpper()

# Ensure the user exists or is updated in the database and get the user row
#$user = Manage-User -dbPath $dbPath -userID $userID
$user = Fetch-User $userID

$user 
write-host ""
$user.givenName
Write-Host "End of script"
pause