const express = require('express');
const router = express.Router();
const { executePowerShellScript } = require('../powershell');

router.post('/fetch-user', async (req, res) => {
    const userID = req.body.userID.toUpperCase();
    const scriptPath = './functions/Manage-User.ps1';
    const params = {
        dbPath: req.dbPath, // Use dbPath from request object
        userID: userID,
        functionName: 'Fetch-User'
    };

    try {
        const userProperties = await executePowerShellScript(scriptPath, params);
        res.render('user-properties', { userProperties });
    } catch (error) {
        console.error(error);
        res.send(`Error: ${error}`);
    }
});

module.exports = router;