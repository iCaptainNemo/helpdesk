# How to Add New Features to Helpdesk Jarvis

This guide explains the complete workflow for adding new features like computer control buttons to the Helpdesk Jarvis application.

## Architecture Overview

The application follows a layered architecture:
1. **PowerShell Scripts** (`Backend/functions/`) - Execute remote system commands
2. **Backend Routes** (`Backend/routes/`) - Handle API requests and responses
3. **Action Logging** (`Backend/routes/actions.js`) - Log admin activities
4. **Frontend Components** (`frontend/src/components/`) - User interface and interactions

## Complete Workflow: Adding a "Restart Print Spooler" Button

### Step 1: Create PowerShell Script (`Backend/functions/`)

Create a PowerShell script that follows the established pattern:

**File**: `Backend/functions/RestartPrintSpooler.ps1`

```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$ComputerName
)

try {
    # Restart the Print Spooler service on the remote computer
    Restart-Service -Name "Spooler" -ComputerName $ComputerName -Force -ErrorAction Stop

    # Return success as JSON
    @{
        Success = $true
        Message = "Print Spooler service restarted on $ComputerName successfully"
        ComputerName = $ComputerName
        ServiceName = "Spooler"
        Action = "Restart"
    } | ConvertTo-Json -Compress
}
catch {
    # Return error as JSON
    @{
        Success = $false
        Message = "Error restarting Print Spooler on $ComputerName`: $($_.Exception.Message)"
        ComputerName = $ComputerName
        ServiceName = "Spooler"
        Action = "Restart"
    } | ConvertTo-Json -Compress
}
```

**Key Requirements:**
- Use `param()` block for parameters
- Always return JSON with `Success`, `Message`, and relevant data
- Use `ConvertTo-Json -Compress` for output
- Implement proper error handling with try/catch

### Step 2: Update Frontend Component

**File**: `frontend/src/components/ComputerStatusTable.js`

#### A. Add Loading State
```javascript
const [loading, setLoading] = useState({
  restart: false,
  gpupdate: false,
  printSpooler: false,  // Add new loading state
  graphicsRestart: false,
  profileRemoval: false
});
```

#### B. Create Handler Function
```javascript
const handlePrintSpoolerRestart = async () => {
  setLoading(prev => ({ ...prev, printSpooler: true }));
  try {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token found');

    // Execute PowerShell script via generic endpoint
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        scriptName: 'RestartPrintSpooler',
        params: { ComputerName: adObjectID }
      }),
    });

    if (!response.ok) throw new Error('Network response was not ok');

    const result = await response.json();
    alert(`Print Spooler service restarted on ${adObjectID}`);

    // Log action to actions endpoint
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/actions/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          activity: `Restarted Print Spooler service on computer: ${adObjectID}`,
          target: adObjectID,
          action_type: 'restart_print_spooler',
          details: { computerName: adObjectID, scriptResult: result },
          result: 'success'
        }),
      });
    } catch (logError) {
      console.error('Error logging print spooler restart action:', logError);
    }

  } catch (error) {
    console.error('Error restarting print spooler:', error);
    alert(`Failed to restart Print Spooler on ${adObjectID}: ${error.message}`);
  } finally {
    setLoading(prev => ({ ...prev, printSpooler: false }));
  }
};
```

#### C. Add Button to UI
```javascript
<button
  className={`control-button spooler-button ${loading.printSpooler ? 'loading' : ''}`}
  onClick={handlePrintSpoolerRestart}
  disabled={loading.printSpooler}
>
  {loading.printSpooler ? 'Restarting...' : '🖨️ Restart Print Spooler'}
</button>
```

### Step 3: No Backend Route Changes Needed

The application uses generic endpoints:
- **`/api/execute-script`** - Executes any PowerShell script via `Backend/powershell.js`
- **`/api/actions/log`** - Logs admin actions via `Backend/routes/actions.js`

These routes handle all script execution and logging automatically.

## Key Architecture Patterns

### 1. PowerShell Script Execution Flow
```
Frontend → /api/execute-script → Backend/powershell.js → PowerShell Script → JSON Response
```

### 2. Action Logging Flow
```
Frontend → /api/actions/log → Backend/routes/actions.js → Database (RecentActions table)
```

### 3. Generic Script Parameters
- Scripts receive parameters as an object: `{ ComputerName: "PC-NAME" }`
- Backend converts to PowerShell args: `-ComputerName PC-NAME`
- All scripts must return JSON with `Success` and `Message` properties

### 4. Error Handling Pattern
- Frontend shows user-friendly alerts
- Backend logs errors via logger
- Action logging is separate and non-blocking
- Failed actions don't prevent UI functionality

## Testing Checklist

1. **PowerShell Script**: Test script directly in PowerShell console
2. **Backend Integration**: Verify script execution via `/api/execute-script`
3. **Frontend Integration**: Test button click and loading states
4. **Action Logging**: Verify actions appear in recent actions
5. **Error Handling**: Test with invalid computer names

## Database Schema

Actions are logged to the `RecentActions` table:
```sql
CREATE TABLE RecentActions (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    adminID TEXT NOT NULL,
    activity TEXT NOT NULL,
    target TEXT,
    action_type TEXT,
    details TEXT,
    result TEXT
);
```

## Security Considerations

1. **Authentication**: All endpoints require JWT token
2. **Authorization**: Verify user has `execute_script` permission
3. **Input Validation**: PowerShell parameters are sanitized
4. **Audit Trail**: All actions are logged with admin ID and timestamp

## Future Feature Examples

Following this pattern, you can easily add:
- **Restart Windows Update Service**: `RestartWindowsUpdate.ps1`
- **Clear DNS Cache**: `ClearDNSCache.ps1`
- **Reset Network Adapters**: `ResetNetworkAdapters.ps1`
- **Install Software**: `InstallSoftware.ps1`

Each follows the same workflow: PowerShell script → Frontend handler → Action logging.

## Troubleshooting

### Common Issues
1. **Script not found**: Ensure `.ps1` file is in `Backend/functions/`
2. **Permission denied**: Verify PowerShell execution policy allows scripts
3. **Network timeouts**: Check remote computer accessibility
4. **Action logging fails**: Verify token authentication for `/api/actions/log`

### Debug Commands
```bash
# Test PowerShell script directly
powershell.exe -File "Backend/functions/RestartPrintSpooler.ps1" -ComputerName "TARGET-PC"

# Check backend logs
npm run dev:backend

# Monitor network requests
# Use browser DevTools Network tab
```

This architecture ensures scalability, maintainability, and consistent behavior across all computer control features.