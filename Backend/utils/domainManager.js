const path = require('path');
const { executePowerShellScript, executePowerShellCommand } = require('../powershell');
const { log, info, warn, error, verbose, debug } = require('../utils/logger'); // Import the sanitized logger functions
const { insertDomainController, insertCurrentDomain, executeQuery, updateDomainControllerStatus } = require('../db/queries');

const scriptPath = process.pkg 
    ? path.join(process.cwd(), 'functions', 'Get-DomainControllers.ps1')
    : path.join(__dirname, '../functions/Get-DomainControllers.ps1');

async function updateDomainControllers() {
    try {
        const result = await executePowerShellScript(scriptPath);

        const { DcList, PDC, DDC, DomainName } = result;

        info('PowerShell result:', JSON.stringify({ 
            DcListKeys: Object.keys(DcList), 
            PDCName: PDC?.Name, 
            DDCName: DDC?.Name, 
            DomainName 
        }, null, 2));

        // Temporarily disable foreign key constraints
        await executeQuery('PRAGMA foreign_keys = OFF');
        
        await executeQuery('DELETE FROM DomainControllers');
        await executeQuery('DELETE FROM CurrentDomain');
        
        // Re-enable foreign key constraints  
        await executeQuery('PRAGMA foreign_keys = ON');

        const insertPromises = Object.keys(DcList).map((dcName) => {
            const details = DcList[dcName];
            const role = (dcName === PDC.Name) ? 'PDC' : (dcName === DDC.Name) ? 'DDC' : 'Other';
            return new Promise((resolve, reject) => {
                insertDomainController(dcName, JSON.stringify(details), role, (err, result) => {
                    if (err) {
                        error(`Error inserting domain controller ${dcName}:`, err.message);
                        reject(err);
                    } else {
                        info(`Domain controller ${dcName} inserted.`);
                        resolve(result);
                    }
                });
            });
        });

        await Promise.all(insertPromises);

        info(`Attempting to insert CurrentDomain with PDC: ${PDC?.Name}, DDC: ${DDC?.Name}`);
        
        await new Promise((resolve, reject) => {
            insertCurrentDomain(DomainName, PDC.Name, DDC.Name, (err, result) => {
                if (err) {
                    error('Error inserting current domain:', err.message);
                    error('PDC Name:', PDC?.Name);
                    error('DDC Name:', DDC?.Name);
                    reject(err);
                } else {
                    info('Current domain inserted.');
                    resolve(result);
                }
            });
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
                
                // Parse the JSON response and check if it's true
                let isOnline = false;
                try {
                    const parsedResponse = JSON.parse(statusResponse);
                    isOnline = parsedResponse === true;
                } catch (parseError) {
                    // If JSON parsing fails, try direct comparison with string values
                    isOnline = statusResponse === 'true' || statusResponse === true || statusResponse.toString().toLowerCase() === 'true';
                }
                
                const status = isOnline ? 'Online' : 'Offline';
                await updateDomainControllerStatus(controller.ControllerName, status);
                info(`Updated status for ${controller.ControllerName} to ${status} (raw response: ${statusResponse})`);
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