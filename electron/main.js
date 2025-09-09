const { app, BrowserWindow, Menu, Tray, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const AppUpdater = require('./updater');

// Simple isDev implementation
const isDev = process.env.NODE_ENV === 'development' || process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath);

let mainWindow;
let tray;
let backendProcess;
let appUpdater;
let isQuitting = false;

// Keep a global reference of the window object
let win;

// Backend server management
function startBackendServer() {
    if (backendProcess) {
        console.log('Backend server already running');
        return;
    }

    console.log('Starting backend server...');
    const serverPath = path.join(__dirname, '../Backend/server.js');
    
    backendProcess = spawn('node', [serverPath], {
        cwd: path.join(__dirname, '../Backend'),
        stdio: 'pipe'
    });

    backendProcess.stdout.on('data', (data) => {
        console.log(`Backend: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
        console.error(`Backend Error: ${data}`);
    });

    backendProcess.on('close', (code) => {
        console.log(`Backend server exited with code ${code}`);
        backendProcess = null;
    });

    backendProcess.on('error', (error) => {
        console.error('Backend server error:', error);
        dialog.showErrorBox('Backend Error', `Failed to start backend server: ${error.message}`);
    });
}

function stopBackendServer() {
    if (backendProcess) {
        console.log('Stopping backend server...');
        backendProcess.kill();
        backendProcess = null;
    }
}

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false, // Don't show until ready-to-show
        titleBarStyle: 'default'
    });

    // Wait for backend server to start before loading frontend
    setTimeout(() => {
        const startUrl = isDev 
            ? 'http://localhost:3000' 
            : `file://${path.join(__dirname, '../frontend/build/index.html')}`;
        
        mainWindow.loadURL(startUrl);
        
        // Show window when ready
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
            
            if (isDev) {
                mainWindow.webContents.openDevTools();
            }
        });
    }, 3000); // Give backend time to start

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle minimize to tray
    mainWindow.on('minimize', (event) => {
        if (tray) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Handle close button - minimize to tray instead of quit
    mainWindow.on('close', (event) => {
        if (!isQuitting && tray) {
            event.preventDefault();
            mainWindow.hide();
            return;
        }
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

function createTray() {
    const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    
    tray = new Tray(trayIconPath);
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Helpdesk Jarvis',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Hide',
            click: () => {
                if (mainWindow) {
                    mainWindow.hide();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'About',
            click: () => {
                dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'About Helpdesk Jarvis',
                    message: 'Helpdesk Jarvis v1.0.0',
                    detail: 'IT Helpdesk Management System\\nBuilt with Electron, React, and Node.js'
                });
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Helpdesk Jarvis - IT Support System');
    tray.setContextMenu(contextMenu);

    // Double click to show/hide window
    tray.on('double-click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

// App event handlers
app.whenReady().then(() => {
    // Start backend server first
    startBackendServer();
    
    // Create main window
    createWindow();
    
    // Create system tray
    createTray();
    
    // Initialize auto-updater (only in production)
    if (!isDev) {
        appUpdater = new AppUpdater(mainWindow);
        
        // Check for updates on startup (after a delay)
        setTimeout(() => {
            appUpdater.checkForUpdates(false); // Not manual
        }, 10000); // 10 seconds after startup
    }

    // Handle app activation (macOS)
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
        }
    });
});

// Handle all windows closed
app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        isQuitting = true;
        app.quit();
    }
});

// Handle app before quit
app.on('before-quit', () => {
    isQuitting = true;
    stopBackendServer();
});

// Handle second instance (single instance enforcement)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
});

// IPC Handlers for preload script
ipcMain.handle('app:get-version', () => {
    return app.getVersion();
});

ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('system:get-info', () => {
    const os = require('os');
    return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        hostname: os.hostname(),
        username: os.userInfo().username
    };
});

ipcMain.handle('dialog:select-directory', async () => {
    if (!mainWindow) return null;
    
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:select-file', async (event, filters) => {
    if (!mainWindow) return null;
    
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: filters || []
    });
    
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('notification:show', (event, title, body) => {
    const { Notification } = require('electron');
    
    if (Notification.isSupported()) {
        new Notification({
            title: title,
            body: body
        }).show();
    }
});

ipcMain.handle('shell:open-external', (event, url) => {
    shell.openExternal(url);
});

// Auto-updater IPC handlers
ipcMain.handle('updater:check-for-updates', async (event, manual = false) => {
    if (appUpdater) {
        return await appUpdater.checkForUpdates(manual);
    }
    return { error: 'Auto-updater not available in development mode' };
});

ipcMain.handle('updater:download-update', () => {
    if (appUpdater) {
        appUpdater.downloadUpdate();
    }
});

ipcMain.handle('updater:install-update', () => {
    if (appUpdater) {
        appUpdater.installUpdate();
    }
});

ipcMain.handle('updater:skip-version', (event, version) => {
    if (appUpdater) {
        appUpdater.skipVersion(version);
    }
});

ipcMain.handle('updater:get-current-version', () => {
    if (appUpdater) {
        return appUpdater.getCurrentVersion();
    }
    return app.getVersion();
});