# Helpdesk Jarvis - Standalone IT Management Tool

> This project lives on the [`Jarvis-GUI` branch](https://github.com/iCaptainNemo/helpdesk/tree/Jarvis-GUI) of this repository. The `main` branch is a separate, unrelated PowerShell-only project that happens to share this repo - it will not be merged with this one. Always work from `Jarvis-GUI`.

**A portable IT helpdesk solution in a single ~85MB executable.**

Helpdesk Jarvis provides IT professionals with a comprehensive web-based interface for managing user accounts, system monitoring, and administrative tasks. No installation required - just run the exe and get started!

## Key Features

- **Zero Installation**: Single executable file - no Node.js, npm, or dependencies required
- **Automatic Setup**: Registry integration and tools download automatically on first run
- **System Management**: User unlock, password reset, computer status monitoring
- **External Tool Integration**: Launch Remote Desktop, PowerShell, PsExec with one click
- **Real-time Monitoring**: Live updates for locked users and system status
- **Secure Authentication**: JWT-based sessions with Active Directory integration
- **Modern Interface**: Responsive React-based web UI accessible from any browser

## Quick Start

### Option 1: Download Pre-built Executable (Recommended)

1. **Download** the latest `helpdesk-jarvis.exe` from [Releases](https://github.com/iCaptainNemo/helpdesk/releases)
2. **Place** the exe in your desired folder (e.g., `C:\IT-Tools\`)
3. **Run as Administrator** (first time only for registry setup)
4. **Access** the web interface at `http://localhost:3001` (opens automatically)

### Option 2: Build from Source

Requires [Node.js 22](https://nodejs.org/) - the standalone exe is packaged for the `node22-win-x64` target, and building with a different Node version will produce a mismatched native module (better-sqlite3) that fails to load.

```bash
# Clone this branch specifically - main is a different, unrelated project
git clone -b Jarvis-GUI https://github.com/iCaptainNemo/helpdesk.git
cd helpdesk

# Install dependencies (root, Backend, frontend)
npm run install-deps

# Build standalone executable (versioned, recommended)
npm run release

# Run the built executable
releases/helpdesk-jarvis-v{version}.exe
```

## First Run Setup

When you run the executable for the first time:

### Automatic Setup (Run as Administrator)
- Creates registry entries for `jarvis://` protocol handler
- Downloads required tools (PsLoggedon.exe, PsInfo.exe, etc.) from GitHub
- Creates JarvisLauncher integration for external tools
- Opens browser automatically to setup wizard

### Manual Setup (If Admin Rights Unavailable)
If you can't run as administrator, the application will show instructions for:
- Manually downloading tools to the `Tools/` folder
- Running registry setup batch files
- External tool integration setup

## System Requirements

- **OS**: Windows 10/11 or Windows Server 2016+
- **Architecture**: x64 (64-bit)
- **Memory**: 512MB RAM minimum
- **Disk**: 200MB free space
- **Network**: Internet connection for tool downloads (first run)
- **Privileges**: Administrator rights recommended for full functionality

## Configuration

### Setup Wizard
On first run, access `http://localhost:3001/setup` to configure:
- Active Directory connection
- Administrative credentials
- Deployment mode (Local/Remote)
- Database settings

### Manual Configuration
Create a `.env` file next to the executable:
```env
# Basic Configuration
PORT=3001
DEPLOYMENT_MODE=local

# Active Directory (if using remote mode)
LDAP_URL=ldap://your-domain-controller.com
LDAP_BASE_DN=dc=yourdomain,dc=com
LDAP_USERNAME=your-service-account
LDAP_PASSWORD=your-password

# Admin Credentials (local mode)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

## Usage

### Web Interface
- Navigate to `http://localhost:3001`
- Login with your configured credentials
- Access all features through the modern web interface

### Core Features
- **Dashboard**: Overview of system status and locked users
- **User Management**: Unlock accounts, reset passwords, view user info
- **Computer Management**: System status, remote connections, logged-in users
- **Active Directory**: Browse and manage AD objects
- **External Tools**: Launch Remote Desktop, PowerShell sessions, PsExec

### External Tool Integration
Click computer names or use context menus to:
- Launch Remote Desktop (`jarvis:cmrcvie`)
- Start Remote Assistance (`jarvis:msraaaa`)
- Open PowerShell sessions (`jarvis:powersh`)
- Execute remote commands (`jarvis:cmdexec`)

## Security Features

- **JWT Authentication**: Secure session management
- **Active Directory Integration**: Use existing domain credentials
- **Input Sanitization**: Protection against injection attacks
- **Session Timeouts**: Automatic logout for security
- **Audit Logging**: Track all administrative actions

## File Structure

```
helpdesk-jarvis.exe           # Main executable (~85MB)
├── .env                      # Configuration file (created on first run)
├── database.db               # SQLite database (created automatically)
├── logs/                     # Application logs
└── Tools/                    # External utilities (downloaded automatically)
    ├── PsLoggedon.exe        # Show logged-in users
    ├── PsInfo.exe            # System information
    └── windirstat.exe        # Disk usage analyzer
```

## Updates

### Update Checker
The app checks GitHub Releases for newer versions and notifies you in the UI when one is available. Downloading and installing the update is still manual - the notification opens the release page for you.

### Manual Updates
1. Download new `helpdesk-jarvis.exe`
2. Stop current instance
3. Replace executable
4. Run new version (configuration preserved)

## Troubleshooting

### Common Issues

**External tools not working:**
- Run as administrator to enable registry setup
- Manually download tools to `Tools/` folder if auto-download fails

**Can't access web interface:**
- Check if port 3001 is available
- Ensure Windows Firewall isn't blocking the application
- Try accessing `http://127.0.0.1:3001` instead

**Active Directory connection fails:**
- Verify LDAP settings in configuration
- Test network connectivity to domain controller
- Check service account permissions

### Logs
Check the `logs/` folder for detailed error information and debugging data.

## vs Development Mode

| Feature | Standalone Exe | Development Mode |
|---------|----------------|------------------|
| Installation | Single file | Node.js + npm install |
| Size | ~85MB | ~500MB+ (node_modules) |
| Startup Time | ~3 seconds | ~10 seconds |
| Updates | Replace exe | git pull + rebuild |
| Dependencies | None | Node.js ecosystem |
| Configuration | .env file | Multiple config files |

## For Developers

Want to contribute or modify the code? See [DEVELOPMENT.md](DEVELOPMENT.md) for:
- Development environment setup
- Building from source
- Architecture documentation
- Contributing guidelines

## License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please see [DEVELOPMENT.md](DEVELOPMENT.md) for development setup and contribution guidelines.

## Support

- **Issues**: [GitHub Issues](https://github.com/iCaptainNemo/helpdesk/issues)
- **Documentation**: [Wiki](https://github.com/iCaptainNemo/helpdesk/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/iCaptainNemo/helpdesk/discussions)

---

**Made for IT professionals who need reliable, portable tools.**
