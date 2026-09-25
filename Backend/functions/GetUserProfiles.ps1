param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName
)

try {
    # Get user profiles from the remote computer
    # Note: no -ErrorAction Stop here. Invoke-Command relays remote non-terminating errors
    # (e.g. a Measure-Object hiccup deep in the loop below) back as local error records, and
    # -ErrorAction Stop would promote those into a terminating exception on this side - which
    # bypasses the try/catch blocks inside the scriptblock entirely and gets misreported below
    # as a connection failure even though the connection was fine.
    $result = Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        try {
            # Get profiles that match the criteria
            $profiles = Get-CimInstance -ClassName Win32_UserProfile | Where-Object {
                $_.LocalPath -ne $null -and
                -not($_.Loaded) -and
                -not($_.Special) -and
                ($_.LocalPath.Substring(9).Length -eq 5)
            }

            if (-not $profiles) {
                return @{
                    Success = $true
                    ProfilesFound = 0
                    Profiles = @()
                    Message = "No profiles available for deletion"
                    ComputerName = $env:COMPUTERNAME
                }
            }

            # Create detailed profile information
            $profileInfo = foreach ($profile in $profiles) {
                try {
                    $localPath = $profile.LocalPath
                    $folderInfo = Get-Item -Path $localPath -ErrorAction SilentlyContinue

                    @{
                        UserID = $profile.LocalPath.Substring(9)
                        LocalPath = $localPath
                        LastModified = if ($folderInfo) { $folderInfo.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss") } else { "Unknown" }
                        LastModifiedRaw = if ($folderInfo) { $folderInfo.LastWriteTime } else { [DateTime]::MinValue }
                        SID = $profile.SID
                        ProfileSize = if ($folderInfo) {
                            # -File matters here: without it, Get-ChildItem -Recurse also returns
                            # DirectoryInfo entries, which have no Length property. A profile whose
                            # subfolders are all empty (no files at all) then pipes zero Length-bearing
                            # objects into Measure-Object, which throws instead of returning $null.
                            $size = (Get-ChildItem -Path $localPath -File -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                            if (-not $size) { $size = 0 }
                            [Math]::Round($size / 1MB, 2)
                        } else { 0 }
                    }
                } catch {
                    # Include profile even if we can't get all details
                    @{
                        UserID = $profile.LocalPath.Substring(9)
                        LocalPath = $profile.LocalPath
                        LastModified = "Error reading details"
                        LastModifiedRaw = [DateTime]::MinValue
                        SID = $profile.SID
                        ProfileSize = 0
                    }
                }
            }

            # Sort profiles by last modified date (oldest first)
            $sortedProfiles = $profileInfo | Sort-Object LastModifiedRaw

            return @{
                Success = $true
                ProfilesFound = $sortedProfiles.Count
                Profiles = $sortedProfiles
                Message = "Found $($sortedProfiles.Count) profiles available for deletion"
                ComputerName = $env:COMPUTERNAME
            }
        }
        catch {
            return @{
                Success = $false
                ProfilesFound = 0
                Profiles = @()
                Message = "Error retrieving profiles: $($_.Exception.Message)"
                ComputerName = $env:COMPUTERNAME
            }
        }
    }

    # Convert result to JSON and output
    $result | ConvertTo-Json -Depth 10 -Compress
}
catch {
    # Return error as JSON
    @{
        Success = $false
        ProfilesFound = 0
        Profiles = @()
        Message = "Error connecting to computer $ComputerName`: $($_.Exception.Message)"
        ComputerName = $ComputerName
    } | ConvertTo-Json -Compress
}