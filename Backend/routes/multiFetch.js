const express = require('express');
const router = express.Router();
const { serverPowerShellScript } = require('../powershell');
const logger = require('../utils/logger'); // Import the logger module

// Define the path to the PowerShell script
const scriptPath = './functions/Get-ADObjects.ps1';

router.post('/', async (req, res) => {
    const { adObjectIDs } = req.body; // Expecting an array of AD object IDs

    if (!Array.isArray(adObjectIDs) || adObjectIDs.length === 0) {
        return res.status(400).json({ error: 'adObjectIDs must be a non-empty array' });
    }

    try {
        const results = await Promise.all(adObjectIDs.map(async (adObjectID) => {
            const params = [adObjectID];
            const result = await serverPowerShellScript(scriptPath, params);
            return { adObjectID, result };
        }));

        res.json(results); // Return the results as a JSON array
    } catch (error) {
        logger.error('Error executing PowerShell script:', error);
        res.status(500).json({ error: 'Failed to fetch AD objects' });
    }
});

module.exports = router;