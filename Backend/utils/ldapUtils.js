const path = require('path');
const { executePowerShellScript } = require('../powershell');

let cachedDomainInfo = null;

async function getDomainInfo() {
    if (cachedDomainInfo) {
        return cachedDomainInfo;
    }

    const scriptPath = path.join(__dirname, '../functions/getDomainInfo.ps1');
    try {
        const jsonOutput = await executePowerShellScript(scriptPath);

        const domainRoot = jsonOutput.DomainInfo.DomainRoot[0];
        const ldapPath = jsonOutput.DomainInfo.LdapPath;
        const domainControllers = jsonOutput.DomainControllers.DomainControllers;

        cachedDomainInfo = {
            domainRoot,
            ldapPath,
            domainControllers
        };

        return cachedDomainInfo;
    } catch (error) {
        throw new Error(`Failed to get domain info: ${error}`);
    }
}

module.exports = {
    getDomainInfo
};