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

        // Mask passwords in the session data
        const maskedSessions = sessions.map(session => {
            if (session.powershellSession && session.powershellSession.password) {
                return {
                    ...session,
                    powershellSession: {
                        ...session.powershellSession,
                        password: '****' // Mask the password
                    }
                };
            }
            return session;
        });

        res.json(maskedSessions);
    });
});

module.exports = router;