# Debug the Get-Servers function
. ".\functions\DatabaseUtils.ps1"

Write-Host "Testing Get-Servers function directly..." -ForegroundColor Yellow

try {
    $servers = Get-Servers -DatabasePath ".\database\database.db"
    Write-Host "Success! Found $($servers.Count) servers" -ForegroundColor Green
    
    if ($servers.Count -gt 0) {
        Write-Host "First server details:" -ForegroundColor Cyan
        $servers[0] | Format-List
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Stack Trace: $($_.ScriptStackTrace)" -ForegroundColor Red
}
