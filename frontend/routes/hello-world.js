const express = require('express');
const router = express.Router();
const { executePowerShellScript } = require('../powershell');

router.post('/test', async (req, res) => {
    const scriptPath = './functions/hello-world.ps1';

    try {
        const output = await executePowerShellScript(scriptPath);
        res.render('index', { testOutput: output });
    } catch (error) {
        console.error(error);
        res.render('index', { testOutput: `Error: ${error}` });
    }
});

module.exports = router;