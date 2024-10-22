const express = require('express');
const router = express.Router();
const { executePowerShellScript } = require('../powershell');
const sessionStore = require('../utils/sessionStore');
const logger = require('../utils/logger'); 
const verifyToken = require('../middleware/verifyToken');

router.post('/', verifyToken, async (req, res) => {
    const { scriptName, params, sessionID } = req.body; // Remove adminComputer from the request body
    const scriptPath = `./functions/${scriptName}.ps1`;

    logger.info(`Received request to execute script: ${scriptName} with params: ${JSON.stringify(params)} and sessionID: ${sessionID}`);

    if (!sessionID) {
        logger.error('No session ID provided');
        return res.status(400).json({ error: 'No session ID provided' });
    }

    sessionStore.get(sessionID, async (err, session) => {
        if (err) {
            logger.error(`Failed to retrieve session: ${err}`);
            return res.status(500).json({ error: 'Failed to retrieve session' });
        }

        if (!session) {
            logger.error('Session not found');
            return res.status(500).json({ error: 'Session not found' });
        }

        const { adminComputer } = session; // Fetch adminComputer from the session

        try {
            const result = await executePowerShellScript(scriptPath, [params.userID, adminComputer], session.powershellSession); // Pass adminComputer to the script
            logger.info(`Script executed successfully: ${result}`);
            res.json(result);
        } catch (error) {
            logger.error(`Error executing PowerShell script: ${error}`);
            res.status(500).json({ error: error.message });
        }
    });
});

module.exports = router;