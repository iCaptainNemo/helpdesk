param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName
)

# Returns the interactive/user processes running on a remote computer (excludes
# system accounts). Used by the ComputerStatusTable "Get Processes" feature so an
# admin can see and kill stuck user apps (e.g. AcroRd32) remotely.
try {
    $result = Invoke-Command -ComputerName $ComputerName -ErrorAction Stop -ScriptBlock {
        try {
            # -IncludeUserName gives the owning account in a single fast call.
            # Requires admin on the remote box (the service account already has this).
            $procs = Get-Process -IncludeUserName -ErrorAction Stop |
                Where-Object {
                    $_.UserName -and
                    $_.UserName -notmatch '^NT AUTHORITY\\' -and
                    $_.UserName -notmatch '^Window Manager\\' -and
                    $_.UserName -notmatch '^Font Driver Host\\'
                } |
                ForEach-Object {
                    [PSCustomObject]@{
                        Name      = $_.Name
                        ProcessId = $_.Id
                        UserName  = $_.UserName
                        MemoryMB  = [Math]::Round($_.WorkingSet64 / 1MB, 1)
                    }
                }

            return @{
                Success      = $true
                Processes    = @($procs)
                ProcessCount = @($procs).Count
                Message      = "Found $(@($procs).Count) user process(es)"
                ComputerName = $env:COMPUTERNAME
            }
        }
        catch {
            return @{
                Success      = $false
                Processes    = @()
                ProcessCount = 0
                Message      = "Error retrieving processes: $($_.Exception.Message)"
                ComputerName = $env:COMPUTERNAME
            }
        }
    }

    $result | ConvertTo-Json -Depth 6 -Compress
}
catch {
    @{
        Success      = $false
        Processes    = @()
        ProcessCount = 0
        Message      = "Error connecting to computer $ComputerName`: $($_.Exception.Message)"
        ComputerName = $ComputerName
    } | ConvertTo-Json -Compress
}
