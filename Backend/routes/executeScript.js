const express = require('express');
const router = express.Router();
const { executePowerShellScript } = require('../powershell');
const logger = require('../utils/logger'); 
const verifyToken = require('../middleware/verifyToken');

router.post('/', verifyToken, async (req, res) => {
    const { scriptName, params } = req.body;
    const scriptPath = `./functions/${scriptName}.ps1`;

    logger.info(`Received request to execute script: ${scriptName} with params: ${JSON.stringify(params)}`);

    try {
        const result = await executePowerShellScript(scriptPath, [params.userID]);
        logger.info(`Script executed successfully: ${result}`);
        res.json({ message: result });
    } catch (error) {
        logger.error(`Error executing PowerShell script: ${error}`);
        res.status(500).json({ error: 'Failed to execute script' });
    }
});

module.exports = router;