const express = require('express');
const router = express.Router();
const path = require('path'); // Import the path module
const { executePowerShellScript } = require('../powershell');

router.post('/', async (req, res) => { // Changed to POST method
    const scriptPath = path.join(__dirname, '../functions/hello-world.ps1');

    try {
        const output = await executePowerShellScript(scriptPath);
        const jsonOutput = JSON.parse(output.trim()); // Parse the JSON output
        res.json(jsonOutput); // Return the parsed JSON output
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;