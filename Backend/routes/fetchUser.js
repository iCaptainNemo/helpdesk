const express = require('express');
const router = express.Router();
const { storeUser, fetchUser } = require('../db/queries'); // Import the functions

// Route to store a user
router.post('/store-user', async (req, res) => {
    const user = req.body;
    try {
        await storeUser(user);
        res.status(200).json({ message: 'User stored successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to fetch a user by userID
router.post('/fetch-user', async (req, res) => {
    const { userID } = req.body;
    try {
        let user = await fetchUser(userID);
        if (!user) {
            // If user does not exist, create the user
            const newUser = {
                UserID: userID,
                LastHelped: null,
                TimesUnlocked: 0,
                PasswordResets: 0
            };
            await storeUser(newUser);
            user = await fetchUser(userID); // Fetch the newly created user
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;