# Database Integration Guide

## Overview

The Helpdesk GUI WPF application is designed to work with or without a SQLite database. Database features provide enhanced functionality including:

- Application logging and audit trail
- Server status history
- User action tracking
- Persistent configuration storage

## Current Status

The application is currently running **with file-based logging** as a fallback. This provides:

- ✅ Console logging (real-time in application)
- ✅ File-based logging (`database/application.log`)
- ❌ Database features (disabled due to SQLite architecture mismatch)

**Issue**: The current SQLite DLL appears to be 32-bit or for a different .NET version. The application needs both:
1. `System.Data.SQLite.dll` (64-bit, .NET Framework 4.x)
2. `SQLite.Interop.dll` (64-bit, native library)

## PowerShell Version Compatibility

**Important**: This application works best with **Windows PowerShell 5.1**, not PowerShell 7. 

- ✅ **Windows PowerShell 5.1**: Full compatibility, .NET Framework support
- ⚠️ **PowerShell 7**: Limited compatibility, .NET Core (different SQLite requirements)

Use the batch file `Launch-GUI.cmd` or the "Windows PowerShell 5.1" debug configuration in VS Code.

## Database Integration Steps (For Later)

### 1. Download SQLite Library

You need **both** files from the SQLite package:

1. Go to: https://system.data.sqlite.org/index.html/doc/trunk/www/downloads.wiki
2. Download "Precompiled Binaries for 64-bit Windows (.NET Framework 4.0)"
3. Extract **both files** to the `lib/` folder:
   - `System.Data.SQLite.dll` (managed .NET wrapper)
   - `SQLite.Interop.dll` (native SQLite library)
4. Restart the application

**Important**: Both DLLs must match your system architecture (64-bit) and target .NET Framework 4.x.

### 2. Verify SQLite Installation

The application now tests SQLite during startup:
- ✅ **"SQLite assembly loaded and tested successfully"** = Database features enabled
- ❌ **"Failed to load or test SQLite assembly"** = File-based logging only

### 3. Database Creation Behavior

- **Existing database**: Application will use it automatically
- **No database**: Creates new one only if SQLite is working
- **SQLite unavailable**: Uses file-based logging without attempting database creation

### 4. Import Your Existing Database

When you're ready to import your existing database:

1. **Backup your existing database file**
2. Place your existing database file in the `database/` folder as `database.db`
3. Ensure it has the expected schema (see below)
4. Restart the application

### 3. Expected Database Schema

The application expects these tables:

```sql
-- Application logs
CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    user TEXT
);

-- Server monitoring data
CREATE TABLE server_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT NOT NULL,
    status TEXT NOT NULL,
    last_checked TEXT NOT NULL,
    response_time INTEGER
);

-- User action audit trail
CREATE TABLE user_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    target_object TEXT,
    user TEXT NOT NULL,
    result TEXT
);
```

### 4. Database Utility Functions

The application includes database utility functions in `functions/DatabaseUtils.ps1`:

- `Connect-Database` - Establish database connection
- `Invoke-DatabaseQuery` - Execute SQL queries
- `Add-LogEntry` - Add application log entries
- `Get-LogEntries` - Retrieve log entries
- `Update-ServerStatus` - Update server monitoring data
- `Add-UserAction` - Record user actions

### 5. Migration from Existing Database

If your existing database has a different schema:

1. **Analyze your current schema**: Document tables and columns
2. **Create migration script**: Map your data to the expected schema
3. **Test migration**: Use a copy of your database first
4. **Update utility functions**: Modify `DatabaseUtils.ps1` if needed

### 6. Database Features That Will Be Enabled

Once the database is integrated:

- **Application Logs Tab**: View real-time logs with filtering
- **Export Functionality**: Export logs and data to files
- **Server History**: Historical server status data
- **Audit Trail**: Complete record of user actions
- **Persistent Settings**: Application configuration storage

## Testing Database Integration

Run the setup validation test to verify database connectivity:

```powershell
.\Test-Setup.ps1 -Verbose
```

## Troubleshooting

### Common Issues

1. **"SQLite assembly failed to load"**
   - Verify correct DLL version (64-bit, .NET Framework 4.x)
   - Check file permissions in `lib/` folder

2. **"Database locked" errors**
   - Close any SQLite browser tools
   - Restart the application

3. **Schema version mismatch**
   - Use the migration script to update schema
   - Or start with a fresh database

### Log Locations

- **Console logs**: Displayed in real-time
- **Database logs**: Stored in `logs` table (when available)
- **Export location**: User-specified during export

## Performance Considerations

- Database operations are asynchronous where possible
- Large datasets may require pagination
- Regular cleanup of old log entries recommended
- Backup database regularly

## Security Notes

- Database contains sensitive AD operation logs
- File permissions should restrict access
- Consider encryption for sensitive environments
- Audit database access regularly
