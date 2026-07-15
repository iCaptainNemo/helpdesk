param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName,

    [Parameter(Mandatory=$true)]
    [string]$ProcessName
)

# Stops all instances of a named process on a remote computer, mirroring the
# manual `Stop-Process -Name <x> -Force`. ProcessName is the base name without
# the .exe extension (as returned by GetUserProcesses.ps1).
try {
    $result = Invoke-Command -ComputerName $ComputerName -ErrorAction Stop -ScriptBlock {
        param($name)
        try {
            $procs = Get-Process -Name $name -ErrorAction Stop
            $count = @($procs).Count
            $procs | Stop-Process -Force -ErrorAction Stop

            return @{
                Success      = $true
                Killed       = $count
                ProcessName  = $name
                Message      = "Stopped $count instance(s) of $name"
                ComputerName = $env:COMPUTERNAME
            }
        }
        catch {
            return @{
                Success      = $false
                Killed       = 0
                ProcessName  = $name
                Message      = "Error stopping ${name}: $($_.Exception.Message)"
                ComputerName = $env:COMPUTERNAME
            }
        }
    } -ArgumentList $ProcessName

    $result | ConvertTo-Json -Compress
}
catch {
    @{
        Success      = $false
        Killed       = 0
        ProcessName  = $ProcessName
        Message      = "Error connecting to computer $ComputerName`: $($_.Exception.Message)"
        ComputerName = $ComputerName
    } | ConvertTo-Json -Compress
}
