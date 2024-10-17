const express = require('express');
const router = express.Router();
const sessionStore = require('../utils/sessionStore');
const logger = require('../utils/logger');

router.post('/', (req, res) => {
    const { sessionID } = req.body;

    if (sessionID) {
        sessionStore.destroy(sessionID, (err) => {
            if (err) {
                logger.error('Failed to destroy session:', err);
                return res.status(500).json({ error: 'Failed to log out' });
            }

            logger.info(`Session destroyed: ${sessionID}`);
        });
    } else {
        logger.info('No session ID provided, proceeding with logout.');
    }

    res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;