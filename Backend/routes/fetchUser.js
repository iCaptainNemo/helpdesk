const express = require('express');
const router = express.Router();
const { storeUser, fetchUser, updateUserSecurityQuestion, fetchUserSecurityQuestion, clearUserSecurityQuestion, updateUserComment, incrementUserVote } = require('../db/queries'); // Import the functions
const logger = require('../utils/logger'); // Import the logger module
const verifyToken = require('../middleware/verifyToken');

// Route to fetch a user by adObjectID
router.post('/', async (req, res) => { // Ensure the path is '/'
    const { adObjectID } = req.body; // Updated to use adObjectID
    logger.debug('Received request to fetch user with ID:', adObjectID);
    try {
        let user = await fetchUser(adObjectID); // Updated to use adObjectID
        if (!user || user.length === 0) { // Check if user is null or an empty array
            logger.info(`User with ID ${adObjectID} not found. Creating new user.`);
            // If user does not exist, create the user
            const newUser = {
                UserID: adObjectID, // Updated to use adObjectID
                LastHelped: null,
                TimesUnlocked: 0,
                PasswordResets: 0,
                TimesHelped: 0, // Add TimesHelped field
                SecurityQuestion: null,
                SecurityAnswer: null
            };
            await storeUser(newUser);
            logger.info(`New user with ID ${adObjectID} created.`);
            user = await fetchUser(adObjectID); // Fetch the newly created user
        }
        logger.debug('Fetched user:', user);
        res.status(200).json(user);
    } catch (error) {
        logger.error('Error fetching user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to update a user by adObjectID
router.put('/update', async (req, res) => {
    const { adObjectID, updates } = req.body; // Expecting adObjectID and updates in the request body
    logger.debug('Received request to update user with ID:', adObjectID);
    try {
        let user = await fetchUser(adObjectID); // Fetch the user by adObjectID
        if (!user || user.length === 0) { // Check if user is null or an empty array
            logger.info(`User with ID ${adObjectID} not found.`);
            return res.status(404).json({ error: 'User not found' });
        }
        // Update the user with new values
        await storeUser({ UserID: adObjectID, ...updates });
        logger.info(`User with ID ${adObjectID} updated.`);
        user = await fetchUser(adObjectID); // Fetch the updated user
        logger.debug('Updated user:', user);
        res.status(200).json(user);
    } catch (error) {
        logger.error('Error updating user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to get security question for a user
router.get('/security-question/:userID', verifyToken, async (req, res) => {
    const { userID } = req.params;
    logger.debug('Received request to fetch security question for user:', userID);

    try {
        const securityData = await fetchUserSecurityQuestion(userID);
        logger.debug('Fetched security question:', securityData);
        res.status(200).json(securityData);
    } catch (error) {
        logger.error('Error fetching security question:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to update security question for a user
router.put('/security-question', verifyToken, async (req, res) => {
    const { userID, securityQuestion, securityAnswer } = req.body;
    logger.debug('Received request to update security question for user:', userID);

    if (!userID) {
        return res.status(400).json({ error: 'UserID is required' });
    }

    try {
        // Ensure user exists first
        let user = await fetchUser(userID);
        if (!user || user.length === 0) {
            logger.info(`User with ID ${userID} not found. Creating new user.`);
            const newUser = {
                UserID: userID,
                LastHelped: null,
                TimesUnlocked: 0,
                PasswordResets: 0,
                TimesHelped: 0,
                SecurityQuestion: securityQuestion || null,
                SecurityAnswer: securityAnswer || null
            };
            await storeUser(newUser);
        } else {
            // Update security question
            await updateUserSecurityQuestion(userID, securityQuestion || null, securityAnswer || null);
        }

        // Fetch updated security data
        const updatedSecurityData = await fetchUserSecurityQuestion(userID);
        logger.info(`Security question updated for user ${userID}`);
        res.status(200).json(updatedSecurityData);
    } catch (error) {
        logger.error('Error updating security question:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to clear security question for a user
router.delete('/security-question/:userID', verifyToken, async (req, res) => {
    const { userID } = req.params;
    logger.debug('Received request to clear security question for user:', userID);

    try {
        await clearUserSecurityQuestion(userID);
        logger.info(`Security question cleared for user ${userID}`);
        res.status(200).json({
            SecurityQuestion: null,
            SecurityAnswer: null,
            message: 'Security question cleared successfully'
        });
    } catch (error) {
        logger.error('Error clearing security question:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ensure a Users row exists before writing feedback to it
async function ensureUser(userID) {
    const existing = await fetchUser(userID);
    if (!existing || existing.length === 0) {
        await storeUser({
            UserID: userID,
            LastHelped: null,
            TimesUnlocked: 0,
            PasswordResets: 0,
            TimesHelped: 0
        });
    }
}

// Local (not UTC) calendar date as YYYY-MM-DD, used to enforce one vote per day
function localDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Route to update the free-text comment for a user
router.put('/comment', verifyToken, async (req, res) => {
    const { userID, comment } = req.body;
    if (!userID) {
        return res.status(400).json({ error: 'UserID is required' });
    }
    try {
        await ensureUser(userID);
        await updateUserComment(userID, comment ?? null);
        const rows = await fetchUser(userID);
        const user = Array.isArray(rows) ? rows[0] : rows;
        logger.info(`Comment updated for user ${userID}`);
        res.status(200).json(user);
    } catch (error) {
        logger.error('Error updating comment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to record a thumbs up/down vote (one vote per calendar day, enforced server-side)
router.post('/vote', verifyToken, async (req, res) => {
    const { userID, vote } = req.body;
    if (!userID || (vote !== 'up' && vote !== 'down')) {
        return res.status(400).json({ error: "UserID and vote ('up' or 'down') are required" });
    }
    try {
        await ensureUser(userID);
        const rows = await fetchUser(userID);
        const user = Array.isArray(rows) ? rows[0] : rows;
        const today = localDateString();

        if (user && user.LastVoteDate === today) {
            // Already voted today — return current state with 409 so the UI can reflect it
            return res.status(409).json({ error: 'Already voted today', ...user });
        }

        await incrementUserVote(userID, vote, today);
        const updatedRows = await fetchUser(userID);
        const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
        logger.info(`Recorded thumbs ${vote} for user ${userID}`);
        res.status(200).json(updated);
    } catch (error) {
        logger.error('Error recording vote:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;