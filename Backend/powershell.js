const { exec } = require('child_process');
const { log, info, warn, error, verbose, debug } = require('./utils/logger');

// List of scripts where stdout logging should be suppressed
const scriptsToSuppressLogging = [
    'LockedOutList.ps1',
    'getDomainInfo.ps1',
    'Get-ADObject.ps1',
    'logFilePath.ps1',
    'Get-ServerStatus.ps1'
    // 'Get-Logs.ps1'
];

/**
 * Executes a PowerShell script with the given parameters.
 * @param {string} scriptPath - The path to the PowerShell script.
 * @param {Array<string>} params - The parameters to pass to the script.
 * @returns {Promise<Object>} - A promise that resolves with the JSON-parsed output of the script.
 */
function executePowerShellScript(scriptPath, params = []) {
    // Construct the parameter string, escaping double quotes
    const paramString = params
        .filter(param => param) // Omit empty parameters
        .map(param => param.replace(/"/g, '\\"')) // Escape double quotes without adding extra quotes
        .join(' ');

    // Construct the command to execute the PowerShell script
    const command = `powershell.exe -File ${scriptPath} ${paramString}`;

    // Check if logging should be suppressed for this script
    const shouldSuppressLogging = scriptsToSuppressLogging.some(script => scriptPath.includes(script));

    // Log the command if logging is not suppressed
    if (!shouldSuppressLogging) {
        info(`Executing command: ${command}`);
    }

    // Return a promise that resolves with the script output
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
                debug(`stdout: ${stdout}`);
            }

            try {
                // Parse the output as JSON
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
 * Executes a PowerShell script with special handling for server status scripts.
 * @param {string} scriptPath - The path to the PowerShell script.
 * @param {Array<string>} params - The parameters to pass to the script.
 * @returns {Promise<Object>} - A promise that resolves with the JSON-parsed output of the script.
 */
function serverPowerShellScript(scriptPath, params = []) {
    let paramString;

    // Special case for Get-ServerStatus.ps1 to handle array of server names
    if (scriptPath.includes('Get-ServerStatus.ps1')) {
        const serverNames = params;
        paramString = `-Servers "${serverNames.join(',')}"`;
    } else {
        // Construct the parameter string, escaping double quotes
        paramString = params
            .filter(param => param) // Omit empty parameters
            .map(param => param.replace(/"/g, '\\"')) // Escape double quotes without adding extra quotes
            .join(' ');
    }

    // Construct the command to execute the PowerShell script
    const command = `powershell.exe -File ${scriptPath} ${paramString}`;
    // Check if logging should be suppressed for this script
    const shouldSuppressLogging = scriptsToSuppressLogging.some(script => scriptPath.includes(script));

    // Log the command if logging is not suppressed
    if (!shouldSuppressLogging) {
        info(`Executing command: ${command}`);
    }

    // Return a promise that resolves with the script output
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
                debug(`stdout: ${stdout}`);
            }

            try {
                // Parse the output as JSON
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
 * Executes a PowerShell command directly.
 * @param {string} command - The PowerShell command to execute.
 * @returns {Promise<Object>} - A promise that resolves with the JSON-parsed output of the command.
 */
function executePowerShellCommand(command) {
    // Append ConvertTo-Json -Compress to the command
    // const modifiedCommand = `${command} | ConvertTo-Json -Compress`;
    const modifiedCommand = `${command}`;

    // Check if logging should be suppressed for this command
    const shouldSuppressLogging = scriptsToSuppressLogging.some(script => modifiedCommand.includes(script));

    // Log the command if logging is not suppressed
    if (!shouldSuppressLogging) {
        logger.verbose(`Executing command: ${modifiedCommand}`);
    }

    // Return a promise that resolves with the command output
    return new Promise((resolve, reject) => {
        exec(`powershell.exe -Command "${modifiedCommand}"`, (execError, stdout, stderr) => {
            if (execError) {
                logger.error(`Execution error: ${execError}`);
                return reject(`Execution error: ${execError}\n${stderr}`);
            }
            if (stderr) {
                logger.error(`stderr: ${stderr}`);
            }
            if (!stdout) {
                logger.error('No output from PowerShell command');
                return resolve({ message: 'Command executed successfully, but no output was produced.' });
            }

            if (!shouldSuppressLogging) {
                logger.debug(`stdout: ${stdout}`);
            }

            try {
                // Parse the output as JSON
                const cleanedOutput = stdout.trim();
                const jsonOutput = JSON.parse(cleanedOutput);
                resolve(jsonOutput);
            } catch (parseError) {
                logger.error(`JSON parse error: ${parseError}`);
                resolve({ message: 'Command executed successfully, but output could not be parsed as JSON.' });
            }
        });
    });
}

module.exports = {
    executePowerShellScript,
    serverPowerShellScript,
    executePowerShellCommand
};