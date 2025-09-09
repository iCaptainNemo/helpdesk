const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // App version and info
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    
    // Window controls
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    
    // System info
    getSystemInfo: () => ipcRenderer.invoke('system:get-info'),
    
    // File system operations (limited)
    selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
    selectFile: (filters) => ipcRenderer.invoke('dialog:select-file', filters),
    
    // Notifications
    showNotification: (title, body) => ipcRenderer.invoke('notification:show', title, body),
    
    // External links
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
    
    // Auto-updater
    checkForUpdates: (manual = false) => ipcRenderer.invoke('updater:check-for-updates', manual),
    downloadUpdate: () => ipcRenderer.invoke('updater:download-update'),
    installUpdate: () => ipcRenderer.invoke('updater:install-update'),
    skipVersion: (version) => ipcRenderer.invoke('updater:skip-version', version),
    getCurrentVersion: () => ipcRenderer.invoke('updater:get-current-version'),
    
    // Event listeners
    onWindowFocus: (callback) => ipcRenderer.on('window:focus', callback),
    onWindowBlur: (callback) => ipcRenderer.on('window:blur', callback),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', callback),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    removeUpdateListeners: () => {
        ipcRenderer.removeAllListeners('update-status');
        ipcRenderer.removeAllListeners('update-available');
        ipcRenderer.removeAllListeners('update-downloaded');
    }
});

// Security: Remove Node.js globals that shouldn't be available in renderer
delete window.require;
delete window.exports;
delete window.module;