const ldap = require('ldapjs');
const path = require('path');
const { executePowerShellScript } = require('../powershell');
const logger = require('../utils/logger'); // Import the logger

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

        logger.info('Domain Info:', cachedDomainInfo); // Use logger

        return cachedDomainInfo;
    } catch (error) {
        logger.error('Failed to get domain info:', error); // Use logger
        throw new Error(`Failed to get domain info: ${error}`);
    }
}

async function authenticateUser(userID, password) {
    logger.info('authenticateUser called with userID:', userID); // Debug log without password

    if (!userID) {
        logger.error('Empty userID provided'); // Use logger
        return false;
    }

    const domainInfo = await getDomainInfo();
    const ldapServer = domainInfo.domainControllers[0]; // Use the first domain controller
    let domainRoot = domainInfo.domainRoot; // Get the domain root from the domain info

    // Convert domain root from 'DC=hs,DC=gov' to 'hs.gov'
    domainRoot = domainRoot.replace(/DC=/g, '').replace(/,/g, '.');

    // Format the userID as username@domain
    const formattedUserID = `${userID}@${domainRoot}`;


    logger.log(`Attempting to bind to LDAP server: ${ldapServer}`);
    logger.log(`Using sAMAccountName: ${formattedUserID}`); // Log the formatted sAMAccountName

    return new Promise((resolve, reject) => {
        const client = ldap.createClient({
            url: `ldap://${ldapServer}`
        });

        client.bind(formattedUserID, password, (err) => { // Use formatted sAMAccountName
            client.unbind();
            if (err) {
                logger.error('LDAP bind failed:', err);
                return resolve(false);
            }
            logger.log('LDAP bind successful');
            return resolve(true);
        });
    });
}

module.exports = {
    getDomainInfo,
    authenticateUser
};