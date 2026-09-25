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
    const sourceFunctionsDir = path.join(__dirname, '../functions');

    try {
        // Create functions directory if it doesn't exist
        if (!fs.existsSync(functionsDir)) {
            fs.mkdirSync(functionsDir, { recursive: true });
        }

        // Discover scripts dynamically instead of a hardcoded list - a hardcoded
        // list silently drifts out of sync as scripts get added (this one was
        // missing 11 of the 20 scripts that actually exist by the time it was
        // found), and any script not on the list would just fail at execution
        // time in the packaged exe with no clear error pointing back here.
        const scripts = fs.readdirSync(sourceFunctionsDir).filter(f => f.endsWith('.ps1'));

        for (const scriptName of scripts) {
            const targetPath = path.join(functionsDir, scriptName);
            const sourcePath = path.join(sourceFunctionsDir, scriptName);

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