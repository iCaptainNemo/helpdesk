$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf
# Allow script execution silently
Function Set-ExecutionPolicy {
    $currentPolicy = Get-ExecutionPolicy
    if ($currentPolicy -ne "Unrestricted" -and $currentPolicy -ne "RemoteSigned") {
        Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force -ErrorAction SilentlyContinue
    }
}

# Call the function to set execution policy
# Set-ExecutionPolicy

$Global:ProgressPreference = 'SilentlyContinue'

Function Get-PCName {
    $PC = ''
    While ($true) {
        $PC = Read-Host "Enter full name of PC that you would like to remove profiles from"
        Write-Host "Attempting to ping machine..." -ForegroundColor Green
        if (-not (Test-NetConnection -ComputerName $PC -InformationLevel Quiet)) {
            Write-Host "Unable to ping machine. Confirm it is on and try again, or try a different PC.`n" -ForegroundColor Yellow
            continue
        }
        Write-Host "Able to ping, continuing." -ForegroundColor Green
        break
    }
    return $PC
}

Function Remote-Remove {
    param (
        [string]$PC_Name
    )

    Invoke-Command -ComputerName $PC_Name -ScriptBlock {
        try {
            $profiles = Get-CimInstance -ClassName Win32_UserProfile | Where-Object {
                $_.LocalPath -ne $null -and
                -not($_.Loaded) -and
                -not($_.Special) -and
                ($_.LocalPath.Substring(9).Length -eq 5)
            }

            if (-not $profiles) {
                Write-Host "No profiles to delete, returning to start of script.`n" -ForegroundColor Red
                return -1
            }

            # Create a list of profiles with last modified dates
            $profileInfo = foreach ($profile in $profiles) {
                $localPath = $profile.LocalPath
                $folderInfo = Get-Item -Path $localPath
                [PSCustomObject]@{
                    UserID        = $profile.LocalPath.Substring(9)
                    LastModified  = $folderInfo.LastWriteTime
                }
            }

            # Order profiles by LastModified date
            $orderedProfiles = $profileInfo | Sort-Object LastModified

            Write-Host "These are the current profiles on the PC, ordered by last modification date:"
            foreach ($profile in $orderedProfiles) {
                Write-Host "$($profile.UserID) - Last Modified: $($profile.LastModified)" -ForegroundColor Yellow
            }

            $e_str = Read-Host "`nEnter the employee IDs you want to delete (space-separated):"
            $selectedIDs = $e_str -split '\s+'

            $toDelete = $profiles | Where-Object { $_.LocalPath.Substring(9) -in $selectedIDs }
            if (-not $toDelete) {
                Write-Host "No profiles selected for deletion, returning to start of script.`n" -ForegroundColor Red
                return -1
            }

            Write-Host "The following profiles will be deleted:" -ForegroundColor Green
            foreach ($profile in $toDelete) {
                $localPath = $profile.LocalPath
                $folderInfo = Get-Item -Path $localPath
                Write-Host "$($profile.LocalPath.Substring(9)) - Last Modified: $($folderInfo.LastWriteTime)" -ForegroundColor Yellow
            }

            $confirm = Read-Host "Confirm deletion (Y/N)"
            if ($confirm -ieq "n") {
                Write-Host "Canceling deletion, returning to start of script.`n" -ForegroundColor Green
                return -1
            } elseif ($confirm -ine "y") {
                Write-Host "Invalid Input, returning to start of script`n" -ForegroundColor Red
                return -1
            }

            Write-Host "Deleting profiles, please wait..." -ForegroundColor Green
            $toDelete | ForEach-Object { Remove-CimInstance -InputObject $_ }
            Write-Host "Profiles deleted successfully." -ForegroundColor Green
            return 0
        } catch {
            Write-Host "An error occurred: $_" -ForegroundColor Red
            return -1
        }
    }
}

Function Profile-Delete {
    while ($true) {
        $PC = Get-PCName
        $func_success = Remote-Remove -PC_Name $PC
        if ($func_success -ne 0) { continue }
        break
    }
    Write-Host "Process completed." -ForegroundColor Green
    pause
}

Profile-Delete
