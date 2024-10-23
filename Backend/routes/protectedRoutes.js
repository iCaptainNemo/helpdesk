const express = require('express');
const router = express.Router();
const checkSession = require('../middleware/checkSession');
const logger = require('../utils/logger'); // Import the logger module

// Apply the checkSession middleware to all routes in this router
router.use(checkSession);

// Example protected route
router.get('/protected-data', (req, res) => {
    res.json({ message: 'This is protected data.' });
});

module.exports = router;