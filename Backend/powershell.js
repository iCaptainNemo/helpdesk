const { execFile } = require('child_process');
const path = require('path');
const { log, info, warn, error, verbose, debug } = require('./utils/logger');

// List of scripts where stdout logging should be suppressed
const scriptsToSuppressLogging = [
//    'LockedOutList.ps1',
    'getDomainInfo.ps1',
    'Get-ADObject.ps1',
    'logFilePath.ps1',
    'Get-ServerStatus.ps1'
    // 'Get-Logs.ps1'
];

// Scripts categorized by type for mode-aware execution
const MONITORING_SCRIPTS = [
    'LockedOutList.ps1',
    'getDomainInfo.ps1',
    'Get-ServerStatus.ps1',
    'Get-Logs.ps1',
    'logFilePath.ps1'
];

const ACTION_SCRIPTS = [
    'Get-ADObject.ps1',
    'Unlock-ADAccount.ps1',
    'Reset-UserPassword.ps1',
    'Set-UserPassword.ps1',
    'Enable-ADAccount.ps1',
    'Disable-ADAccount.ps1'
];

// Guard rails for every PowerShell invocation. execFile (not exec) means arguments
// are passed as an array and never interpreted by cmd.exe, so script parameters
// cannot break out into shell metacharacters. Timeout prevents a hung script from
// pinning a request open forever; maxBuffer avoids truncating large script output
// (e.g. Get-Logs) mid-JSON.
const EXEC_TIMEOUT_MS = 120000; // 2 minutes
const EXEC_MAX_BUFFER = 1024 * 1024 * 10; // 10 MB

function buildExecOptions(extra = {}) {
    return {
        cwd: process.env.WINDIR || 'C:\\Windows', // avoid UNC path issues
        timeout: EXEC_TIMEOUT_MS,
        maxBuffer: EXEC_MAX_BUFFER,
        windowsHide: true,
        ...extra
    };
}

// Drop empty/undefined parameters, matching the previous filter(Boolean) behavior.
function cleanParams(params = []) {
    return params.filter(Boolean);
}

/**
 * Check if a script should use remote data instead of local execution
 * @param {string} scriptPath - The path to the PowerShell script
 * @returns {boolean} - True if should use remote data in remote mode
 */
function shouldUseRemoteData(scriptPath) {
    const deploymentMode = process.env.DEPLOYMENT_MODE;

    if (deploymentMode !== 'remote') {
        return false; // Always use local execution in local mode
    }

    // In remote mode, monitoring scripts should use remote data
    return MONITORING_SCRIPTS.some(script => scriptPath.includes(script));
}

/**
 * Executes a PowerShell script with the given parameters or fetches remote data if appropriate.
 * @param {string} scriptPath - The path to the PowerShell script.
 * @param {Array<string>} params - The parameters to pass to the script.
 * @returns {Promise<Object>} - A promise that resolves with the JSON-parsed output of the script.
 */
async function executePowerShellScript(scriptPath, params = []) {
    // Check if we should use remote data instead of local execution
    if (shouldUseRemoteData(scriptPath)) {
        info(`Using remote data for monitoring script: ${scriptPath}`);
        return await fetchRemoteData(scriptPath, params);
    }

    // Continue with local execution for action scripts or local mode
    const args = ['-File', scriptPath, ...cleanParams(params)];
    const command = `powershell.exe ${args.join(' ')}`; // for logging/terminal display only
    const shouldSuppressLogging = scriptsToSuppressLogging.some(script => scriptPath.includes(script));

    if (!shouldSuppressLogging) {
        info(`Executing command: ${command}`);
    }

    // Broadcast PowerShell command to terminal
    if (global.terminalIO) {
        global.terminalIO.to('terminal').emit('powershell-output', {
            type: 'command',
            command: command,
            timestamp: new Date().toISOString()
        });
    }

    return new Promise((resolve, reject) => {
        execFile('powershell.exe', args, buildExecOptions(), (execError, stdout, stderr) => {
            if (execError) {
                error(`Execution error: ${execError}`);

                // Broadcast error to terminal
                if (global.terminalIO) {
                    global.terminalIO.to('terminal').emit('powershell-output', {
                        type: 'error',
                        error: `${execError}\n${stderr}`,
                        timestamp: new Date().toISOString()
                    });
                }

                return reject(`Execution error: ${execError}\n${stderr}`);
            }
            if (stderr) {
                error(`stderr: ${stderr}`);

                // Broadcast stderr to terminal
                if (global.terminalIO) {
                    global.terminalIO.to('terminal').emit('powershell-output', {
                        type: 'error',
                        error: stderr,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            if (!stdout) {
                error('No output from PowerShell script');
                return reject('No output from PowerShell script');
            }

            if (!shouldSuppressLogging) {
                debug(`stdout: ${stdout}`);

                // Broadcast output to terminal (only for non-suppressed scripts)
                if (global.terminalIO) {
                    global.terminalIO.to('terminal').emit('powershell-output', {
                        type: 'output',
                        output: stdout,
                        timestamp: new Date().toISOString()
                    });
                }
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
 * Fetches data from remote server for monitoring scripts
 * @param {string} scriptPath - The path to the original PowerShell script
 * @param {Array<string>} params - The parameters that would have been passed to the script
 * @returns {Promise<Object>} - A promise that resolves with remote data
 */
async function fetchRemoteData(scriptPath, params = []) {
    try {
        const { createRemoteClient } = require('./utils/remoteClient');
        const remoteClient = createRemoteClient();

        if (scriptPath.includes('LockedOutList.ps1')) {
            return await remoteClient.getLockedUsers();
        } else if (scriptPath.includes('getDomainInfo.ps1')) {
            return await remoteClient.getDomainControllers();
        } else if (scriptPath.includes('Get-ServerStatus.ps1')) {
            return await remoteClient.getServerStatus(params);
        } else if (scriptPath.includes('Get-Logs.ps1')) {
            return await remoteClient.getLogs();
        } else {
            warn(`No remote data handler for script: ${scriptPath}`);
            throw new Error(`Remote data not available for ${scriptPath}`);
        }
    } catch (remoteError) {
        error(`Failed to fetch remote data for ${scriptPath}:`, remoteError);
        // Fall back to local execution if remote fails
        warn(`Falling back to local execution for ${scriptPath}`);
        return await executeLocalScript(scriptPath, params);
    }
}

/**
 * Execute script locally (fallback function)
 * @param {string} scriptPath - The path to the PowerShell script
 * @param {Array<string>} params - The parameters to pass to the script
 * @returns {Promise<Object>} - A promise that resolves with the script output
 */
async function executeLocalScript(scriptPath, params = []) {
    const args = ['-File', scriptPath, ...cleanParams(params)];

    return new Promise((resolve, reject) => {
        execFile('powershell.exe', args, buildExecOptions(), (execError, stdout, stderr) => {
            if (execError) {
                return reject(`Execution error: ${execError}\n${stderr}`);
            }
            if (!stdout) {
                return reject('No output from PowerShell script');
            }

            try {
                const cleanedOutput = stdout.trim();
                const jsonOutput = JSON.parse(cleanedOutput);
                resolve(jsonOutput);
            } catch (parseError) {
                reject(`JSON parse error: ${parseError}\n${stdout}`);
            }
        });
    });
}

/**
 * Executes a PowerShell script with special handling for server status scripts and remote mode support.
 * @param {string} scriptPath - The path to the PowerShell script.
 * @param {Array<string>} params - The parameters to pass to the script.
 * @returns {Promise<Object>} - A promise that resolves with the JSON-parsed output of the script.
 */
async function serverPowerShellScript(scriptPath, params = []) {
    // Check if we should use remote data instead of local execution
    if (shouldUseRemoteData(scriptPath)) {
        info(`Using remote data for monitoring script: ${scriptPath}`);
        return await fetchRemoteData(scriptPath, params);
    }

    let args;

    // Special case for Get-ServerStatus.ps1 to handle array of server names
    if (scriptPath.includes('Get-ServerStatus.ps1')) {
        // Pass the comma-joined server list as a single -Servers argument
        args = ['-File', scriptPath, '-Servers', params.join(',')];
    } else {
        args = ['-File', scriptPath, ...cleanParams(params)];
    }

    const command = `powershell.exe ${args.join(' ')}`; // for logging display only
    // Check if logging should be suppressed for this script
    const shouldSuppressLogging = scriptsToSuppressLogging.some(script => scriptPath.includes(script));

    // Log the command if logging is not suppressed
    if (!shouldSuppressLogging) {
        info(`Executing command: ${command}`);
    }

    // Return a promise that resolves with the script output
    return new Promise((resolve, reject) => {
        execFile('powershell.exe', args, buildExecOptions(), (execError, stdout, stderr) => {
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
    const modifiedCommand = `${command}`;

    // Check if logging should be suppressed for this command
    const shouldSuppressLogging = scriptsToSuppressLogging.some(script => modifiedCommand.includes(script));

    // Log the command if logging is not suppressed
    if (!shouldSuppressLogging) {
        verbose(`Executing command: ${modifiedCommand}`);
    }

    // Return a promise that resolves with the command output
    return new Promise((resolve, reject) => {
        // Add Tools folder to PATH so bundled utilities (PsLoggedon, PsInfo, ...) resolve
        const toolsPath = process.pkg
            ? path.join(process.cwd(), 'Tools')
            : path.join(__dirname, '../Tools');

        const execOptions = buildExecOptions({
            env: {
                ...process.env,
                PATH: `${toolsPath};${process.env.PATH}`
            }
        });

        // The command is passed as a single -Command argument rather than wrapped in
        // a cmd.exe string, so no shell quoting/escaping is required.
        execFile('powershell.exe', ['-Command', modifiedCommand], execOptions, (execError, stdout, stderr) => {
            if (execError) {
                error(`Execution error: ${execError}`);
                return reject(`Execution error: ${execError}\n${stderr}`);
            }
            if (stderr) {
                error(`stderr: ${stderr}`);
            }
            if (!stdout) {
                error('No output from PowerShell command');
                return resolve({ message: 'Command executed successfully, but no output was produced.' });
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
