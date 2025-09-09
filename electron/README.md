# Helpdesk Jarvis - Electron Desktop Application

This directory contains the Electron configuration and assets for packaging Helpdesk Jarvis as a desktop application.

## Architecture

The Electron app bundles both the React frontend and Express.js backend into a single executable desktop application:

- **Main Process** (`main.js`): Controls application lifecycle, creates windows, manages backend server
- **Renderer Process**: Serves the React frontend via embedded Chromium
- **Backend Server**: Node.js/Express server runs as child process
- **Preload Script** (`preload.js`): Secure bridge between main and renderer processes

## Features

### 🖥️ Window Management
- Single instance enforcement
- Minimize to system tray
- Custom window controls
- Responsive design (1400x900 default, 1000x700 minimum)

### 🔧 System Integration  
- System tray with context menu
- Desktop shortcut creation
- Start menu integration
- Auto-launch capabilities
- Cross-platform support (Windows, macOS, Linux)

### 🛡️ Security
- Context isolation enabled
- Node integration disabled in renderer
- Content Security Policy (CSP) headers
- Secure IPC communication via preload script
- External link protection

### 📦 Packaging
- NSIS installer for Windows (.exe)
- DMG package for macOS
- AppImage for Linux
- Code signing ready
- Auto-updater integration

## Development Commands

```bash
# Install all dependencies
npm run install-deps

# Start development with Electron
npm run electron:dev

# Start just Electron (requires backend/frontend to be running)
npm run electron

# Build production app
npm run build:electron

# Create distribution packages
npm run dist           # All platforms  
npm run dist:win       # Windows only
npm run pack          # Unpackaged build
```

## File Structure

```
electron/
├── main.js              # Main Electron process
├── preload.js           # Secure IPC bridge
├── assets/              # Application icons and assets
│   ├── icon.png         # Main app icon (512x512)
│   ├── icon.ico         # Windows icon
│   ├── icon.icns        # macOS icon  
│   ├── tray-icon.png    # System tray icon
│   └── README.md        # Icon guidelines
└── README.md            # This file
```

## Backend Integration

The Electron app automatically:

1. **Starts Backend Server**: Spawns `Backend/server.js` as child process
2. **Port Management**: Uses localhost:3001 for API communication  
3. **Process Lifecycle**: Manages backend startup/shutdown with app
4. **Error Handling**: Shows user-friendly errors if backend fails
5. **Local Mode**: Runs entirely offline with local SQLite database

## Security Considerations

### IPC Communication
- All renderer-to-main communication goes through secure IPC handlers
- Preload script exposes limited, safe APIs to frontend
- No direct Node.js access in renderer process

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; 
  connect-src 'self' http://localhost:* ws://localhost:* 
             http://172.25.129.95:* ws://172.25.129.95:*; 
  img-src 'self' data: blob:;
">
```

### Process Isolation
- Frontend runs in isolated renderer process
- Backend runs as separate Node.js process
- Main process coordinates between both

## Deployment

### Windows Distribution
- Creates `.exe` installer with NSIS
- Includes uninstaller
- Desktop and Start Menu shortcuts
- Can be deployed via Group Policy or SCCM

### Development vs Production
- **Development**: Hot-reloads with dev servers
- **Production**: Serves built files from filesystem
- **Bundling**: All dependencies packaged into executable

## Customization

### Icons
Replace icons in `assets/` directory following the guidelines in `assets/README.md`.

### Window Properties
Modify window settings in `main.js` `createWindow()` function:
```javascript
new BrowserWindow({
  width: 1400,        // Default width
  height: 900,        // Default height
  minWidth: 1000,     // Minimum width
  minHeight: 700,     // Minimum height
  // ... other options
})
```

### Application Metadata
Update app information in root `package.json`:
```json
{
  "name": "helpdesk-jarvis",
  "productName": "Helpdesk Jarvis", 
  "description": "IT Helpdesk Management System",
  "version": "1.0.0"
}
```

## Troubleshooting

### Backend Won't Start
- Check if port 3001 is available
- Verify `Backend/server.js` exists and is executable
- Check backend logs in Electron console

### Frontend Won't Load  
- Ensure frontend is built (`npm run build:frontend`)
- Check for CORS issues in browser console
- Verify CSP headers aren't blocking resources

### Packaging Fails
- Install missing dependencies: `npm install --save-dev electron electron-builder`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check for missing icons in `assets/` directory

### Performance Issues
- Use production build for testing: `npm run dist`
- Check for memory leaks in Task Manager
- Monitor backend process CPU usage

## Next Steps

1. **Auto-Updater**: Implement GitHub releases-based auto-updater
2. **Code Signing**: Set up certificates for production distribution  
3. **Installer**: Create custom NSIS installer with branding
4. **Testing**: Add automated testing for Electron app
5. **CI/CD**: Set up GitHub Actions for automated builds