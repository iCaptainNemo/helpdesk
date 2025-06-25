do {
    Clear-Host
    
    # Prompt for inputs with validation
    do {
        $computerName = Read-Host "Enter the remote computer name"
    } while ([string]::IsNullOrWhiteSpace($computerName))

    do {
        $userID = Read-Host "Enter the user ID"
        $userID = $userID.ToUpper()
    } while ([string]::IsNullOrWhiteSpace($userID))

    # Test computer connectivity first
    Write-Progress -Activity "Remote Operation" -Status "Testing connection to $computerName" -PercentComplete 10
    if (-not (Test-Connection -ComputerName $computerName -Count 1 -Quiet)) {
        Write-Progress -Activity "Remote Operation" -Status "Connection Failed" -PercentComplete 100 -Completed
        Write-Host "Cannot connect to computer: $computerName" -ForegroundColor Red
        Write-Host "`nPress Enter to try again or 'Q' to quit..."
        if ((Read-Host) -eq 'Q') { break }
        continue
    }

    try {
        Write-Progress -Activity "Remote Operation" -Status "Connecting to remote computer" -PercentComplete 25
        $result = Invoke-Command -ComputerName $computerName -ScriptBlock {
            param($userID)
            
            $path = "C:\Users\$userID\AppData\Local\Google\Chrome\User Data"
            
            if (Test-Path $path) {
                try {
                    # Get total size for progress calculation
                    $total = (Get-ChildItem $path -Recurse | Measure-Object -Property Length -Sum).Sum
                    $deleted = 0
                    
                    Get-ChildItem $path -Recurse | ForEach-Object {
                        $deleted += $_.Length
                        $percentComplete = ($deleted / $total) * 100
                        Write-Progress -Id 1 -Activity "Deleting Files" -Status "Removing $($_.Name)" -PercentComplete $percentComplete
                        Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
                    }
                    
                    Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
                    Start-Sleep -Seconds 1
                    
                    @{
                        Success = -not (Test-Path $path)
                        Path = $path
                        Error = $null
                    }
                }
                catch {
                    @{
                        Success = $false
                        Path = $path
                        Error = $_.Exception.Message
                    }
                }
            }
            else {
                @{
                    Success = $false
                    Path = $path
                    Error = "Path does not exist"
                }
            }
        } -ArgumentList $userID -ErrorAction Stop

        Write-Progress -Activity "Remote Operation" -Status "Processing Results" -PercentComplete 90

        # Handle the results
        if ($result.Success) {
            Write-Host "Successfully deleted: $($result.Path)" -ForegroundColor Green
        }
        else {
            if ($result.Error -eq "Path does not exist") {
                Write-Host "The folder does not exist: $($result.Path)" -ForegroundColor Cyan
            }
            else {
                Write-Host "Failed to delete folder: $($result.Error)" -ForegroundColor Red
            }
        }
    }
    catch {
        Write-Host "Error connecting to remote computer: $($_.Exception.Message)" -ForegroundColor Red
    }
    finally {
        Write-Progress -Activity "Remote Operation" -Status "Complete" -PercentComplete 100 -Completed
    }

    Write-Host "`nPress Enter to run again or 'Q' to quit..."
    if ((Read-Host) -eq 'Q') { break }
}
while ($true)