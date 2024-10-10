const ldap = require('ldapjs');
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

        console.log('Domain Info:', cachedDomainInfo);

        return cachedDomainInfo;
    } catch (error) {
        console.error('Failed to get domain info:', error);
        throw new Error(`Failed to get domain info: ${error}`);
    }
}

async function authenticateUser(userID, password) {
    console.log('authenticateUser called with userID:', userID); // Debug log without password

    if (!userID) {
        console.error('Empty userID provided');
        return false;
    }

    const domainInfo = await getDomainInfo();
    const ldapServer = domainInfo.domainControllers[0]; // Use the first domain controller

    // Format the userID as username@domain
    const formattedUserID = `${userID}@hs.gov`;

    console.log(`Attempting to bind to LDAP server: ${ldapServer}`);
    console.log(`Using sAMAccountName: ${formattedUserID}`); // Log the formatted sAMAccountName

    return new Promise((resolve, reject) => {
        const client = ldap.createClient({
            url: `ldap://${ldapServer}`
        });

        client.bind(formattedUserID, password, (err) => { // Use formatted sAMAccountName
            client.unbind();
            if (err) {
                console.error('LDAP bind failed:', err);
                return resolve(false);
            }
            console.log('LDAP bind successful');
            return resolve(true);
        });
    });
}

module.exports = {
    getDomainInfo,
    authenticateUser
};