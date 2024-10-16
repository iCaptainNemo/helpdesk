const { exec } = require('child_process');

/**
 * Executes a PowerShell script.
 * @param {string} scriptPath - Path to the PowerShell script.
 * @param {Array} params - Array of parameters to pass to the script.
 * @param {Object} [userSession] - Optional user session for executing user-specific scripts.
 * @returns {Promise} - Resolves with the JSON output of the script.
 */
function executePowerShellScript(scriptPath, params = [], userSession = null) {
    const paramString = params
        .filter(param => param) // Omit empty parameters
        .join(' '); // Join parameters without wrapping in quotes

    // Command string varies based on whether a user session is provided
    const command = userSession 
        ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ${scriptPath} ${paramString}' -Credential (New-Object System.Management.Automation.PSCredential('${userSession.username}', (ConvertTo-SecureString '${userSession.password}' -AsPlainText -Force))) }"`
        : `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${scriptPath} ${paramString}`;

    console.log(`Executing command: ${command}`); // Log the command for debugging

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return reject(`exec error: ${error}\n${stderr}`);
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }
            if (!stdout) {
                console.error('No output from PowerShell script');
                return reject('No output from PowerShell script');
            }
            console.log(`stdout: ${stdout}`); // Log the output for debugging

            try {
                const cleanedOutput = stdout.trim();
                const jsonOutput = JSON.parse(cleanedOutput);
                resolve(jsonOutput); // Return parsed JSON output
            } catch (parseError) {
                console.error(`JSON parse error: ${parseError}`);
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
        console.error('Invalid session provided for closing.');
        return;
    }

    const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Stop-Process -Name powershell -Force -ErrorAction SilentlyContinue"`;
    console.log(`Closing PowerShell session for user: ${session.username}`);

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Failed to close PowerShell session: ${error}`);
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
        }
        console.log(`PowerShell session closed for user: ${session.username}`);
    });
}

module.exports = {
    executePowerShellScript,
    closePowerShellSession,
};
