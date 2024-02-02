function Clear-BrowserCacheRemote
{
    [CmdletBinding(ConfirmImpact = 'None')]
    param
    (
        [Parameter(Mandatory = $true,
                   HelpMessage = 'User ID')]
        [string]
        $userID,
        [Parameter(Mandatory = $true,
                   HelpMessage = 'Computer Name')]
        [string]
        $computerName,  # Changed from $computer to $computerName
        [Parameter(Mandatory = $true,
                   HelpMessage = 'Browser to clear')]
        [ValidateSet('Chrome', 'Edge', 'All')]
        [string]
        $browser
    )

    switch ($browser) {
        'Chrome' {
            $cacheDir = "C:\Users\$userID\AppData\Local\Google\Chrome\User Data\Default\Cache\*"
        }
        'Edge' {
            $cacheDir = "C:\Users\$userID\AppData\Local\Microsoft\Edge\User Data\Default\Cache\*"
        }
        'All' {
            $cacheDir = "C:\Users\$userID\AppData\Local\Google\Chrome\User Data\Default\Cache\*", "C:\Users\$userID\AppData\Local\Microsoft\Edge\User Data\Default\Cache\*"
        }
    }

    foreach ($dir in $cacheDir) {
        $psexecCommand = "psexec.exe \\$computerName -u $userID -p password cmd.exe /c `"`"del /s /q /f $dir`"`""  # Changed $computer to $computerName
        Write-Host "Starting PsExec to clear browser cache on $computerName"  # Changed $computer to $computerName
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c $psexecCommand" -Wait
    }

    Write-Host "PsExec command completed for $computerName"  # Changed $computer to $computerName
}