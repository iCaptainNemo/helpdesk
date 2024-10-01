const express = require('express');
const router = express.Router();
const { executePowerShellScript } = require('../powershell');

router.post('/fetch-user', async (req, res) => {
    const userID = req.body.userID.toUpperCase();
    const scriptPath = './functions/Get-ADObject.ps1';
    const params = [userID]; // Pass userID as a positional argument

    try {
        const userProperties = await executePowerShellScript(scriptPath, params);
        res.render('index', { userProperties });
    } catch (error) {
        console.error(error);
        res.send(`Error: ${error}`);
    }
});

module.exports = router;