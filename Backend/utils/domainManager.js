const path = require('path');
const { executePowerShellScript, executePowerShellCommand } = require('../powershell');
const { log, info, warn, error, verbose, debug } = require('../utils/logger'); // Import the sanitized logger functions
const { insertDomainController, insertCurrentDomain, executeQuery, updateDomainControllerStatus } = require('../db/queries');

const scriptPath = path.join(__dirname, '../functions/Get-DomainControllers.ps1');

async function updateDomainControllers() {
    try {
        const result = await executePowerShellScript(scriptPath);

        const { DcList, PDC, DDC, DomainName } = result;

        await executeQuery('DELETE FROM DomainControllers');
        await executeQuery('DELETE FROM CurrentDomain');

        Object.keys(DcList).forEach((dcName) => {
            const details = DcList[dcName];
            const role = (dcName === PDC.Name) ? 'PDC' : (dcName === DDC.Name) ? 'DDC' : 'Other';
            insertDomainController(dcName, JSON.stringify(details), role, (err) => {
                if (err) {
                    error(`Error inserting domain controller ${dcName}:`, err.message);
                } else {
                    info(`Domain controller ${dcName} inserted.`);
                }
            });
        });

        insertCurrentDomain(DomainName, PDC.Name, DDC.Name, (err) => {
            if (err) {
                error('Error inserting current domain:', err.message);
            } else {
                info('Current domain inserted.');
            }
        });
    } catch (err) {
        error(`Error updating domain controllers: ${err}`);
    }
}

async function DomainControllerStatus() {
    try {
        const domainControllers = await executeQuery('SELECT ControllerName FROM DomainControllers');
        for (const controller of domainControllers) {
            const statusCommand = `Test-Connection -ComputerName ${controller.ControllerName} -Count 1 -Quiet -ErrorAction Stop | ConvertTo-Json -Compress`;
            try {
                verbose(`Executing command: ${statusCommand}`);
                const statusResponse = await executePowerShellCommand(statusCommand);
                verbose(`Command response: ${statusResponse}`);
                const status = statusResponse === true ? 'Online' : 'Offline';
                await updateDomainControllerStatus(controller.ControllerName, status);
                info(`Updated status for ${controller.ControllerName} to ${status}`);
            } catch (err) {
                error(`Error checking status for ${controller.ControllerName}: ${err}`);
                await updateDomainControllerStatus(controller.ControllerName, 'Offline');
            }
        }
    } catch (err) {
        error(`Error updating domain controller statuses: ${err}`);
    }
}

module.exports = {
    updateDomainControllers,
    DomainControllerStatus
};