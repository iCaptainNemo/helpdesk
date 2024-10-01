const NodePowershell = require('node-powershell');

function executePowerShellScript(scriptPath, params = {}) {
    const ps = new NodePowershell({
        executionPolicy: 'Bypass',
        noProfile: true
    });

    const paramString = Object.entries(params)
        .map(([key, value]) => `-${key} '${value}'`)
        .join(' ');

    const command = `& { . ${scriptPath}; ${paramString} }`;

    console.log(`Executing command: ${command}`); // Log the command for debugging

    ps.addCommand(command);

    return ps.invoke()
        .then(output => {
            ps.dispose();
            try {
                return JSON.parse(output.trim());
            } catch (parseError) {
                console.error(`JSON parse error: ${parseError}`);
                return output.trim(); // Return raw output if JSON parsing fails
            }
        })
        .catch(error => {
            ps.dispose();
            console.error(`PowerShell error: ${error}`);
            throw new Error(`PowerShell error: ${error}`);
        });
}

module.exports = { executePowerShellScript };