# Remote User-Space Task Scheduler Method

## Overview

This document explains the methodology used in Jarvis helpdesk scripts to overcome the **user-space execution limitation** when running administrative tasks remotely. The problem occurs when administrators need to execute commands in a specific user's session on a remote computer, but traditional remote execution methods (like `Invoke-Command`) run in SYSTEM context and cannot affect user-specific settings.

## The Problem: User-Space Execution Limitation

### Traditional Remote Execution Issues:
- **`Invoke-Command`** runs as SYSTEM account - cannot access user desktop, mapped drives, or user registry hive
- **`PsExec` with `-s` flag** runs as SYSTEM - same limitations
- **Administrative credentials** don't guarantee user-space access
- **Cross-network execution** lacks user session context

### Real-World Scenarios:
- Mapping network drives for specific users
- Creating desktop shortcuts on user's desktop
- Sending interactive messages to logged-in users
- Modifying user-specific registry settings
- Accessing user profile directories

## The Solution: Task Scheduler Method

The Jarvis helpdesk system solves this by using **Windows Task Scheduler** to execute commands in the target user's context. This method leverages the fact that scheduled tasks can be configured to run as a specific user account.

### Key Components:
1. **Batch File Creation** - Create executable script with desired actions
2. **Remote File Deployment** - Copy batch file to target user's temp directory
3. **Scheduled Task Creation** - Create task to run as the target user
4. **Task Execution** - Immediately run the task
5. **Cleanup** - Remove both task and files

## Method Analysis: Message.ps1

The `Message.ps1` script demonstrates the **PsExec approach** for user-space execution:

### Key Methodology:

```powershell
# 1. CREATE BATCH FILE LOCALLY
$cmdContent = @"
@echo off
color $colorCode
mode con cols=80
mode con lines=10
cls
echo.
echo =========================================================================
echo   $messageText
echo =========================================================================
echo.
echo Press Enter to close this message.
pause >nul
exit
"@

# 2. DEPLOY TO USER'S TEMP DIRECTORY
$userTempPath = "\\$remotePC\C$\Users\$userName\AppData\Local\Temp"
$remoteCmdFile = "$userTempPath\MessageBox.cmd"
Copy-Item -Path $tempCmdFile -Destination $remoteCmdFile -Force

# 3. EXECUTE VIA PSEXEC IN USER CONTEXT
$psexecArgs = @(
    "\\$remotePC",
    "-h",           # Run with elevated token
    "-i",           # Interactive (allows GUI display)
    "-s",           # Run as SYSTEM (but launches in user session)
    "cmd",
    "/c",
    "start",        # Launch in user's desktop context
    "C:\Users\$userName\AppData\Local\Temp\MessageBox.cmd"
)

$result = Start-Process "psexec.exe" -ArgumentList $psexecArgs -Wait -NoNewWindow -PassThru
```

### Message.ps1 Limitations:
- Requires PsExec.exe to be available
- Still runs as SYSTEM but uses `start` command to launch in user session
- Limited to simple display tasks

## Method Analysis: Map-NetworkDriveRemote.ps1

The `Map-NetworkDriveRemote.ps1` script demonstrates the **full Task Scheduler approach** for true user-space execution:

### Key Methodology:

#### 1. Session Identification and User Discovery
```powershell
# Query active user sessions
$queryOutput = query user /server:$remotePC 2>&1 | Out-String

# Extract username from specific session ID
function Get-UserNameFromSession {
    param([string]$remotePC, [string]$sessionId)
    $queryOutput = query user /server:$remotePC 2>&1 | Out-String
    $lines = $queryOutput -split "`n"
    foreach ($line in $lines) {
        if ($line -match "^\s*(\S+)\s+\S+\s+$sessionId\s+") {
            return $matches[1]
        }
    }
    return $null
}
```

#### 2. Batch File Creation with User Context
```powershell
# Create comprehensive batch file with error handling
$cmdContent = @"
@echo off
setlocal

REM Assign PowerShell-provided values to batch variables
set "REMOTE_PC=$batchSafe_remotePC"
set "USER_NAME=$batchSafe_userName"
set "DRIVE_LETTER=$batchSafe_driveLetter"
set "SHARE_PATH=$batchSafe_sharePath"
set "SHARE_NAME=$batchSafe_shareName"

REM Check if already mapped to this drive letter
net use %DRIVE_LETTER%: >nul 2>&1
if %errorlevel% equ 0 (
    color 4f
    echo ERROR - Drive letter %DRIVE_LETTER%: is already in use
    timeout /t 10 /nobreak >nul
    exit /b 1
)

REM Map the drive with persistence
net use %DRIVE_LETTER%: "%SHARE_PATH%" /persistent:yes
set MAPPING_RESULT=%errorlevel%

REM Set drive label if successful
if %MAPPING_RESULT% equ 0 (
    label %DRIVE_LETTER%: "%SHARE_NAME%" >nul 2>&1
)

exit /b %MAPPING_RESULT%
"@
```

#### 3. Remote File Deployment
```powershell
# Deploy to user's temp directory via administrative share
$tempCmdFile = "$env:TEMP\MapDrive_$driveLetter.cmd"
$remoteUserTempAdminPath = "\\$remotePC\C$\Users\$userName\AppData\Local\Temp"
$remoteCmdFileName = "MapDrive_$(Get-Random -Maximum 99999)_$driveLetter.cmd"
$remoteCmdFileForCopy = Join-Path -Path $remoteUserTempAdminPath -ChildPath $remoteCmdFileName
$remoteCmdFileForExecution = "C:\Users\$userName\AppData\Local\Temp\$remoteCmdFileName"

# Create and copy file
$cmdContent | Out-File -FilePath $tempCmdFile -Encoding ASCII -Force
Copy-Item -Path $tempCmdFile -Destination $remoteCmdFileForCopy -Force
```

#### 4. Task Scheduler Creation and Execution
```powershell
# Create unique task name
$taskName = "TempMapDrive_$(Get-Random -Maximum 99999)_${driveLetter}_${userName}"

# Define remote script block for task management
$scriptBlockContent = {
    param($taskNameParam, $taskCommandParam, $taskRunAsUserParam)
    $schtasksPath = "schtasks.exe"
    $startTime = (Get-Date).AddMinutes(1).ToString("HH:mm")
    
    try {
        # CREATE SCHEDULED TASK
        $createArgs = "/create /tn ""$taskNameParam"" /tr ""$taskCommandParam"" /sc ONCE /st $startTime /ru ""$taskRunAsUserParam"" /f /it /rl LIMITED"
        $createProcess = Start-Process -FilePath $schtasksPath -ArgumentList $createArgs -Wait -PassThru -NoNewWindow
        
        if ($createProcess.ExitCode -ne 0) {
            Write-Warning "Failed to create scheduled task. Exit code: $($createProcess.ExitCode)"
            return
        }
        
        # RUN TASK IMMEDIATELY
        $runArgs = "/run /tn ""$taskNameParam"""
        $runProcess = Start-Process -FilePath $schtasksPath -ArgumentList $runArgs -Wait -PassThru -NoNewWindow
        
        if ($runProcess.ExitCode -ne 0) {
            Write-Warning "Failed to run scheduled task. Exit code: $($runProcess.ExitCode)"
        } else {
            # Wait for task execution
            Start-Sleep -Seconds 15 
        }
    }
    catch {
        Write-Warning "Error during scheduled task operations: $($_.Exception.Message)"
    }
    finally {
        # CLEANUP TASK
        $deleteArgs = "/delete /tn ""$taskNameParam"" /f"
        Start-Process -FilePath $schtasksPath -ArgumentList $deleteArgs -Wait -NoNewWindow
    }
}

# Execute on remote computer
Invoke-Command -ComputerName $remotePC -ScriptBlock $scriptBlockContent -ArgumentList $taskName, $remoteCmdFileForExecution, $userName
```

### Task Scheduler Parameters Explained:

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `/create` | Create new scheduled task | - |
| `/tn "TaskName"` | Task name (must be unique) | `"TempMapDrive_12345_Z_jdoe"` |
| `/tr "Command"` | Task command to execute | `"C:\Users\jdoe\AppData\Local\Temp\MapDrive.cmd"` |
| `/sc ONCE` | Schedule type (run once) | - |
| `/st HH:MM` | Start time (1 minute from now) | `/st 14:30` |
| `/ru "User"` | Run as specific user | `/ru "DOMAIN\jdoe"` |
| `/f` | Force creation (overwrite existing) | - |
| `/it` | Interactive task (can show UI) | - |
| `/rl LIMITED` | Run with limited privileges | - |

## Step-by-Step Implementation Guide

### Phase 1: Preparation and Validation

#### 1.1 Identify Target User Session
```powershell
# Query active sessions on remote computer
$queryOutput = query user /server:$remotePC 2>&1 | Out-String

# Parse session information to extract usernames
function Get-UserNameFromSession {
    param([string]$remotePC, [string]$sessionId)
    $queryOutput = query user /server:$remotePC 2>&1 | Out-String
    $lines = $queryOutput -split "`n"
    foreach ($line in $lines) {
        if ($line -match "^\s*(\S+)\s+\S+\s+$sessionId\s+") {
            return $matches[1]
        }
    }
    return $null
}

# Usage
$selectedSession = Read-Host "Enter session ID"
$userName = Get-UserNameFromSession -remotePC $remotePC -sessionId $selectedSession
```

#### 1.2 Validate Remote Computer Accessibility
```powershell
# Test remote computer connectivity
if (-not (Test-Connection -ComputerName $remotePC -Count 1 -Quiet)) {
    Write-Error "Cannot reach remote computer: $remotePC"
    exit 1
}

# Test administrative share access
$testPath = "\\$remotePC\C$\Users\$userName\AppData\Local\Temp"
if (-not (Test-Path $testPath)) {
    Write-Error "Cannot access user temp directory: $testPath"
    exit 1
}
```

### Phase 2: Script Creation and Deployment

#### 2.1 Create Executable Script (Batch File)
```powershell
# Design batch file with proper error handling and user feedback
$cmdContent = @"
@echo off
setlocal

REM === CONFIGURATION SECTION ===
set "TARGET_USER=$userName"
set "OPERATION_TYPE=YourOperation"

REM === VISUAL FEEDBACK ===
color 0f
mode con cols=80 lines=25
cls
echo.
echo =========================================================================
echo   YOUR OPERATION NAME
echo =========================================================================
echo   Computer: %COMPUTERNAME%
echo   User: %TARGET_USER%
echo   Operation: %OPERATION_TYPE%
echo =========================================================================

REM === MAIN OPERATION ===
REM Your actual commands here
REM Example: net use Z: \\server\share /persistent:yes

REM === ERROR HANDLING ===
set OPERATION_RESULT=%errorlevel%
if %OPERATION_RESULT% equ 0 (
    color 2f
    echo SUCCESS - Operation completed successfully
) else (
    color 4f
    echo ERROR - Operation failed with code %OPERATION_RESULT%
)

REM === CLEANUP AND EXIT ===
echo This window will close in 5 seconds...
timeout /t 5 /nobreak >nul
exit /b %OPERATION_RESULT%
"@
```

#### 2.2 Deploy Script to Remote Location
```powershell
# Generate unique file names to avoid conflicts
$localTempFile = "$env:TEMP\Operation_$(Get-Random -Maximum 99999).cmd"
$remoteUserTemp = "\\$remotePC\C$\Users\$userName\AppData\Local\Temp"
$remoteCmdFileName = "Operation_$(Get-Random -Maximum 99999).cmd"
$remoteCmdFilePath = Join-Path -Path $remoteUserTemp -ChildPath $remoteCmdFileName

# Create local file and copy to remote
$cmdContent | Out-File -FilePath $localTempFile -Encoding ASCII -Force
Copy-Item -Path $localTempFile -Destination $remoteCmdFilePath -Force

# Store paths for cleanup
$remoteExecutionPath = "C:\Users\$userName\AppData\Local\Temp\$remoteCmdFileName"
```

### Phase 3: Task Scheduler Implementation

#### 3.1 Create and Configure Scheduled Task
```powershell
# Generate unique task name to avoid conflicts
$taskName = "TempOperation_$(Get-Random -Maximum 99999)_${userName}_$(Get-Date -Format 'HHmmss')"

# Define task creation parameters
$taskCommand = $remoteExecutionPath
$runAsUser = $userName  # Can be DOMAIN\username if needed
$startTime = (Get-Date).AddMinutes(1).ToString("HH:mm")

# Create task using schtasks command
$createArgs = @(
    "/create",
    "/tn", "`"$taskName`"",
    "/tr", "`"$taskCommand`"",
    "/sc", "ONCE",
    "/st", $startTime,
    "/ru", "`"$runAsUser`"",
    "/f",              # Force overwrite existing task
    "/it",             # Allow interactive execution
    "/rl", "LIMITED"   # Run with limited privileges
)
```

#### 3.2 Execute Task Remotely
```powershell
$scriptBlockContent = {
    param($taskNameParam, $taskCommandParam, $taskRunAsUserParam)
    
    $schtasksPath = "schtasks.exe"
    $startTime = (Get-Date).AddMinutes(1).ToString("HH:mm")
    
    try {
        # CREATE TASK
        Write-Host "Creating scheduled task: $taskNameParam"
        $createArgs = "/create /tn `"$taskNameParam`" /tr `"$taskCommandParam`" /sc ONCE /st $startTime /ru `"$taskRunAsUserParam`" /f /it /rl LIMITED"
        $createResult = Start-Process -FilePath $schtasksPath -ArgumentList $createArgs -Wait -PassThru -NoNewWindow
        
        if ($createResult.ExitCode -ne 0) {
            throw "Failed to create task. Exit code: $($createResult.ExitCode)"
        }
        
        # RUN TASK
        Write-Host "Running scheduled task: $taskNameParam"
        $runArgs = "/run /tn `"$taskNameParam`""
        $runResult = Start-Process -FilePath $schtasksPath -ArgumentList $runArgs -Wait -PassThru -NoNewWindow
        
        if ($runResult.ExitCode -ne 0) {
            Write-Warning "Task run command failed. Exit code: $($runResult.ExitCode)"
        }
        
        # WAIT FOR EXECUTION
        Write-Host "Waiting for task execution..."
        Start-Sleep -Seconds 15
        
        # CHECK TASK STATUS (Optional)
        $queryArgs = "/query /tn `"$taskNameParam`" /fo LIST"
        $queryResult = Start-Process -FilePath $schtasksPath -ArgumentList $queryArgs -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\taskquery.txt"
        
        if (Test-Path "$env:TEMP\taskquery.txt") {
            $taskInfo = Get-Content "$env:TEMP\taskquery.txt"
            Write-Host "Task Status Information:"
            $taskInfo | ForEach-Object { Write-Host "  $_" }
            Remove-Item "$env:TEMP\taskquery.txt" -Force -ErrorAction SilentlyContinue
        }
        
        return $true
    }
    catch {
        Write-Error "Task execution failed: $($_.Exception.Message)"
        return $false
    }
    finally {
        # CLEANUP TASK
        Write-Host "Cleaning up scheduled task: $taskNameParam"
        $deleteArgs = "/delete /tn `"$taskNameParam`" /f"
        Start-Process -FilePath $schtasksPath -ArgumentList $deleteArgs -Wait -NoNewWindow -ErrorAction SilentlyContinue
    }
}

# Execute the script block on remote computer
$taskSuccess = Invoke-Command -ComputerName $remotePC -ScriptBlock $scriptBlockContent -ArgumentList $taskName, $remoteExecutionPath, $userName
```

### Phase 4: Cleanup and Error Handling

#### 4.1 File Cleanup
```powershell
try {
    # Remove local temporary file
    if (Test-Path $localTempFile) {
        Remove-Item $localTempFile -Force
    }
    
    # Remove remote temporary file
    if (Test-Path $remoteCmdFilePath) {
        Remove-Item $remoteCmdFilePath -Force
    }
    
    Write-Host "Cleanup completed successfully."
}
catch {
    Write-Warning "Cleanup failed: $($_.Exception.Message)"
}
```

#### 4.2 Comprehensive Error Handling
```powershell
function Invoke-RemoteUserSpaceTask {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$RemoteComputer,
        
        [Parameter(Mandatory=$true)]
        [string]$Username,
        
        [Parameter(Mandatory=$true)]
        [string]$BatchContent,
        
        [Parameter(Mandatory=$false)]
        [int]$WaitSeconds = 15
    )
    
    $localTempFile = $null
    $remoteTempFile = $null
    $taskName = $null
    
    try {
        # Validate inputs
        if (-not (Test-Connection -ComputerName $RemoteComputer -Count 1 -Quiet)) {
            throw "Cannot reach remote computer: $RemoteComputer"
        }
        
        # Create temporary files
        $localTempFile = "$env:TEMP\RemoteTask_$(Get-Random).cmd"
        $remoteTempPath = "\\$RemoteComputer\C$\Users\$Username\AppData\Local\Temp"
        $remoteTempFileName = "RemoteTask_$(Get-Random).cmd"
        $remoteTempFile = Join-Path $remoteTempPath $remoteTempFileName
        $remoteExecutionPath = "C:\Users\$Username\AppData\Local\Temp\$remoteTempFileName"
        
        # Deploy batch file
        $BatchContent | Out-File -FilePath $localTempFile -Encoding ASCII -Force
        Copy-Item -Path $localTempFile -Destination $remoteTempFile -Force
        
        # Create and run task
        $taskName = "RemoteUserTask_$(Get-Random)_$Username"
        
        $success = Invoke-Command -ComputerName $RemoteComputer -ScriptBlock {
            param($TaskName, $Command, $User, $Wait)
            
            try {
                $startTime = (Get-Date).AddMinutes(1).ToString("HH:mm")
                $createArgs = "/create /tn `"$TaskName`" /tr `"$Command`" /sc ONCE /st $startTime /ru `"$User`" /f /it /rl LIMITED"
                $createResult = Start-Process -FilePath "schtasks.exe" -ArgumentList $createArgs -Wait -PassThru -NoNewWindow
                
                if ($createResult.ExitCode -ne 0) { return $false }
                
                $runArgs = "/run /tn `"$TaskName`""
                $runResult = Start-Process -FilePath "schtasks.exe" -ArgumentList $runArgs -Wait -PassThru -NoNewWindow
                
                Start-Sleep -Seconds $Wait
                
                return $runResult.ExitCode -eq 0
            }
            catch {
                return $false
            }
            finally {
                $deleteArgs = "/delete /tn `"$TaskName`" /f"
                Start-Process -FilePath "schtasks.exe" -ArgumentList $deleteArgs -Wait -NoNewWindow -ErrorAction SilentlyContinue
            }
        } -ArgumentList $taskName, $remoteExecutionPath, $Username, $WaitSeconds
        
        return $success
    }
    catch {
        Write-Error "Remote user-space task failed: $($_.Exception.Message)"
        return $false
    }
    finally {
        # Cleanup
        if ($localTempFile -and (Test-Path $localTempFile)) {
            Remove-Item $localTempFile -Force -ErrorAction SilentlyContinue
        }
        if ($remoteTempFile -and (Test-Path $remoteTempFile)) {
            Remove-Item $remoteTempFile -Force -ErrorAction SilentlyContinue
        }
    }
}
```

## Best Practices and Guidelines

### Security Considerations
1. **Unique File Names**: Always use `Get-Random` to generate unique file names
2. **Temporary Storage**: Store files in user's temp directory, not system locations
3. **Immediate Cleanup**: Remove tasks and files immediately after execution
4. **Limited Privileges**: Use `/rl LIMITED` to run tasks with minimal privileges
5. **Input Validation**: Always validate and sanitize user inputs before creating batch files

### Performance Optimization
1. **Batch Operations**: Combine multiple operations into single batch file when possible
2. **Timeout Management**: Use appropriate wait times (10-30 seconds typical)
3. **Error Detection**: Monitor task exit codes for success/failure determination
4. **Resource Cleanup**: Always clean up resources in finally blocks

### Reliability Enhancements
1. **Connection Testing**: Verify remote computer accessibility before proceeding
2. **Path Validation**: Confirm target directories exist and are accessible
3. **Task Name Uniqueness**: Include timestamps and random numbers in task names
4. **Retry Logic**: Implement retry mechanisms for transient failures
5. **Logging**: Include detailed logging for troubleshooting

### Common Pitfalls to Avoid
1. **Hardcoded Paths**: Always use dynamic path construction
2. **Special Characters**: Properly escape batch file variables and PowerShell strings
3. **Permission Issues**: Ensure administrative access to target computer
4. **Task Persistence**: Never leave temporary scheduled tasks behind
5. **File Locks**: Handle cases where files might be in use

## Alternative Methods Comparison

| Method | User Context | GUI Access | Persistence | Complexity | Use Case |
|--------|--------------|------------|-------------|------------|----------|
| **Task Scheduler** | ✅ Full | ✅ Yes | ❌ Temporary | 🔶 Medium | User-specific operations |
| **PsExec + start** | 🔶 Partial | ✅ Yes | ❌ None | 🟢 Low | Simple GUI displays |
| **Invoke-Command** | ❌ SYSTEM only | ❌ No | ❌ None | 🟢 Low | System-level tasks |
| **WinRM + RunAs** | 🔶 Partial | 🔶 Limited | ❌ None | 🔶 Medium | Service operations |

## Troubleshooting Guide

### Common Issues and Solutions:

#### Issue: "Task creation failed with exit code 1"
**Cause**: Invalid task parameters or insufficient permissions  
**Solution**: 
- Verify user account format (use DOMAIN\username if domain-joined)
- Ensure administrative privileges on target computer
- Check if task name contains invalid characters

#### Issue: "Cannot access remote temp directory"
**Cause**: Network permissions or path issues  
**Solution**:
- Verify administrative share access (`\\computer\C$`)
- Check if user directory exists
- Ensure no file locks on temp directory

#### Issue: "Task runs but operation fails"
**Cause**: User context or permission problems in batch file  
**Solution**:
- Add detailed error logging to batch file
- Test batch file locally first
- Verify user has necessary permissions for operation

#### Issue: "Task appears to hang or timeout"
**Cause**: Interactive prompts or long-running operations  
**Solution**:
- Ensure batch file has no interactive prompts
- Increase wait timeout for long operations
- Add progress indicators to batch file

## Conclusion

The Task Scheduler method provides a robust solution for executing user-space operations remotely. By creating temporary scheduled tasks that run in the target user's context, administrators can perform operations that traditional remote execution methods cannot accomplish.

This methodology is particularly valuable for:
- Network drive mapping for specific users
- Desktop shortcut creation
- User-specific registry modifications  
- Interactive message display
- User profile operations

When implemented correctly with proper error handling and cleanup procedures, this method provides reliable remote user-space execution capabilities for helpdesk automation systems.