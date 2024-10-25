const { exec } = require('child_process');
const { log, info, warn, error } = require('./utils/logger');

// List of scripts where stdout logging should be suppressed
const scriptsToSuppressLogging = [
    'LockedOutList.ps1',
    'getDomainInfo.ps1',
    'Get-ADObject.ps1',
    'logFilePath.ps1',
    'Get-Logs.ps1'
];

/**
 * Executes a PowerShell script with optional user credentials.
 * @param {string} scriptPath - Path to the PowerShell script.
 * @param {Array} params - Parameters to pass to the script.
 * @param {Object} [userSession] - Optional user session containing credentials.
 * @param {string} [adminComputer] - The admin computer name.
 * @returns {Promise} - Resolves with the parsed JSON output of the script.
 */
function executePowerShellScript(scriptPath, params = [], sessionID, adminComputer) {
    const paramString = params
        .filter(param => param) // Omit empty parameters
        .map(param => param.replace(/"/g, '\\"')) // Escape double quotes without adding extra quotes
        .join(' ');

    let command;

    if (!adminComputer) {
        const errorMessage = 'Admin computer is not provided.';
        error(errorMessage);
        return Promise.reject(new Error(errorMessage));
    }

    if (adminComputer.toLowerCase() !== 'localhost') {
        const invokeCommand = `Invoke-Command -FilePath '${scriptPath}' -ArgumentList '${paramString}' -ComputerName ${adminComputer}`;
        command = `powershell.exe -Command "& {${invokeCommand}}"`;
    } else {
        command = `powershell.exe -File ${scriptPath} ${paramString}`;
    }

    const shouldSuppressLogging = scriptsToSuppressLogging.some(script => scriptPath.includes(script));

    if (!shouldSuppressLogging) {
        info(`Executing command: ${command}`);
    }

    return new Promise((resolve, reject) => {
        const child = exec(command, (execError, stdout, stderr) => {
            if (execError) {
                error(`Execution error: ${execError}`);
                return reject(`Execution error: ${execError}\n${stderr}`);
            }
            if (stderr) {
                error(`stderr: ${stderr}`);
            }
            if (!stdout) {
                error('No output from PowerShell script');
                return reject('No output from PowerShell script');
            }

            if (!shouldSuppressLogging) {
                info(`stdout: ${stdout}`);
            }

            try {
                const cleanedOutput = stdout.trim();
                const jsonOutput = JSON.parse(cleanedOutput);
                resolve(jsonOutput);
            } catch (parseError) {
                error(`JSON parse error: ${parseError}`);
                reject(`JSON parse error: ${parseError}\n${stdout}`);
            }
        });

        if (userSession) {
            userSession.processId = child.pid;
        }
    });
}

/**
 * Executes a PowerShell script on the server without user credentials.
 * @param {string} scriptPath - Path to the PowerShell script.
 * @param {Array} params - Parameters to pass to the script.
 * @returns {Promise} - Resolves with the parsed JSON output of the script.
 */
function serverPowerShellScript(scriptPath, params = []) {
    const paramString = params
        .filter(param => param) // Omit empty parameters
        .map(param => param.replace(/"/g, '\\"')) // Escape double quotes without adding extra quotes
        .join(' ');

    const command = `powershell.exe -File ${scriptPath} ${paramString}`;

    const shouldSuppressLogging = scriptsToSuppressLogging.some(script => scriptPath.includes(script));

    if (!shouldSuppressLogging) {
        info(`Executing command: ${command}`);
    }

    return new Promise((resolve, reject) => {
        exec(command, (execError, stdout, stderr) => {
            if (execError) {
                error(`Execution error: ${execError}`);
                return reject(`Execution error: ${execError}\n${stderr}`);
            }
            if (stderr) {
                error(`stderr: ${stderr}`);
            }
            if (!stdout) {
                error('No output from PowerShell script');
                return reject('No output from PowerShell script');
            }

            if (!shouldSuppressLogging) {
                info(`stdout: ${stdout}`);
            }

            try {
                const cleanedOutput = stdout.trim();
                const jsonOutput = JSON.parse(cleanedOutput);
                resolve(jsonOutput);
            } catch (parseError) {
                error(`JSON parse error: ${parseError}`);
                reject(`JSON parse error: ${parseError}\n${stdout}`);
            }
        });
    });
}

/**
 * Closes a running PowerShell session.
 * @param {Object} session - The user session object with credentials.
 */
function closePowerShellSession(session) {
    if (!session || !session.username || !session.processId) {
        error('Invalid session data for closing PowerShell session.');
        return;
    }

    const command = `powershell.exe -Command "Stop-Process -Id ${session.processId} -Force -ErrorAction SilentlyContinue"`;

    info(`Closing PowerShell session for user: ${session.username} with process ID: ${session.processId}`);

    exec(command, (execError, stdout, stderr) => {
        if (execError) {
            error(`Failed to close PowerShell session: ${execError}`);
            return;
        }
        if (stderr) {
            warn(`stderr: ${stderr}`);
        }
        info(`PowerShell session closed for user: ${session.username}`);
    });
}

module.exports = {
    executePowerShellScript,
    serverPowerShellScript,
    closePowerShellSession,
};