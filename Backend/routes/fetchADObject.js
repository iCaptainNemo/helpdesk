const express = require('express');
const router = express.Router();
const path = require('path');
const { serverPowerShellScript } = require('../powershell');
const sanitizeInput = require('../middleware/sanitizeInput');

router.post('/', sanitizeInput, async (req, res) => {
    const adObjectID = req.body.adObjectID.toUpperCase();
    const exact = req.body.exact === true || req.body.exact === 'true';
    const scriptPath = process.pkg
        ? path.join(process.cwd(), 'functions', 'Get-ADObject.ps1')
        : path.join(__dirname, '../functions/Get-ADObject.ps1');
    // Positional args: <objectID> [exact]. 'exact' resolves a specific pick to a single object.
    const params = exact ? [adObjectID, 'exact'] : [adObjectID];

    try {
        const adObjectProperties = await serverPowerShellScript(scriptPath, params);
        res.json(adObjectProperties); // Return the AD object properties as JSON
    } catch (error) {
        console.error('Error executing PowerShell script:', error);
        res.status(500).json({ error: error.message }); // Return error as JSON
    }
});

module.exports = router;