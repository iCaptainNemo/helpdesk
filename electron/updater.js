const { autoUpdater } = require('electron-updater');
const { dialog, Notification } = require('electron');
const logger = require('electron-log');

class AppUpdater {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.setupLogger();
        this.setupAutoUpdater();
        this.setupEventHandlers();
    }

    setupLogger() {
        // Configure electron-log for updater
        logger.transports.file.level = 'info';
        autoUpdater.logger = logger;
        logger.info('Auto-updater initialized');
    }

    setupAutoUpdater() {
        // Configure auto-updater
        autoUpdater.checkForUpdatesAndNotify = false; // Manual control
        autoUpdater.autoDownload = false; // Don't auto-download
        autoUpdater.allowDowngrade = false;
        autoUpdater.allowPrerelease = false;

        // GitHub repository configuration
        autoUpdater.setFeedURL({
            provider: 'github',
            owner: 'iCaptainNemo', // Replace with actual repo owner
            repo: 'helpdesk', // Replace with actual repo name
            private: false // Set to true if private repo
        });

        logger.info('Auto-updater feed URL configured');
    }

    setupEventHandlers() {
        // Update checking started
        autoUpdater.on('checking-for-update', () => {
            logger.info('Checking for update...');
            this.sendStatusToWindow('Checking for updates...');
        });

        // Update available
        autoUpdater.on('update-available', (updateInfo) => {
            logger.info('Update available:', updateInfo);
            this.handleUpdateAvailable(updateInfo);
        });

        // No update available
        autoUpdater.on('update-not-available', (updateInfo) => {
            logger.info('Update not available:', updateInfo);
            this.sendStatusToWindow('You have the latest version');
        });

        // Download progress
        autoUpdater.on('download-progress', (progressObj) => {
            const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
            logger.info('Download progress:', message);
            this.sendStatusToWindow(`Downloading update: ${Math.round(progressObj.percent)}%`);
        });

        // Update downloaded
        autoUpdater.on('update-downloaded', (updateInfo) => {
            logger.info('Update downloaded:', updateInfo);
            this.handleUpdateDownloaded(updateInfo);
        });

        // Error occurred
        autoUpdater.on('error', (error) => {
            logger.error('Auto-updater error:', error);
            this.handleUpdateError(error);
        });
    }

    async handleUpdateAvailable(updateInfo) {
        const updateMessage = `A new version (${updateInfo.version}) is available!\\n\\nCurrent version: ${autoUpdater.currentVersion}\\nNew version: ${updateInfo.version}\\n\\nRelease date: ${updateInfo.releaseDate}`;
        
        // Show notification
        if (Notification.isSupported()) {
            new Notification({
                title: 'Update Available',
                body: `Helpdesk Jarvis ${updateInfo.version} is now available`,
                icon: require('path').join(__dirname, 'assets', 'icon.png')
            }).show();
        }

        // Show dialog to user
        const response = await dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: 'A new version of Helpdesk Jarvis is available!',
            detail: updateMessage,
            buttons: ['Download Update', 'Skip This Version', 'Remind Me Later'],
            defaultId: 0,
            cancelId: 2
        });

        switch (response.response) {
            case 0: // Download Update
                logger.info('User chose to download update');
                this.downloadUpdate();
                break;
            case 1: // Skip This Version
                logger.info('User chose to skip version:', updateInfo.version);
                this.skipVersion(updateInfo.version);
                break;
            case 2: // Remind Me Later
                logger.info('User chose to be reminded later');
                break;
        }
    }

    async handleUpdateDownloaded(updateInfo) {
        const message = `Update ${updateInfo.version} has been downloaded and is ready to install.\\n\\nThe application will restart to complete the installation.`;
        
        // Show notification
        if (Notification.isSupported()) {
            new Notification({
                title: 'Update Ready',
                body: 'Update downloaded and ready to install',
                icon: require('path').join(__dirname, 'assets', 'icon.png')
            }).show();
        }

        // Show dialog to user
        const response = await dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'Update Ready to Install',
            message: 'Update downloaded successfully!',
            detail: message,
            buttons: ['Restart Now', 'Restart Later'],
            defaultId: 0,
            cancelId: 1
        });

        if (response.response === 0) {
            logger.info('User chose to restart now');
            this.installUpdate();
        } else {
            logger.info('User chose to restart later');
            this.sendStatusToWindow('Update ready - restart when convenient');
        }
    }

    handleUpdateError(error) {
        logger.error('Update error:', error);
        
        // Show error dialog
        dialog.showErrorBox('Update Error', `Failed to check for updates: ${error.message}`);
        
        this.sendStatusToWindow('Update check failed');
    }

    downloadUpdate() {
        logger.info('Starting update download');
        autoUpdater.downloadUpdate();
        this.sendStatusToWindow('Downloading update...');
    }

    installUpdate() {
        logger.info('Installing update and restarting');
        autoUpdater.quitAndInstall();
    }

    skipVersion(version) {
        // Store skipped version in user preferences
        const { app } = require('electron');
        const Store = require('electron-store');
        const store = new Store();
        
        store.set('skippedVersion', version);
        logger.info('Skipped version stored:', version);
    }

    shouldCheckForUpdates() {
        const Store = require('electron-store');
        const store = new Store();
        
        // Check if user has disabled auto-updates
        const autoUpdateEnabled = store.get('autoUpdateEnabled', true);
        if (!autoUpdateEnabled) {
            logger.info('Auto-updates disabled by user');
            return false;
        }

        // Check if we should skip this check based on interval
        const lastCheck = store.get('lastUpdateCheck', 0);
        const checkInterval = store.get('updateCheckInterval', 24 * 60 * 60 * 1000); // 24 hours default
        const now = Date.now();

        if (now - lastCheck < checkInterval) {
            logger.info('Skipping update check - interval not met');
            return false;
        }

        // Update last check time
        store.set('lastUpdateCheck', now);
        return true;
    }

    async checkForUpdates(manual = false) {
        try {
            if (!manual && !this.shouldCheckForUpdates()) {
                return;
            }

            logger.info('Checking for updates...');
            const result = await autoUpdater.checkForUpdates();
            
            if (manual && result && result.updateInfo && result.updateInfo.version === autoUpdater.currentVersion) {
                dialog.showMessageBox(this.mainWindow, {
                    type: 'info',
                    title: 'No Updates',
                    message: 'You are running the latest version!',
                    detail: `Current version: ${autoUpdater.currentVersion}`
                });
            }

            return result;
        } catch (error) {
            logger.error('Error checking for updates:', error);
            
            if (manual) {
                dialog.showErrorBox('Update Check Failed', `Could not check for updates: ${error.message}`);
            }
        }
    }

    sendStatusToWindow(message) {
        if (this.mainWindow && this.mainWindow.webContents) {
            this.mainWindow.webContents.send('update-status', message);
        }
    }

    // Get current app version
    getCurrentVersion() {
        const { app } = require('electron');
        return app.getVersion();
    }

    // Check if update is available without downloading
    async isUpdateAvailable() {
        try {
            const result = await autoUpdater.checkForUpdates();
            return result && result.updateInfo && result.updateInfo.version !== autoUpdater.currentVersion;
        } catch (error) {
            logger.error('Error checking update availability:', error);
            return false;
        }
    }
}

module.exports = AppUpdater;