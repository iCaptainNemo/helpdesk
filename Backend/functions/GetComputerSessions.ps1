param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName
)

# Enumerates logon sessions on a remote computer via quser (the RPC channel RD
# shadowing also uses, so a success here doubles as a reachability pre-check).
# Used to pick the correct session ID for `mstsc /shadow`.
try {
    $output = quser /server:$ComputerName 2>&1

    if ($LASTEXITCODE -ne 0) {
        return (@{
            Success  = $false
            Sessions = @()
            Message  = "Could not query sessions: $($output -join ' ')"
        } | ConvertTo-Json -Compress)
    }

    $sessions = foreach ($line in ($output | Select-Object -Skip 1)) {
        # Columns: [>]USERNAME [SESSIONNAME] ID STATE  IDLE  LOGON
        # SESSIONNAME is blank for disconnected sessions, so it is optional here.
        if ($line -match '^\s*>?\s*(\S+)\s+(?:(\S+)\s+)?(\d+)\s+(\S+)(?:\s+(.*))?$') {
            [PSCustomObject]@{
                Username    = $Matches[1]
                SessionName = if ($Matches[2]) { $Matches[2] } else { '' }
                SessionId   = [int]$Matches[3]
                State       = $Matches[4]
                Info        = if ($Matches[5]) { $Matches[5].Trim() } else { '' }  # idle + logon time
            }
        }
    }

    @{
        Success  = $true
        Sessions = @($sessions)
        Message  = "Found $(@($sessions).Count) session(s)"
        ComputerName = $ComputerName
    } | ConvertTo-Json -Depth 5 -Compress
}
catch {
    @{
        Success  = $false
        Sessions = @()
        Message  = "Error querying sessions on $ComputerName`: $($_.Exception.Message)"
    } | ConvertTo-Json -Compress
}
