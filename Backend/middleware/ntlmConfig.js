const ntlm = require('express-ntlm');
const { getDomainInfo } = require('../utils/ldapUtils');

let ntlmInitialized = false; // Flag to check if NTLM has been initialized

const ntlmConfig = async (app) => {
    console.log('Initializing NTLM configuration...');
    try {
        const domainInfo = await getDomainInfo();
        const domainControllers = domainInfo.domainControllers;

        console.log('Domain Info retrieved:', domainInfo);
        console.log('Domain Controllers:', domainControllers);

        // Initialize NTLM middleware only once
        if (!ntlmInitialized) {
            console.log('NTLM middleware not initialized yet. Initializing now...');
            app.use(ntlm({
                domain: domainInfo.domainRoot,
                domaincontroller: domainControllers
            }));
            ntlmInitialized = true; // Set the flag to prevent reinitialization
            console.log('NTLM middleware initialized successfully.');
        } else {
            console.log('NTLM middleware already initialized. Skipping initialization.');
        }
    } catch (error) {
        console.error('Failed to get domain info:', error);
        throw new Error('Failed to initialize NTLM config');
    }
};

module.exports = ntlmConfig;