const { exec } = require('child_process');
const { log, info, warn, error } = require('./utils/logger');

// List of scripts where stdout logging should be suppressed
const scriptsToSuppressLogging = [
    'LockedOutList.ps1',
    'getDomainInfo.ps1',
    'Get-ADObject.ps1',
    'logFilePath.ps1',
    // 'Get-ServerStatus.ps1',
    'Get-Logs.ps1'
];


function executePowerShellScript(scriptPath, params = []) {
    const paramString = params
        .filter(param => param) // Omit empty parameters
        .map(param => param.replace(/"/g, '\\"')) // Escape double quotes without adding extra quotes
        .join(' ');

    command = `powershell.exe -File ${scriptPath} ${paramString}`;

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

    });
}

function serverPowerShellScript(scriptPath, params = []) {
    let paramString;

    // Special case for Get-ServerStatus.ps1 to handle array of server names
    if (scriptPath.includes('Get-ServerStatus.ps1')) {
        const serverNames = params;
        paramString = `-Servers "${serverNames.join(',')}"`;
    } else {
        paramString = params
            .filter(param => param) // Omit empty parameters
            .map(param => param.replace(/"/g, '\\"')) // Escape double quotes without adding extra quotes
            .join(' ');
    }

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

module.exports = {
    executePowerShellScript,
    serverPowerShellScript
};