const { exec } = require('child_process');
const { log, info, warn, error } = require('./utils/logger'); // Import the custom logger

// List of scripts that should not log stdout
const scriptsToSuppressLogging = [
    'LockedOutList.ps1' // Add more script names or paths as needed
];

/**
 * Executes a PowerShell script.
 * @param {string} scriptPath - Path to the PowerShell script.
 * @param {Array} params - Array of parameters to pass to the script.
 * @param {Object} [userSession] - Optional user session for executing user-specific scripts.
 * @returns {Promise} - Resolves with the JSON output of the script.
 */
function executePowerShellScript(scriptPath, params = [], userSession = null) {
    // Escape parameters to avoid injection issues
    const paramString = params
        .filter(param => param) // Omit empty parameters
        .map(param => `"${param.replace(/"/g, '\\"')}"`) // Escape double quotes
        .join(' '); // Join parameters with spaces

    // Command string varies based on whether a user session is provided
    const command = userSession 
        ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ${scriptPath} ${paramString}' -Credential (New-Object System.Management.Automation.PSCredential('${userSession.username}', (ConvertTo-SecureString '${userSession.password}' -AsPlainText -Force))) }"`
        : `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${scriptPath} ${paramString}`;

    // Check if the script should suppress stdout logging
    const shouldSuppressLogging = scriptsToSuppressLogging.some(script => scriptPath.includes(script));

    if (!shouldSuppressLogging) {
        info(`Executing command: ${command}`); // Log the command for debugging
    }

    return new Promise((resolve, reject) => {
        exec(command, (execError, stdout, stderr) => {
            if (execError) {
                error(`exec error: ${execError}`);
                return reject(`exec error: ${execError}\n${stderr}`);
            }
            if (stderr) {
                error(`stderr: ${stderr}`);
            }
            if (!stdout) {
                error('No output from PowerShell script');
                return reject('No output from PowerShell script');
            }

            if (!shouldSuppressLogging) {
                info(`stdout: ${stdout}`); // Log the output for debugging
            }

            try {
                const cleanedOutput = stdout.trim();
                const jsonOutput = JSON.parse(cleanedOutput);
                resolve(jsonOutput); // Return parsed JSON output
            } catch (parseError) {
                error(`JSON parse error: ${parseError}`);
                reject(`JSON parse error: ${parseError}\n${stdout}`);
            }
        });
    });
}

/**
 * Closes a PowerShell session.
 * @param {Object} session - The user session object with credentials.
 */
function closePowerShellSession(session) {
    if (!session || !session.username) {
        error('Invalid session provided for closing.');
        return;
    }

    const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Stop-Process -Name powershell -Force -ErrorAction SilentlyContinue"`;
    info(`Closing PowerShell session for user: ${session.username}`);

    exec(command, (execError, stdout, stderr) => {
        if (execError) {
            error(`Failed to close PowerShell session: ${execError}`);
            return;
        }
        if (stderr) {
            error(`stderr: ${stderr}`);
        }
        info(`PowerShell session closed for user: ${session.username}`);
    });
}

module.exports = {
    executePowerShellScript,
    closePowerShellSession,
};