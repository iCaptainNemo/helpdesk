# Helpdesk GUI - WPF Edition

A native Windows desktop application for IT helpdesk operations. This WPF-based tool provides a fast, integrated, and secure interface for common Active Directory and system administration tasks.

## Features

- **Active Directory Object Viewer**: Search and view AD users, computers, and printers
- **User Account Management**: Unlock locked-out user accounts
- **Server Monitoring**: Real-time status monitoring of critical servers
- **Domain Controllers**: Monitor domain controller health and status
- **Local SQLite Database**: Persistent storage for logs and configurations
- **Tron-like UI**: Modern, dark theme with glowing effects

## Prerequisites

- Windows 10/11 or Windows Server 2016+
- **PowerShell 5.1 or later** (Windows PowerShell 5.1, PowerShell 7.x)
- Active Directory PowerShell module (RSAT-AD-PowerShell)
- .NET Framework 4.7.2 or later
- **System.Data.SQLite.dll** (Required for database features - see setup instructions below)

### Important Notes:
- **SQLite Library**: The application will run without SQLite, but database features (logging, server status persistence) will be disabled
- **PowerShell Compatibility**: Works with both Windows PowerShell 5.1 and PowerShell 7.x
- **Domain Environment**: Best functionality requires domain-joined computer with AD access

## Installation

### 1. Clone the Repository

```powershell
git clone https://github.com/iCaptainNemo/helpdesk.git
cd helpdesk
git checkout Jarvis-WPF
```

### 2. Install Prerequisites

Install the Active Directory PowerShell module:

```powershell
# On Windows 10/11
Enable-WindowsOptionalFeature -Online -FeatureName RSATClient-Roles-AD-Powershell

# On Windows Server
Install-WindowsFeature -Name RSAT-AD-PowerShell
```

### 3. Test Your Setup

Run the validation test to check if everything is ready:

```powershell
.\Test-Setup.ps1
```

### 4. Run the Application

**Option 1: PowerShell (Recommended)**
```powershell
.\Start-HelpdeskGUI.ps1
```

**Option 2: Command Prompt**
```cmd
Launch-GUI.cmd
```

**Option 3: VS Code Debug (F5)**
Press `F5` in VS Code with the project open

### 5. Optional: Enable Database Features

For full functionality including logging and audit trails:

1. Go to the [System.Data.SQLite Downloads](https://system.data.sqlite.org/index.html/doc/trunk/www/downloads.wiki)
2. Download the precompiled binary package for .NET Framework 4.x (x64)
3. Extract `System.Data.SQLite.dll` to the `lib/` folder in your project
4. Restart the application

See `DATABASE-INTEGRATION.md` for detailed database setup instructions.

## Development Setup in VS Code

### Required Extensions

1. **PowerShell** (by Microsoft) - Essential for PowerShell development
2. **Gemini Code Assist** (by Google) - AI-powered coding assistance
3. **XAML Styler** (by Xavalon) - XAML formatting and styling

### Debugging

1. Open the project in VS Code
2. Press `F5` to launch the application in debug mode
3. Set breakpoints in PowerShell code as needed

### Project Structure

```
helpdesk/
├── .vscode/
│   └── launch.json          # VS Code debug configuration
├── database/
│   └── database.db          # SQLite database (created on first run)
├── functions/
│   ├── Get-ADObject.ps1     # AD object retrieval
│   ├── Unlocker.ps1         # User unlock functionality
│   ├── Get-ServerStatus.ps1 # Server monitoring
│   ├── Get-DomainControllers.ps1
│   └── DatabaseUtils.ps1    # Database utility functions
├── lib/
│   └── System.Data.SQLite.dll  # SQLite .NET driver
├── HelpdeskGUI.xaml         # WPF UI definition
├── Start-HelpdeskGUI.ps1    # Main application script
└── README.md
```

## Usage

### Searching AD Objects

1. Enter a username, computer name, or printer name in the search box
2. Click "Search" or press Enter
3. View object properties in the table below
4. Use the "Unlock User" button if the account is locked out

### Server Monitoring

1. Click the "Server Status" tab
2. View real-time server status information
3. Use "Refresh Servers" to manually update
4. Status automatically refreshes every 5 minutes

### Domain Controllers

1. Click the "Domain Controllers" tab
2. Monitor DC health and connectivity
3. Automatic refresh every 5 minutes

### Application Logs

1. Click the "Application Logs" tab
2. View real-time application logs
3. Export logs to file for analysis
4. Clear logs as needed

## Security Model

The application runs under the security context of the logged-in Windows user. All Active Directory operations are performed with the user's inherent permissions, ensuring proper auditing and security compliance.

## Database Schema

The SQLite database contains the following tables:

- **logs**: Application logging and audit trail
- **server_status**: Server monitoring data
- **user_actions**: User action history and audit

## Troubleshooting

### Common Issues

1. **"Active Directory module not found"**
   - Install RSAT-AD-PowerShell feature
   - Restart PowerShell session

2. **"SQLite assembly failed to load"**
   - Download correct System.Data.SQLite.dll version
   - Ensure file is in the `lib/` folder

3. **"Access denied" errors**
   - Ensure user has appropriate AD permissions
   - Run as administrator if needed

### Log Files

Application logs are stored in the SQLite database and can be viewed in the "Application Logs" tab. Export logs for detailed troubleshooting.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Version History

- **v1.0** (2025-01-21): Initial WPF release
  - Native Windows desktop application
  - Active Directory integration
  - SQLite database support
  - Tron-like UI theme
  - Server and DC monitoring

## Support

For issues and questions, please use the GitHub issue tracker or contact the IT helpdesk team.
