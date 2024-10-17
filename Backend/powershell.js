const { exec } = require('child_process');
const { log, info, warn, error } = require('./utils/logger');

// List of scripts where stdout logging should be suppressed
const scriptsToSuppressLogging = [
    'LockedOutList.ps1',
    'getDomainInfo.ps1'
];

/**
 * Executes a PowerShell script with optional user credentials.
 * @param {string} scriptPath - Path to the PowerShell script.
 * @param {Array} params - Parameters to pass to the script.
 * @param {Object} [userSession] - Optional user session containing credentials.
 * @returns {Promise} - Resolves with the parsed JSON output of the script.
 */
function executePowerShellScript(scriptPath, params = [], userSession = null) {
    const paramString = params
        .filter(param => param) // Omit empty parameters
        .map(param => `"${param.replace(/"/g, '\\"')}"`) // Escape double quotes
        .join(' '); // Join with spaces

    let command;

    if (userSession) {
        // Decode Base64 password for use in the PowerShell session
        const decodedPasswordCommand = `
            $DecodedPassword = [System.Text.Encoding]::Unicode.GetString(
                [System.Convert]::FromBase64String('${userSession.password}')
            );
            $SecurePassword = ConvertTo-SecureString $DecodedPassword -AsPlainText -Force;
            $Cred = New-Object System.Management.Automation.PSCredential('${userSession.username}', $SecurePassword);
            Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ${scriptPath} ${paramString}' -Credential $Cred;
        `;

        command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { ${decodedPasswordCommand} }"`;
    } else {
        command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${scriptPath} ${paramString}`;
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

        // Store the process ID in the user session for future management
        if (userSession) {
            userSession.processId = child.pid;
        }
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

    const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Stop-Process -Id ${session.processId} -Force -ErrorAction SilentlyContinue"`;

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
    closePowerShellSession,
};