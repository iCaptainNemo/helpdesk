const express = require('express');
const router = express.Router();
const { storeUser, fetchUser } = require('../db/queries'); // Import the functions
const logger = require('../utils/logger'); // Import the logger module

// Route to fetch a user by adObjectID
router.post('/', async (req, res) => { // Ensure the path is '/'
    const { adObjectID } = req.body; // Updated to use adObjectID
    logger.debug('Received request to fetch user with ID:', adObjectID);
    try {
        let user = await fetchUser(adObjectID); // Updated to use adObjectID
        if (!user) {
            logger.info(`User with ID ${adObjectID} not found. Creating new user.`);
            // If user does not exist, create the user
            const newUser = {
                UserID: adObjectID, // Updated to use adObjectID
                LastHelped: null,
                TimesUnlocked: 0,
                PasswordResets: 0
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

module.exports = router;