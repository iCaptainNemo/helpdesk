const express = require('express');
const router = express.Router();
const { serverPowerShellScript } = require('../powershell');
const logger = require('../utils/logger'); // Import the logger module
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

// Define the path to the PowerShell script
const scriptPath = path.join(__dirname, '../functions/Get-Logs.ps1');

// Hardcoded log file path for testing
const logFilePath = '\\\\hssserver037\\login-tracking\\';

// Route to get logs
router.post('/', async (req, res) => {
    try {
        const { currentADObjectID } = req.body;

        // Log the parameters being sent to the PowerShell script
        logger.info(`Executing PowerShell script with logFilePath: ${logFilePath} With ADObjectID: ${currentADObjectID}`);

        // Execute the PowerShell script with the log file path and currentADObjectID as arguments
        const result = await serverPowerShellScript(scriptPath, [logFilePath, currentADObjectID]);
        
        // Log the raw result from the PowerShell script
        logger.info('Raw result from PowerShell script:', result);

        // Check if the result contains valid JSON
        let parsedResult;
        try {
            parsedResult = JSON.parse(result);
        } catch (jsonError) {
            logger.error('JSON parse error:', jsonError);
            return res.status(500).json({ error: 'Failed to parse logs' });
        }
        
        // Log the parsed result
        //logger.info('Logs fetched successfully for:', currentADObjectID);
        
        // Send the result as JSON
        res.json(parsedResult);
    } catch (error) {
        logger.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

module.exports = router;