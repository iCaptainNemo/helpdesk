const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./logger');

class RegistrySetup {
    constructor() {
        this.jarvisLauncherPath = 'C:\\Program Files\\JarvisLauncher';
        this.jarvisLauncherBat = path.join(this.jarvisLauncherPath, 'JarvisLauncher.bat');
        this.registryKey = 'HKEY_CLASSES_ROOT\\jarvis';
    }

    /**
     * Check if the jarvis protocol is registered in the registry
     */
    async checkProtocolRegistered() {
        return new Promise((resolve) => {
            exec(`reg query "${this.registryKey}" 2>nul`, (error, stdout, stderr) => {
                if (error) {
                    logger.info('Jarvis protocol not found in registry');
                    resolve(false);
                } else {
                    logger.info('Jarvis protocol found in registry');
                    resolve(true);
                }
            });
        });
    }

    /**
     * Check if JarvisLauncher folder and batch file exist
     */
    checkLauncherFiles() {
        const folderExists = fs.existsSync(this.jarvisLauncherPath);
        const batExists = fs.existsSync(this.jarvisLauncherBat);
        
        logger.info(`JarvisLauncher folder exists: ${folderExists}`);
        logger.info(`JarvisLauncher.bat exists: ${batExists}`);
        
        return folderExists && batExists;
    }

    /**
     * Create JarvisLauncher folder and batch file
     */
    async createLauncherFiles() {
        try {
            // Create directory if it doesn't exist
            if (!fs.existsSync(this.jarvisLauncherPath)) {
                fs.mkdirSync(this.jarvisLauncherPath, { recursive: true });
                logger.info(`Created JarvisLauncher directory: ${this.jarvisLauncherPath}`);
            }

            // Create the batch file content
            const batContent = `@echo off
setlocal
set "url=%1"
set "protocol=%url:jarvis:=%"
set "program=%protocol:~0,7%"
set "adObjectID=%protocol:~7%"

if "%program%"=="cmrcvie" (
    "C:\\Program Files (x86)\\Microsoft Endpoint Manager\\AdminConsole\\bin\\i386\\CmRcViewer.exe" %adObjectID%
) else if "%program%"=="msraaaa" (
    "C:\\Windows\\System32\\msra.exe" /offerRA %adObjectID%
) else if "%program%"=="powersh" (
    powershell.exe -NoExit Enter-PSSession -ComputerName %adObjectID%
) else if "%program%"=="cmdexec" (
    cmd.exe /k "psexec.exe \\\\%adObjectID% cmd.exe"
) else (
    echo ========== Debug Info ==========
    echo Input URL: %url%
    echo Protocol: %protocol%
    echo Program: %program%
    echo Computer: %adObjectID%
    echo ==============================
    pause
)
endlocal`;

            // Write the batch file
            fs.writeFileSync(this.jarvisLauncherBat, batContent);
            logger.info(`Created JarvisLauncher.bat: ${this.jarvisLauncherBat}`);
            
            return true;
        } catch (error) {
            logger.error('Failed to create JarvisLauncher files:', error);
            return false;
        }
    }

    /**
     * Register the jarvis protocol in the Windows registry
     */
    async registerProtocol() {
        const commands = [
            `reg add "${this.registryKey}" /ve /d "URL:Jarvis Protocol" /f`,
            `reg add "${this.registryKey}" /v "URL Protocol" /d "" /f`,
            `reg add "${this.registryKey}\\shell" /f`,
            `reg add "${this.registryKey}\\shell\\open" /f`,
            `reg add "${this.registryKey}\\shell\\open\\command" /ve /d "\\"${this.jarvisLauncherBat}\\" %%1" /f`
        ];

        for (const command of commands) {
            try {
                await this.execCommand(command);
            } catch (error) {
                logger.error(`Failed to execute registry command: ${command}`, error);
                return false;
            }
        }

        logger.info('Successfully registered jarvis protocol in registry');
        return true;
    }

    /**
     * Execute a command and return a promise
     */
    execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    /**
     * Main setup routine - checks and creates everything needed for deep linking
     */
    async setupDeepLinking() {
        try {
            logger.info('🔗 Checking deep linking setup...');

            // Check if protocol is already registered
            const protocolRegistered = await this.checkProtocolRegistered();
            
            // Check if launcher files exist
            const launcherFilesExist = this.checkLauncherFiles();

            // If both exist, we're good to go
            if (protocolRegistered && launcherFilesExist) {
                logger.info('✅ Deep linking is already properly configured');
                return true;
            }

            // Create launcher files if they don't exist
            if (!launcherFilesExist) {
                logger.info('📁 Creating JarvisLauncher files...');
                const filesCreated = await this.createLauncherFiles();
                if (!filesCreated) {
                    logger.error('❌ Failed to create JarvisLauncher files');
                    return false;
                }
            }

            // Register protocol if not already registered
            if (!protocolRegistered) {
                logger.info('📝 Registering jarvis protocol in registry...');
                const protocolRegisteredSuccess = await this.registerProtocol();
                if (!protocolRegisteredSuccess) {
                    logger.error('❌ Failed to register jarvis protocol');
                    return false;
                }
            }

            logger.info('✅ Deep linking setup completed successfully');
            return true;

        } catch (error) {
            logger.error('❌ Deep linking setup failed:', error);
            return false;
        }
    }

    /**
     * Check if we have admin privileges (needed for registry operations)
     */
    async checkAdminPrivileges() {
        try {
            // Try to write to a registry location that requires admin access
            await this.execCommand('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE" >nul 2>&1');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Display warning if admin privileges are needed
     */
    displayAdminWarning() {
        const warningMessage = `
⚠️  ADMIN PRIVILEGES REQUIRED ⚠️

Deep linking setup requires administrator privileges to:
1. Create files in Program Files folder
2. Register custom protocol handler in Windows registry

Please run the application as administrator, or manually run:
Tools\\Browser_Launcher_registry_Import.bat

This is required for external tool integration (Remote Desktop, PowerShell, etc.)
`;
        
        logger.warn(warningMessage);
        console.warn(warningMessage);
    }
}

module.exports = RegistrySetup;