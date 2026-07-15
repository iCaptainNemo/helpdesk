param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName,

    [Parameter(Mandatory=$true)]
    [int]$SessionId
)

# Launches Windows RD session shadowing (view + control) against a specific
# session. mstsc opens on the caller's desktop and uses the caller's credentials;
# the target user gets a consent prompt (unless a GPO disables it). This replaces
# the CmRcViewer deep link with a native, no-install remote-assist path.
try {
    Start-Process -FilePath 'mstsc.exe' -ArgumentList "/shadow:$SessionId", "/v:$ComputerName", "/control"

    @{
        Success      = $true
        Message      = "Launched shadow of session $SessionId on $ComputerName"
        ComputerName = $ComputerName
        SessionId    = $SessionId
    } | ConvertTo-Json -Compress
}
catch {
    @{
        Success      = $false
        Message      = "Failed to launch shadow: $($_.Exception.Message)"
        ComputerName = $ComputerName
        SessionId    = $SessionId
    } | ConvertTo-Json -Compress
}
