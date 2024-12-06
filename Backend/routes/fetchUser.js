const express = require('express');
const router = express.Router();
const { storeUser, fetchUser, updateUser } = require('../db/queries'); // Import the functions
const logger = require('../utils/logger'); // Import the logger module

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
        await updateUser(adObjectID, updates);
        logger.info(`User with ID ${adObjectID} updated.`);
        user = await fetchUser(adObjectID); // Fetch the updated user
        logger.debug('Updated user:', user);
        res.status(200).json(user);
    } catch (error) {
        logger.error('Error updating user:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;