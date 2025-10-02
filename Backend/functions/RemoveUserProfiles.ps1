param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName,

    [Parameter(Mandatory=$true)]
    [string[]]$UserIDs
)

try {
    # Remove selected user profiles from the remote computer
    $result = Invoke-Command -ComputerName $ComputerName -ErrorAction Stop -ScriptBlock {
        param($UserIDsToDelete)

        try {
            # Get profiles that match the criteria and selected user IDs
            $profiles = Get-CimInstance -ClassName Win32_UserProfile | Where-Object {
                $_.LocalPath -ne $null -and
                -not($_.Loaded) -and
                -not($_.Special) -and
                ($_.LocalPath.Substring(9).Length -eq 5) -and
                ($_.LocalPath.Substring(9) -in $UserIDsToDelete)
            }

            if (-not $profiles) {
                return @{
                    Success = $false
                    Message = "No matching profiles found for deletion"
                    ProfilesProcessed = 0
                    ProfilesDeleted = 0
                    Errors = @()
                    ComputerName = $env:COMPUTERNAME
                }
            }

            $deletedCount = 0
            $errors = @()
            $processedProfiles = @()

            # Process each profile
            foreach ($profile in $profiles) {
                try {
                    $userID = $profile.LocalPath.Substring(9)
                    $localPath = $profile.LocalPath

                    # Attempt to delete the profile
                    Remove-CimInstance -InputObject $profile -ErrorAction Stop

                    $processedProfiles += @{
                        UserID = $userID
                        LocalPath = $localPath
                        Status = "Deleted Successfully"
                    }
                    $deletedCount++
                }
                catch {
                    $userID = $profile.LocalPath.Substring(9)
                    $errorMsg = $_.Exception.Message

                    $processedProfiles += @{
                        UserID = $userID
                        LocalPath = $profile.LocalPath
                        Status = "Failed: $errorMsg"
                    }
                    $errors += "Failed to delete profile for user $userID`: $errorMsg"
                }
            }

            return @{
                Success = $deletedCount -gt 0
                Message = if ($deletedCount -gt 0) {
                    "Successfully deleted $deletedCount profile(s). $(if ($errors.Count -gt 0) { "$($errors.Count) error(s) occurred." } else { "" })"
                } else {
                    "No profiles were deleted successfully."
                }
                ProfilesProcessed = $profiles.Count
                ProfilesDeleted = $deletedCount
                ProfilesDetails = $processedProfiles
                Errors = $errors
                ComputerName = $env:COMPUTERNAME
            }
        }
        catch {
            return @{
                Success = $false
                Message = "Error during profile deletion: $($_.Exception.Message)"
                ProfilesProcessed = 0
                ProfilesDeleted = 0
                ProfilesDetails = @()
                Errors = @($_.Exception.Message)
                ComputerName = $env:COMPUTERNAME
            }
        }
    } -ArgumentList @(,$UserIDs)

    # Convert result to JSON and output
    $result | ConvertTo-Json -Depth 10 -Compress
}
catch {
    # Return error as JSON
    @{
        Success = $false
        Message = "Error connecting to computer $ComputerName`: $($_.Exception.Message)"
        ProfilesProcessed = 0
        ProfilesDeleted = 0
        ProfilesDetails = @()
        Errors = @($_.Exception.Message)
        ComputerName = $ComputerName
    } | ConvertTo-Json -Compress
}