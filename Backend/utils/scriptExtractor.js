const fs = require('fs');
const path = require('path');

/**
 * Extract bundled PowerShell scripts to filesystem for pkg compatibility
 * PowerShell requires actual files to execute, so we need to extract them from the bundle
 */
function extractPowerShellScripts() {
    if (!process.pkg) {
        // Not running in pkg, scripts are already available
        return true;
    }

    const functionsDir = path.join(process.cwd(), 'functions');
    
    try {
        // Create functions directory if it doesn't exist
        if (!fs.existsSync(functionsDir)) {
            fs.mkdirSync(functionsDir, { recursive: true });
        }

        // List of PowerShell scripts to extract
        const scripts = [
            'Get-DomainControllers.ps1',
            'LockedOutList.ps1', 
            'Get-ServerStatus.ps1',
            'Get-Logs.ps1',
            'getDomainInfo.ps1',
            'Get-ADObject.ps1',
            'Get-ADObjects.ps1',
            'Fetch-User.ps1',
            'Unlocker.ps1'
        ];

        for (const scriptName of scripts) {
            const targetPath = path.join(functionsDir, scriptName);
            const sourcePath = path.join(__dirname, '../functions', scriptName);
            
            // Only extract if target doesn't exist or source is newer
            if (!fs.existsSync(targetPath)) {
                try {
                    if (fs.existsSync(sourcePath)) {
                        const scriptContent = fs.readFileSync(sourcePath, 'utf8');
                        fs.writeFileSync(targetPath, scriptContent, 'utf8');
                        console.log(`Extracted PowerShell script: ${scriptName}`);
                    } else {
                        console.warn(`Source PowerShell script not found: ${sourcePath}`);
                    }
                } catch (error) {
                    console.error(`Failed to extract ${scriptName}:`, error.message);
                }
            }
        }
        
        return true;
    } catch (error) {
        console.error('Failed to extract PowerShell scripts:', error);
        return false;
    }
}

module.exports = {
    extractPowerShellScripts
};