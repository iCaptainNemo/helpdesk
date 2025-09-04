# Helpdesk Jarvis

A comprehensive PowerShell-based helpdesk automation system designed for multi-domain environments. This system provides a unified interface for common helpdesk tasks while maintaining domain portability and multi-agent support.

## 🌟 Key Features

- **Domain Agnostic**: Automatically detects and adapts to any Active Directory domain
- **Multi-Agent Support**: Multiple helpdesk agents can use the system simultaneously
- **YAML Configuration**: Human-readable configuration files for easy management
- **Modular Architecture**: Extensible function library with clean separation of concerns
- **Dual Environment Support**: Works with PowerShell AD modules or WMI fallback
- **Centralized Logging**: Optional user activity tracking and log analysis
- **Template-Based Setup**: Quick deployment to new domains using configuration templates

## 🚀 Quick Start

### Prerequisites
- PowerShell 5.1 or higher
- Active Directory connectivity
- Domain user account with appropriate permissions

### Installation
1. Clone or copy the repository to your domain environment
2. **⚠️ IMPORTANT**: Customize `Functions/Utilities/Show-LastLogEntries.ps1` for your domain's log format (see Domain-Specific Customization below)
3. Run the main script: `.\jarvis.ps1`
4. Follow the initial configuration prompts for domain and admin setup

### First Run
On first execution, Jarvis will:
- Detect your domain environment (PowerShell AD vs WMI)
- Create domain-specific configuration from templates
- Set up admin user preferences (including log entry display count)
- Test domain controller connectivity (if needed)
- Prompt for log file display preferences (default: 10 entries)

## 📁 Project Structure

```
helpdesk/
├── jarvis.ps1              # Main aggregator script
├── functions/              # Modular function library
│   ├── ADUserProp.ps1      # Active Directory user management
│   ├── Asset-Control.ps1   # Computer asset tracking
│   ├── Get-UserId.ps1      # User ID validation
│   ├── Main-Loop.ps1       # Core menu system
│   └── ...                 # Additional specialized functions
├── Templates/              # Configuration templates
│   ├── Domain_Template.yaml
│   ├── Admin_Template.yaml
│   └── User_Template.yaml
├── Config/                 # Generated YAML configurations (gitignored)
├── Tools/                  # External utilities (PsInfo, etc.)
└── CLAUDE.md              # Developer instructions
```

## ⚙️ Configuration

### Domain Configuration (`Config/domain_<domain>.yaml`)
- Environment settings (domain name, command type)
- Centralized log file paths
- Domain controller lists
- Default passwords and settings

### Admin Configuration (`Config/admin_<username>.yaml`)
- Individual admin user preferences  
- Custom temporary passwords
- Log entry display count (configurable per admin)
- Domain-specific logging configuration
- Personal settings overrides

### User Session Management
- Temporary user data during helpdesk sessions
- Activity tracking and computer access logs
- Automated cleanup and session management

## 🛠️ Core Functions

- **User Account Management**: Unlock accounts, reset passwords, view AD properties
- **Asset Control**: Track user computer access, monitor logon history
- **Network Tools**: Add printers, map drives, remote system access
- **Log Analysis**: Parse and display user activity logs with unique computer tracking
- **SCCM Integration**: Remote tools and system management
- **Browser Management**: Clear cache, cookies, and profile data

## ⚠️ Domain-Specific Customization Required

### Log Entry Management Customization
**CRITICAL**: `Functions/Utilities/Show-LastLogEntries.ps1` must be customized for each domain deployment.

**Required Customizations:**
1. **Log File Paths**: Update log file location and naming convention
2. **Log Format Parsing**: Modify `Parse-LogEntry` function to match your domain's log format
3. **Computer Name Extraction**: Ensure computer names are correctly extracted from log entries
4. **Date/Time Format**: Adjust date parsing to match your timestamp format
5. **Admin Configuration**: Set logging preferences in admin YAML files

**Example Domain Log Formats:**
```
# Format 1: "COMPUTER01 Mon 01/15/2024 14:30:25.123"
# Format 2: "[2024-01-15 14:30:25] COMPUTER01 - User Login"
# Format 3: "COMPUTER01,Mon,01/15/2024,14:30:25"
```

**Customization Steps:**
1. Examine your domain's existing computer access logs
2. Update `$logFilePath` construction in `Show-LastLogEntries` function
3. Modify `Parse-LogEntry` function field splitting and extraction logic
4. Test computer name extraction works correctly
5. Verify log entry count configuration in admin YAML files

**Failure to customize this file will result in:**
- No computer suggestions in Asset Control menu
- Broken log analysis functionality
- Reduced system effectiveness for helpdesk operations

## 🔧 Development

### Adding New Functions
1. Create a new `.ps1` file in the `functions/` directory
2. Add the filename to the `$AllFunctions` array in `jarvis.ps1`
3. Use `$script:EnvironmentInfo` for domain/environment detection
4. Follow existing error handling and debug patterns

### Configuration Management
- Domain-level: Use YAML for settings that affect all users
- User-level: Store in script scope variables for session data
- Persistent data: Consider database storage for complex relationships

### Testing in New Domains
1. Copy the entire helpdesk folder to the new environment
2. Run `.\jarvis.ps1` - automatic domain detection and configuration
3. Verify domain controller connectivity and AD module availability
4. Test multi-user scenarios with different admin accounts

## 📝 Version History

### Version 2.0 (Current)
- **Major Architecture Refactor**: Migrated from PowerShell .env files to YAML configuration system
- **Enhanced Multi-Agent Support**: Improved concurrent user handling
- **Modernized Codebase**: Removed legacy variables, improved error handling
- **Unique Log Analysis**: Enhanced log parsing to show unique computers with latest access times
- **Template-Based Deployment**: Standardized configuration creation from templates
- **Comprehensive Documentation**: Added extensive inline documentation and developer guides

### Version 1.x
- Initial PowerShell script collection
- Basic domain controller testing
- Legacy .env file configuration system

## 📄 License

Internal use only. See LICENSE file for details.
