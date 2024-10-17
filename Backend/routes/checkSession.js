const express = require('express');
const router = express.Router();
const sessionStore = require('../utils/sessionStore');
const logger = require('../utils/logger'); // Import the logger

router.get('/', (req, res) => {
    sessionStore.all((err, sessions) => {
        if (err) {
            logger.error(`Failed to retrieve sessions: ${err}`);
            return res.status(500).json({ error: 'Failed to retrieve sessions' });
        }

        res.json(sessions);
    });
});

module.exports = router;