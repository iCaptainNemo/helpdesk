const express = require('express');
const router = express.Router();
const path = require('path'); // Import the path module
const { executePowerShellScript } = require('../powershell');

router.post('/', async (req, res) => { // Changed to POST method
    const scriptPath = path.join(__dirname, '../functions/hello-world.ps1');

    try {
        const output = await executePowerShellScript(scriptPath);
        // Ensure the output is a string and parse the JSON
        const outputString = typeof output === 'string' ? output : JSON.stringify(output);
        const jsonOutput = JSON.parse(outputString.trim());
        res.json(jsonOutput); // Return the parsed JSON output
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;