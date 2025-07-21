# Test Database Integration
# This script verifies that all database functions work correctly

param(
    [string]$DatabasePath = ".\database.db"
)

# Import database utilities
$ScriptDirectory = Split-Path $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDirectory "functions\DatabaseUtils.ps1")

Write-Host "=== Testing Database Integration ===" -ForegroundColor Cyan

# Test database connection
Write-Host "`n1. Testing database connection..." -ForegroundColor Yellow
if (Test-Path $DatabasePath) {
    Write-Host "   ✓ Database file exists" -ForegroundColor Green
} else {
    Write-Host "   ✗ Database file not found" -ForegroundColor Red
    exit 1
}

# Test DomainControllers table
Write-Host "`n2. Testing Domain Controllers..." -ForegroundColor Yellow
try {
    $dcs = Get-DomainControllers -DatabasePath $DatabasePath
    if ($dcs) {
        Write-Host "   ✓ Found $($dcs.Count) domain controllers" -ForegroundColor Green
        $dcs | ForEach-Object { Write-Host "     - $($_.ControllerName): $($_.Status)" -ForegroundColor Gray }
    } else {
        Write-Host "   ⚠ No domain controllers found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Error reading domain controllers: $_" -ForegroundColor Red
}

# Test Servers table
Write-Host "`n3. Testing Servers..." -ForegroundColor Yellow
try {
    $servers = Get-Servers -DatabasePath $DatabasePath
    if ($servers) {
        Write-Host "   ✓ Found $($servers.Count) servers" -ForegroundColor Green
        $servers | Select-Object -First 5 | ForEach-Object { 
            Write-Host "     - $($_.ServerName): $($_.Status)" -ForegroundColor Gray 
        }
        if ($servers.Count -gt 5) {
            Write-Host "     ... and $($servers.Count - 5) more" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠ No servers found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Error reading servers: $_" -ForegroundColor Red
}

# Test Users table
Write-Host "`n4. Testing Users..." -ForegroundColor Yellow
try {
    $connectionString = "Data Source=$DatabasePath"
    $connection = New-Object System.Data.SQLite.SQLiteConnection($connectionString)
    $connection.Open()
    
    $query = "SELECT COUNT(*) as UserCount FROM Users"
    $command = New-Object System.Data.SQLite.SQLiteCommand($query, $connection)
    $userCount = $command.ExecuteScalar()
    $connection.Close()
    
    Write-Host "   ✓ Found $userCount users in database" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Error reading users: $_" -ForegroundColor Red
}

# Test LockedOutUsers table
Write-Host "`n5. Testing Locked Out Users..." -ForegroundColor Yellow
try {
    $lockedUsers = Get-LockedOutUsers -DatabasePath $DatabasePath
    if ($lockedUsers) {
        Write-Host "   ✓ Found $($lockedUsers.Count) locked out users" -ForegroundColor Green
        $lockedUsers | ForEach-Object { 
            Write-Host "     - $($_.Username): $($_.LockoutTime)" -ForegroundColor Gray 
        }
    } else {
        Write-Host "   ⚠ No locked out users found (good!)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Error reading locked out users: $_" -ForegroundColor Red
}

Write-Host "`n=== Database Integration Test Complete ===" -ForegroundColor Cyan
