<#
.SYNOPSIS
    Group Policy management functions for Asset Control
.DESCRIPTION
    Provides functions for Group Policy updates, reports, and management
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: Administrative privileges, Group Policy PowerShell module
#>

<#
.SYNOPSIS
    Force Group Policy update on remote computer
.DESCRIPTION
    Triggers an immediate Group Policy refresh on the target computer
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to update Group Policy on
.EXAMPLE
    Update-GroupPolicy -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Uses Invoke-GPUpdate cmdlet if available, falls back to gpupdate command
#>
function Update-GroupPolicy {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Updating Group Policy on computer: $computerName (requested by: $userId)"

    Write-Host "Forcing Group Policy update on '$computerName'..." -ForegroundColor Cyan

    try {
        # Check if GroupPolicy PowerShell module is available
        if (Get-Module -ListAvailable -Name GroupPolicy) {
            Write-Debug "Using GroupPolicy PowerShell module"
            
            # Use PowerShell Group Policy cmdlet
            Write-Host "Executing Invoke-GPUpdate..." -ForegroundColor Yellow
            Start-Process powershell -ArgumentList "-NoExit -Command {Invoke-GPUpdate -Computer $computerName -Force; Read-Host 'Press Enter to close'}" -ErrorAction Stop
            
            Write-Host "Group Policy update initiated via PowerShell cmdlet" -ForegroundColor Green
            Write-Host "A PowerShell window should have opened showing the update progress" -ForegroundColor Cyan
            
        } else {
            Write-Debug "GroupPolicy module not available, using gpupdate command"
            
            # Fallback to direct gpupdate command
            Write-Host "Executing gpupdate via PsExec..." -ForegroundColor Yellow
            
            $gpupdateCommand = "gpupdate /force /target:computer"
            $result = psexec \\$computerName cmd /c $gpupdateCommand 2>&1
            
            if ($result -match "completed successfully" -or $result -match "refresh has completed") {
                Write-Host "Group Policy update completed successfully" -ForegroundColor Green
            } else {
                Write-Host "Group Policy update result: $result" -ForegroundColor Yellow
            }
        }

        # Log the Group Policy update
        if ($script:logFilePath) {
            $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId forced Group Policy update on $computerName"
            Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
        }

    } catch {
        Write-Host "Error updating Group Policy: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception updating Group Policy: $($_.Exception)"
        
        Write-Host "`nTroubleshooting suggestions:" -ForegroundColor Yellow
        Write-Host "- Verify computer is online and accessible" -ForegroundColor Gray
        Write-Host "- Ensure administrative privileges on target computer" -ForegroundColor Gray
        Write-Host "- Check if Group Policy service is running on target" -ForegroundColor Gray
        Write-Host "- Try running gpupdate manually on the target computer" -ForegroundColor Gray
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Generate Group Policy Resultant Set of Policy (RSoP) report
.DESCRIPTION
    Creates a comprehensive HTML report showing applied Group Policy settings
.PARAMETER userId
    The user ID for context (required for consistent interface)
.PARAMETER computerName
    Name of the computer to generate report for
.EXAMPLE
    Get-GroupPolicyResults -userId "jdoe" -computerName "COMPUTER01"
.NOTES
    Uses Get-GPResultantSetOfPolicy cmdlet, saves report to Documents folder
#>
function Get-GroupPolicyResults {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Debug "Generating Group Policy report for computer: $computerName (requested by: $userId)"

    Write-Host "Generating Group Policy Resultant Set of Policy report..." -ForegroundColor Cyan
    Write-Host "Computer: $computerName" -ForegroundColor White
    Write-Host "User Context: $userId" -ForegroundColor White

    try {
        # Generate report filename with timestamp
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $reportFileName = "${userId}-${computerName}_GPReport_${timestamp}.html"
        $reportPath = Join-Path ([Environment]::GetFolderPath("MyDocuments")) $reportFileName
        
        Write-Host "`nGenerating report (this may take a few minutes)..." -ForegroundColor Yellow
        Write-Host "Report will be saved to: $reportPath" -ForegroundColor Cyan

        # Generate the RSoP report
        Write-Debug "Generating RSoP report: User=$userId, Computer=$computerName, Path=$reportPath"
        
        Get-GPResultantSetOfPolicy -User $userId -Computer $computerName -ReportType Html -Path $reportPath -ErrorAction Stop
        
        # Verify report was created
        if (Test-Path $reportPath) {
            Write-Host "`nGroup Policy report generated successfully!" -ForegroundColor Green
            Write-Host "Report location: $reportPath" -ForegroundColor Cyan
            
            # Get file size for user information
            $fileSize = [math]::Round((Get-Item $reportPath).Length / 1KB, 2)
            Write-Host "Report size: $fileSize KB" -ForegroundColor Gray
            
            # Offer to open the report
            $openReport = Read-Host "`nWould you like to open the report now? (y/n)"
            if ($openReport -eq 'y' -or $openReport -eq 'Y') {
                try {
                    Invoke-Item $reportPath
                    Write-Host "Report opened in default browser" -ForegroundColor Green
                } catch {
                    Write-Host "Error opening report: $($_.Exception.Message)" -ForegroundColor Red
                    Write-Host "You can manually open: $reportPath" -ForegroundColor Yellow
                }
            }
            
            # Log the report generation
            if ($script:logFilePath) {
                $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $userId generated GP report for $computerName - $reportPath"
                Add-Content -Path $script:logFilePath -Value $logEntry -ErrorAction SilentlyContinue
            }
            
        } else {
            Write-Host "Report file was not created at expected location" -ForegroundColor Red
        }

    } catch [System.ArgumentException] {
        Write-Host "Error: Invalid user or computer name specified" -ForegroundColor Red
        Write-Host "Please verify that both the user and computer exist in Active Directory" -ForegroundColor Yellow
    } catch [System.UnauthorizedAccessException] {
        Write-Host "Error: Insufficient permissions to generate Group Policy report" -ForegroundColor Red
        Write-Host "You need 'Generate Resultant Set of Policy (Planning)' permissions" -ForegroundColor Yellow
    } catch {
        Write-Host "Error generating Group Policy report: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception generating GP report: $($_.Exception)"
        
        Write-Host "`nTroubleshooting suggestions:" -ForegroundColor Yellow
        Write-Host "- Verify user and computer names are correct" -ForegroundColor Gray
        Write-Host "- Ensure you have RSoP generation permissions" -ForegroundColor Gray
        Write-Host "- Check that both user and computer are in Active Directory" -ForegroundColor Gray
        Write-Host "- Try running as domain administrator" -ForegroundColor Gray
    }

    Read-Host "Press Enter to continue"
}

<#
.SYNOPSIS
    Get Group Policy processing status for computer
.DESCRIPTION
    Checks the status of Group Policy processing and last update times
.PARAMETER computerName
    Name of the computer to check GP status for
.EXAMPLE
    Get-GroupPolicyStatus -computerName "COMPUTER01"
.NOTES
    Queries registry and event logs for Group Policy information
#>
function Get-GroupPolicyStatus {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Host "Checking Group Policy status for '$computerName'..." -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Gray

    try {
        # Check Group Policy service status
        Write-Host "`n1. Group Policy Client Service Status:" -ForegroundColor Yellow
        $gpService = Get-Service -ComputerName $computerName -Name "gpsvc" -ErrorAction Stop
        
        $serviceColor = if ($gpService.Status -eq "Running") { "Green" } else { "Red" }
        Write-Host "   Status: $($gpService.Status)" -ForegroundColor $serviceColor
        Write-Host "   Start Type: $($gpService.StartType)" -ForegroundColor White

        # Get last Group Policy processing time from registry
        Write-Host "`n2. Last Group Policy Processing:" -ForegroundColor Yellow
        try {
            $regPath = "SOFTWARE\Microsoft\Windows\CurrentVersion\Group Policy\State\Machine"
            $reg = [Microsoft.Win32.RegistryKey]::OpenRemoteBaseKey('LocalMachine', $computerName)
            $gpKey = $reg.OpenSubKey($regPath)
            
            if ($gpKey) {
                $lastProcessed = $gpKey.GetValue("LastGPOProcessingTime")
                if ($lastProcessed) {
                    $processTime = [DateTime]::FromFileTime($lastProcessed)
                    $timeAgo = (Get-Date) - $processTime
                    
                    Write-Host "   Last Processed: $($processTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
                    Write-Host "   Time Since: $($timeAgo.Days) days, $($timeAgo.Hours) hours, $($timeAgo.Minutes) minutes" -ForegroundColor Cyan
                    
                    if ($timeAgo.TotalDays -gt 7) {
                        Write-Host "   Status: OLD - Consider forcing GP update" -ForegroundColor Red
                    } elseif ($timeAgo.TotalHours -gt 24) {
                        Write-Host "   Status: STALE - May need update" -ForegroundColor Yellow
                    } else {
                        Write-Host "   Status: CURRENT" -ForegroundColor Green
                    }
                } else {
                    Write-Host "   Last Processed: Unknown" -ForegroundColor Yellow
                }
                
                $gpKey.Close()
            } else {
                Write-Host "   Cannot access Group Policy registry keys" -ForegroundColor Yellow
            }
            
            $reg.Close()
            
        } catch {
            Write-Host "   Error reading registry: $($_.Exception.Message)" -ForegroundColor Red
        }

        # Check for Group Policy event log entries
        Write-Host "`n3. Recent Group Policy Events:" -ForegroundColor Yellow
        try {
            $gpEvents = Get-WinEvent -ComputerName $computerName -FilterHashtable @{
                LogName = 'System'
                ID = 1500, 1501, 1502, 1503  # Group Policy events
                StartTime = (Get-Date).AddDays(-7)
            } -MaxEvents 5 -ErrorAction SilentlyContinue

            if ($gpEvents) {
                foreach ($event in $gpEvents) {
                    $eventColor = switch ($event.Id) {
                        1500 { "Green" }   # GP processing started
                        1501 { "Green" }   # GP processing completed
                        1502 { "Red" }     # GP processing failed
                        1503 { "Yellow" }  # GP processing warning
                        default { "White" }
                    }
                    Write-Host "   [$($event.TimeCreated.ToString('MM/dd HH:mm'))] ID:$($event.Id) - $($event.LevelDisplayName)" -ForegroundColor $eventColor
                }
            } else {
                Write-Host "   No recent Group Policy events found" -ForegroundColor Gray
            }
        } catch {
            Write-Host "   Error reading event log: $($_.Exception.Message)" -ForegroundColor Red
        }

    } catch {
        Write-Host "Error checking Group Policy status: $($_.Exception.Message)" -ForegroundColor Red
        Write-Debug "Exception checking GP status: $($_.Exception)"
    }

    Write-Host "`n" + "=" * 60 -ForegroundColor Gray
    Write-Host "Group Policy status check completed." -ForegroundColor Green
}

<#
.SYNOPSIS
    Test Group Policy connectivity and permissions
.DESCRIPTION
    Tests various aspects of Group Policy functionality and connectivity
.PARAMETER computerName
    Name of the computer to test
.EXAMPLE
    Test-GroupPolicyConnectivity -computerName "COMPUTER01"
.NOTES
    Comprehensive test of GP-related network connectivity and permissions
#>
function Test-GroupPolicyConnectivity {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$computerName
    )

    Write-Host "Testing Group Policy connectivity for '$computerName'..." -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Gray

    try {
        # Test 1: Basic computer connectivity
        Write-Host "`n1. Basic Connectivity Test:" -ForegroundColor Yellow
        if (Test-Connection -ComputerName $computerName -Count 1 -Quiet) {
            Write-Host "   Ping: SUCCESS" -ForegroundColor Green
        } else {
            Write-Host "   Ping: FAILED" -ForegroundColor Red
            return
        }

        # Test 2: Domain Controller connectivity
        Write-Host "`n2. Domain Controller Connectivity:" -ForegroundColor Yellow
        try {
            $domain = (Get-ADDomain).PDCEmulator
            Write-Host "   PDC Emulator: $domain" -ForegroundColor Cyan
            
            if (Test-Connection -ComputerName $domain -Count 1 -Quiet) {
                Write-Host "   DC Connectivity: SUCCESS" -ForegroundColor Green
            } else {
                Write-Host "   DC Connectivity: FAILED" -ForegroundColor Red
            }
        } catch {
            Write-Host "   Error getting domain info: $($_.Exception.Message)" -ForegroundColor Red
        }

        # Test 3: SYSVOL access
        Write-Host "`n3. SYSVOL Share Access:" -ForegroundColor Yellow
        try {
            $sysvol = "\\$((Get-ADDomain).DNSRoot)\SYSVOL"
            if (Test-Path $sysvol) {
                Write-Host "   SYSVOL Access: SUCCESS" -ForegroundColor Green
                Write-Host "   Path: $sysvol" -ForegroundColor Gray
            } else {
                Write-Host "   SYSVOL Access: FAILED" -ForegroundColor Red
            }
        } catch {
            Write-Host "   SYSVOL test error: $($_.Exception.Message)" -ForegroundColor Red
        }

        # Test 4: WMI connectivity (required for GP management)
        Write-Host "`n4. WMI Connectivity Test:" -ForegroundColor Yellow
        try {
            $wmiTest = Get-WmiObject -Class Win32_OperatingSystem -ComputerName $computerName -ErrorAction Stop
            if ($wmiTest) {
                Write-Host "   WMI Access: SUCCESS" -ForegroundColor Green
                Write-Host "   OS: $($wmiTest.Caption)" -ForegroundColor Gray
            }
        } catch {
            Write-Host "   WMI Access: FAILED" -ForegroundColor Red
            Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        }

    } catch {
        Write-Host "Error during connectivity test: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host "`n" + "=" * 60 -ForegroundColor Gray
    Write-Host "Group Policy connectivity test completed." -ForegroundColor Green
}