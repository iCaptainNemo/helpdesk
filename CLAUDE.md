# Jarvis Helpdesk Automation - Claude Code Instructions

## Project Overview
Jarvis is a domain-agnostic helpdesk automation script designed to be portable across different Active Directory environments. The system can be dropped into any domain and will automatically configure itself after the initial startup.

## Key Design Principles

### Domain Agnostic Architecture
- **Auto-detection**: Script automatically detects current domain and adapts
- **Environment fallback**: PowerShell AD module preferred, WMI fallback for restricted environments  
- **Self-configuring**: Creates necessary configuration files on first run
- **No hardcoded values**: All domain-specific settings are dynamically discovered

### Multi-Agent Support
- **Per-user configurations**: Each service desk agent gets isolated config files
- **Session management**: Individual user sessions tracked separately
- **Concurrent usage**: Multiple agents can run simultaneously with proper file handling

## File Structure
```
helpdesk/
├── jarvis.ps1              # Main aggregator script
├── Functions/              # Modular function library (organized by category)
│   ├── Core/              # Core system functions (Main-Loop, Get-UserId, etc.)
│   ├── UserManagement/    # User account functions (password reset, unlock)
│   ├── AssetControl/      # Asset control modules (LAPS, BitLocker, remote tools)
│   ├── Utilities/         # Utility functions (logging, AD queries)
│   └── Standalone/        # Root-level scripts for future integration
├── Config/                # YAML configuration files
│   ├── AssetControlMenu.yaml  # YAML-driven menu configuration
│   ├── domain_*.yaml      # Domain-specific configurations
│   └── admin_*.yaml       # Admin-specific configurations
├── Templates/             # YAML templates for new setups
│   ├── AssetControlMenu_Template.yaml  # Menu template
│   ├── Domain_Template.yaml           # Domain template
│   └── Admin_Template.yaml            # Admin template
├── Tools/                 # Executable utilities (PsLoggedOn, etc.)
├── Other/                 # Miscellaneous scripts and utilities
└── CLAUDE.md             # This file - instructions for Claude Code
```

## Development Guidelines

### Adding New Functions
1. Create new `.ps1` file in appropriate `Functions/` subdirectory:
   - `Functions/Core/` - Core system functions
   - `Functions/UserManagement/` - User account operations  
   - `Functions/AssetControl/` - Asset control features
   - `Functions/Utilities/` - Utility and helper functions
   - `Functions/Standalone/` - Scripts for future integration
2. **🚨 CRITICAL**: Ensure file contains ONLY function definitions - no immediate execution code
3. Follow existing error handling patterns and PowerShell documentation standards
4. Use `Write-Debug` for troubleshooting output
5. Test that file can be dot-sourced without prompting user

### Adding Asset Control Features
1. Create new module in `Functions/AssetControl/` directory
2. Add menu item to `Config/AssetControlMenu.yaml`:
   ```yaml
   - id: [next_number]
     name: "Feature Name"
     function: "Function-Name"
     module: "module-filename"
     description: "Feature description"
     enabled: true
   ```
3. No PowerShell code changes required - menu system loads dynamically

### Configuration Management
- Use SQLite database for structured persistent data
- Use YAML files for configuration that needs human editing
- Use YAML templates in `Templates/` for creating new configurations
- Menu systems driven by YAML configuration files
- Avoid hardcoded paths - use `Join-Path` and `$PSScriptRoot`

### Testing in New Domains
1. Copy entire helpdesk folder to new domain environment
2. Run `.\jarvis.ps1` - it will auto-configure on first run
3. Verify domain detection works (PowerShell AD vs WMI fallback)
4. Test multi-user scenarios with different service desk agents

## Common Maintenance Tasks

### Troubleshooting
- Run with `-Debug` switch for verbose output
- Check `Config/` directory for YAML configuration issues
- Verify function loading in debug output
- Check asset control menu loading if features are missing

### Updates and Improvements
- Always test in development domain first
- Maintain backward compatibility with existing config files
- Update version number in script header after changes
- Document breaking changes in this file

## Known Limitations
- File locking may occur with simultaneous YAML file access
- WMI fallback has reduced functionality compared to PowerShell AD
- Initial setup requires domain connectivity and appropriate permissions
- **🚨 CRITICAL**: Functions files must not contain immediate execution code - wrap all logic in function definitions
- **📋 DOMAIN-SPECIFIC**: Log parsing functions require customization per domain environment

## Domain-Specific Customization Requirements

### Log Entry Management (Show-LastLogEntries.ps1)
**🔧 REQUIRES CUSTOMIZATION for each domain deployment**

The `Functions/Utilities/Show-LastLogEntries.ps1` file must be adapted to match each domain's specific:
- Log file storage location and naming convention
- Log entry format and field structure
- Computer name extraction logic
- Date/time parsing format

**Minimum Requirements:**
- Must extract computer names from log entries for Jarvis computer selection functionality
- Admin configuration must specify log entry display count preference
- Parse-LogEntry function must be updated to match domain log format

**Configuration Steps:**
1. Update log file path construction in Show-LastLogEntries function
2. Modify Parse-LogEntry function to match log format (computer name, date, time fields)
3. Adjust date/time parsing logic for domain-specific timestamp formats
4. Configure admin YAML file Logging section with domain-specific settings
5. Test computer name extraction works correctly

**Example Customization Points:**
```powershell
# Update these sections in Show-LastLogEntries.ps1:
$logFilePath = $script:envVars['logFileBasePath'] + $script:envVars['UserID']  # Customize path
$components = $logEntry -split ' '  # Customize field delimiter
$PossibleComputerName = $components[0]  # Customize computer name field index
```

## Architecture Notes

### YAML-Driven Menu System
- Asset Control menus are dynamically generated from YAML configuration
- New features can be added without modifying PowerShell code
- Menu items can be enabled/disabled via configuration
- Supports modular loading of asset control functions

### Modular Function Organization  
- Functions organized by purpose in subdirectories
- Core functions handle system operations
- Asset control functions are modular and independently loadable
- Utilities provide shared functionality across modules