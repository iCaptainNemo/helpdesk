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
        $computer
    )

    $browserChoice = Read-Host "Enter the browser to clear (Chrome, Edge, All)"
    switch ($browserChoice) {
        'Chrome' {
            $cacheDir = "C:\Users\$userID\AppData\Local\Google\Chrome\User Data\Default\Cache\*"
        }
        'Edge' {
            $cacheDir = "C:\Users\$userID\AppData\Local\Microsoft\Edge\User Data\Default\Cache\*"
        }
        'All' {
            $cacheDir = "C:\Users\$userID\AppData\Local\Google\Chrome\User Data\Default\Cache\*", "C:\Users\$userID\AppData\Local\Microsoft\Edge\User Data\Default\Cache\*"
        }
        default {
            Write-Host "Invalid choice. Please enter Chrome, Edge, or All."
            return
        }
    }

    foreach ($dir in $cacheDir) {
        $psexecCommand = "psexec.exe \\$computer -u $userID -p password cmd.exe /c `"`"del /s /q /f $dir`"`""
        Write-Host "Starting PsExec to clear browser cache on $computer"
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c $psexecCommand" -Wait
    }

    Write-Host "PsExec command completed for $computer"
}