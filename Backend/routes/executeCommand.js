const express = require('express');
const router = express.Router();
const { executePowerShellCommand } = require('../powershell');
const logger = require('../utils/logger'); // Import the logger module
const verifyToken = require('../middleware/verifyToken');

router.post('/', verifyToken, async (req, res) => {
    const { command } = req.body;

    logger.verbose(`Received request to execute command: ${command}`);

    try {
        const result = await executePowerShellCommand(command);
        logger.verbose(`Command executed successfully: ${result}`);

        // Ensure a response is always sent back
        if (!result) {
            res.status(200).json({ message: 'Command executed successfully, but no output was produced.' });
        } else {
            res.send(result);
        }
    } catch (error) {
        logger.error(`Error executing PowerShell command: ${error}`);
        res.status(500).json({ error: 'Failed to execute command' });
    }
});

module.exports = router;