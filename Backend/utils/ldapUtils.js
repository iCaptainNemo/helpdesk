const path = require('path');
const { executePowerShellScript } = require('../powershell');

async function getDomainInfo() {
    const scriptPath = path.join(__dirname, '../functions/getDomainInfo.ps1');
    try {
        const jsonOutput = await executePowerShellScript(scriptPath);

        const domainRoot = jsonOutput.DomainInfo.DomainRoot[0];
        const ldapPath = jsonOutput.DomainInfo.LdapPath;
        const domainControllers = jsonOutput.DomainControllers.DomainControllers;

        return {
            domainRoot,
            ldapPath,
            domainControllers
        };
    } catch (error) {
        throw new Error(`Failed to get domain info: ${error}`);
    }
}

module.exports = {
    getDomainInfo
};