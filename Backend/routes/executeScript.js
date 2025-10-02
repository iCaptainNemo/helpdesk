const express = require('express');
const router = express.Router();
const path = require('path');
const { executePowerShellScript } = require('../powershell');
const logger = require('../utils/logger'); // Import the logger module
const verifyToken = require('../middleware/verifyToken');
const db = require('../db/init');
const { incrementUserUnlockCount, incrementUserPasswordResetCount } = require('../db/queries');

router.post('/', verifyToken, async (req, res) => {
    const { scriptName, params } = req.body;
    const scriptPath = process.pkg 
        ? path.join(process.cwd(), 'functions', `${scriptName}.ps1`)
        : path.join(__dirname, '../functions', `${scriptName}.ps1`);

    logger.verbose(`Received request to execute script: ${scriptName} with params: ${JSON.stringify(params)}`);

    try {
        // Format parameters for PowerShell script - convert object params to array
        let psParams = [];
        if (params && typeof params === 'object') {
            // Convert params object to PowerShell parameter array
            for (const [key, value] of Object.entries(params)) {
                if (value !== null && value !== undefined) {
                    psParams.push(`-${key}`, value.toString());
                }
            }
        }
        
        const result = await executePowerShellScript(scriptPath, psParams);
        logger.verbose(`Script executed successfully: ${JSON.stringify(result)}`);
        
        // Log action to RecentActions table and update user stats for unlock operations
        if (scriptName === 'Unlocker' && params.userID && req.user?.AdminID) {
            try {
                // Log to RecentActions table
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

                // Update user stats including LastAdminHelped
                await incrementUserUnlockCount(params.userID, req.user.AdminID);

                logger.info(`[Actions] Logged unlock action and updated user stats: ${params.userID} by ${req.user.AdminID}`);
            } catch (logError) {
                logger.error('[Actions] Error logging unlock action or updating user stats:', logError);
                // Don't fail the request if logging fails
            }
        }

        // Handle password reset operations
        if (scriptName === 'PasswordResetter' && params.userID && req.user?.AdminID) {
            try {
                // Log to RecentActions table
                const insertQuery = `
                    INSERT INTO RecentActions (adminID, activity, target, action_type, details, result)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;

                const stmt = db.prepare(insertQuery);
                stmt.run(
                    req.user.AdminID,
                    `Reset password for user: ${params.userID}`,
                    params.userID,
                    'reset_password',
                    JSON.stringify({ userID: params.userID, scriptResult: result }),
                    'success'
                );

                // Update user stats including LastAdminHelped
                await incrementUserPasswordResetCount(params.userID, req.user.AdminID);

                logger.info(`[Actions] Logged password reset action and updated user stats: ${params.userID} by ${req.user.AdminID}`);
            } catch (logError) {
                logger.error('[Actions] Error logging password reset action or updating user stats:', logError);
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