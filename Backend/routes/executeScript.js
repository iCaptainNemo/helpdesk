const express = require('express');
const router = express.Router();
const path = require('path');
const { executePowerShellScript } = require('../powershell');
const logger = require('../utils/logger'); // Import the logger module
const verifyToken = require('../middleware/verifyToken');
const db = require('../db/init');

router.post('/', verifyToken, async (req, res) => {
    const { scriptName, params } = req.body;
    const scriptPath = process.pkg 
        ? path.join(process.cwd(), 'functions', `${scriptName}.ps1`)
        : path.join(__dirname, '../functions', `${scriptName}.ps1`);

    logger.verbose(`Received request to execute script: ${scriptName} with params: ${JSON.stringify(params)}`);

    try {
        // Format parameters for PowerShell script based on script type
        let psParams = [];
        if (scriptName === 'Unlocker' && params.userID) {
            psParams = ['-UserID', params.userID];
        } else if (params.userID) {
            psParams = [params.userID]; // fallback for other scripts
        }
        
        const result = await executePowerShellScript(scriptPath, psParams);
        logger.verbose(`Script executed successfully: ${JSON.stringify(result)}`);
        
        // Log action to RecentActions table if it's an unlock operation
        if (scriptName === 'Unlocker' && params.userID && req.user?.AdminID) {
            try {
                const insertQuery = `
                    INSERT INTO RecentActions (adminID, activity, target, action_type, details, result)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                
                const stmt = db.prepare(insertQuery);
                stmt.run(
                    req.user.AdminID,
                    `Unlocked user account: ${params.userID}`,
                    params.userID,
                    'unlock',
                    JSON.stringify({ userID: params.userID, scriptResult: result }),
                    'success'
                );
                
                logger.info(`[Actions] Logged unlock action: ${params.userID} by ${req.user.AdminID}`);
            } catch (logError) {
                logger.error('[Actions] Error logging unlock action:', logError);
                // Don't fail the request if logging fails
            }
        }
        
        res.json({ message: result });
    } catch (error) {
        logger.error(`Error executing PowerShell script: ${error}`);
        res.status(500).json({ error: 'Failed to execute script' });
    }
});

module.exports = router;