const ldap = require('ldapjs');
const path = require('path');
const { executePowerShellScript, closePowerShellSession } = require('../powershell');
const sessionStore = require('./sessionStore'); // Import session store
const logger = require('../utils/logger');

let cachedDomainInfo = null;

// Helper: Secure password encoding
function encodeToBase64(password) {
    return Buffer.from(password, 'utf8').toString('base64');
}

// Helper: Decode password in PowerShell sessions
function decodeBase64Command(encodedPassword) {
    return `
        $DecodedPassword = [System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('${encodedPassword}'));
        ConvertTo-SecureString $DecodedPassword -AsPlainText -Force
    `;
}

// Function to get domain information
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
            domainControllers,
        };

        logger.info('Domain Info:', cachedDomainInfo);
        return cachedDomainInfo;
    } catch (error) {
        logger.error('Failed to get domain info:', error);
        throw new Error(`Failed to get domain info: ${error}`);
    }
}

// Function to authenticate user via LDAP
async function authenticateUser(userID, password, req) {
    logger.info('Authenticating user:', userID);

    const domainInfo = await getDomainInfo();
    const ldapServer = domainInfo.domainControllers[0];
    const domainRoot = domainInfo.domainRoot.replace(/DC=/g, '').replace(/,/g, '.');
    const formattedUserID = `${userID}@${domainRoot}`;

    return new Promise((resolve) => {
        const client = ldap.createClient({ url: `ldap://${ldapServer}` });

        client.bind(formattedUserID, password, async (err) => {
            client.unbind();
            if (err) {
                logger.error('LDAP bind failed:', err);
                return resolve(false);
            }
            logger.info('LDAP bind successful');

            // Check for existing session
            sessionStore.findSessionByUserID(formattedUserID, (err, existingSessionID) => {
                if (existingSessionID) {
                    logger.info(`Existing session found for user: ${userID}`);
                    req.sessionID = existingSessionID;
                    return resolve(true);
                }

                // Store user session in Express and session store
                try {
                    const encodedPassword = encodeToBase64(password);
                    const session = { 
                        username: formattedUserID, 
                        password: encodedPassword, 
                        adminComputer: req.body.adminComputer // Store adminComputer in the session
                    };
                    req.session.powershellSession = session;

                    // Generate a new session ID if not already set
                    if (!req.sessionID) {
                        req.sessionID = generateSessionID(); // Implement generateSessionID function
                    }

                    sessionStore.set(req.sessionID, req.session, (err) => {
                        if (err) logger.error('Failed to save session:', err);
                    });

                    logger.info(`PowerShell session started for user: ${userID}`);
                    resolve(true);
                } catch (error) {
                    logger.error('Failed to start PowerShell session:', error);
                    resolve(false);
                }
            });
        });
    });
}

// Function to generate a new session ID
function generateSessionID() {
    return 'sess_' + Math.random().toString(36).substr(2, 9);
}

// Function to log out user and destroy session
function logoutUser(sessionID) {
    sessionStore.get(sessionID, (err, session) => {
        if (session && session.powershellSession) {
            try {
                closePowerShellSession(session.powershellSession);
            } catch (err) {
                logger.warn(`Error closing PowerShell session: ${err.message}`);
            }
        }

        sessionStore.destroy(sessionID, (err) => {
            if (err) {
                logger.error('Failed to destroy session:', err);
            } else {
                logger.info(`Session destroyed: ${sessionID}`);
            }
        });
    });
}

module.exports = {
    getDomainInfo,
    authenticateUser,
    logoutUser,
};