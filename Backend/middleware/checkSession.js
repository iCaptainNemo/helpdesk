const sessionStore = require('../utils/sessionStore');
const logger = require('../utils/logger'); // Import the logger module

/**
 * Middleware to check if a session exists for the user.
 * If no session is found, the user is logged out.
 */
function checkSession(req, res, next) {
    const sessionID = req.sessionID;

    if (!sessionID) {
        logger.warn('No session ID found in request.');
        return res.status(401).json({ error: 'No session found. Please log in.' });
    }

    sessionStore.get(sessionID, (err, session) => {
        if (err || !session) {
            logger.warn(`No session found for session ID: ${sessionID}`);
            return res.status(401).json({ error: 'No session found. Please log in again.' });
        }

        // Check if the session has expired
        if (session.cookie.expires && new Date(session.cookie.expires) < new Date()) {
            logger.warn(`Session expired for session ID: ${sessionID}`);
            return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }

        // Log session details for debugging
        logger.info(`Session found for session ID: ${sessionID}`, session);

        // Session exists, proceed to the next middleware or route handler
        next();
    });
}

module.exports = checkSession;