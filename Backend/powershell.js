const { exec } = require('child_process');

function executePowerShellScript(scriptPath, params = []) {
    const paramString = params
        .filter(param => param) // Omit empty parameters
        .join(' '); // Join parameters without wrapping in quotes

    const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${scriptPath} ${paramString}`;

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
            resolve(stdout.trim()); // Return raw output
        });
    });
}

module.exports = {
    executePowerShellScript
};