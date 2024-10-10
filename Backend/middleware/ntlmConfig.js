const ntlm = require('express-ntlm');
const { getDomainInfo } = require('../utils/ldapUtils');

const ntlmConfig = (app) => {
    return async (req, res, next) => {
        try {
            const domainInfo = await getDomainInfo();
            const domainControllers = domainInfo.domainControllers;

            app.use(ntlm({
                domain: domainInfo.domainRoot,
                domaincontroller: domainControllers
            }));

            next();
        } catch (error) {
            console.error('Failed to get domain info:', error);
            res.status(500).send('Internal Server Error');
        }
    };
};

module.exports = ntlmConfig;