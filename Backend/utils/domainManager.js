const path = require('path');
const { executePowerShellScript } = require('../powershell');
const logger = require('../utils/logger'); // Import the logger module
const { insertDomainController, insertCurrentDomain, executeQuery } = require('../db/queries');

const scriptPath = path.join(__dirname, '../functions/Get-DomainControllers.ps1');

async function updateDomainControllers() {
    try {
        const result = await executePowerShellScript(scriptPath);

        const { DcList, PDC, DDC, DomainName } = result;

        await executeQuery('DELETE FROM DomainControllers');
        await executeQuery('DELETE FROM CurrentDomain');

        Object.keys(DcList).forEach((dcName) => {
            const details = DcList[dcName];
            const role = (dcName === PDC) ? 'PDC' : (dcName === DDC) ? 'DDC' : 'Other';
            insertDomainController(dcName, JSON.stringify(details), role, (err) => {
                if (err) {
                    logger.error(`Error inserting domain controller ${dcName}:`, err.message);
                } else {
                    logger.info(`Domain controller ${dcName} inserted.`);
                }
            });
        });

        insertCurrentDomain(DomainName, PDC, DDC, (err) => {
            if (err) {
                logger.error('Error inserting current domain:', err.message);
            } else {
                logger.info('Current domain inserted.');
            }
        });
    } catch (error) {
        logger.error(`Error updating domain controllers: ${error}`);
    }
}

module.exports = {
    updateDomainControllers
};