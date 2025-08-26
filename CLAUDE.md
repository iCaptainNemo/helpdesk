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
├── functions/              # Modular function library
├── .env/                   # Per-domain and per-user config files
├── Config/                 # YAML configuration files
├── db/                     # SQLite database for persistent data
├── Templates/              # YAML templates for new setups
└── CLAUDE.md              # This file - instructions for Claude Code
```

## Development Guidelines

### Adding New Functions
1. Create new `.ps1` file in `functions/` directory
2. Add filename to `$AllFunctions` array in jarvis.ps1:221-239
3. Follow existing error handling patterns
4. Use `Write-Debug` for troubleshooting output

### Configuration Management
- Use SQLite database for structured persistent data
- Use YAML files for configuration that needs human editing
- Use PowerShell `.ps1` files for per-user runtime variables
- Avoid hardcoded paths - use `Join-Path` and `$PSScriptRoot`

### Testing in New Domains
1. Copy entire helpdesk folder to new domain environment
2. Run `.\jarvis.ps1` - it will auto-configure on first run
3. Verify domain detection works (PowerShell AD vs WMI fallback)
4. Test multi-user scenarios with different service desk agents

## Common Maintenance Tasks

### Troubleshooting
- Run with `-Debug` switch for verbose output
- Check `.env/` directory for configuration issues
- Verify function loading in debug output

### Updates and Improvements
- Always test in development domain first
- Maintain backward compatibility with existing config files
- Update version number in script header after changes
- Document breaking changes in this file

## Known Limitations
- File locking may occur with simultaneous YAML/PS1 file access
- WMI fallback has reduced functionality compared to PowerShell AD
- Initial setup requires domain connectivity and appropriate permissions