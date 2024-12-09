const express = require('express');
const router = express.Router();
const { serverPowerShellScript } = require('../powershell');
const logger = require('../utils/logger'); // Import the logger module

// Define the path to the PowerShell script
const scriptPath = './functions/Get-ADObjects.ps1';

router.post('/', async (req, res) => {
    const { adObjectIDs } = req.body; // Expecting an array of AD object IDs

    logger.debug('Received request to fetch AD objects with IDs:', adObjectIDs);

    if (!Array.isArray(adObjectIDs) || adObjectIDs.length === 0) {
        logger.error('Invalid input: adObjectIDs must be a non-empty array');
        return res.status(400).json({ error: 'adObjectIDs must be a non-empty array' });
    }

    try {
        const results = await Promise.all(adObjectIDs.map(async (adObjectID) => {
            const params = [adObjectID];
            logger.debug(`Executing PowerShell script with params: ${params}`);
            const result = await serverPowerShellScript(scriptPath, params);
            logger.debug(`Result for ${adObjectID}: ${JSON.stringify(result)}`);
            return { adObjectID, result };
        }));

        logger.debug('Fetched results:', results);
        res.json(results); // Return the results as a JSON array
    } catch (error) {
        logger.error('Error executing PowerShell script:', error);
        res.status(500).json({ error: 'Failed to fetch AD objects' });
    }
});

module.exports = router;