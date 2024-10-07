const express = require('express');
const router = express.Router();
const { executePowerShellScript } = require('../powershell');
const sanitizeInput = require('../middleware/sanitizeInput');

router.post('/', sanitizeInput, async (req, res) => { // Changed to '/'
    const adObjectID = req.body.adObjectID.toUpperCase();
    const scriptPath = './functions/Get-ADObject.ps1';
    const params = [adObjectID]; // Pass adObjectID as a positional argument

    try {
        const adObjectProperties = await executePowerShellScript(scriptPath, params);
        res.send(`<pre>${adObjectProperties}</pre>`); // Return only the AD object properties
    } catch (error) {
        console.error('Error executing PowerShell script:', error);
        res.status(500).send(`Error: ${error.message}`);
    }
});

module.exports = router;