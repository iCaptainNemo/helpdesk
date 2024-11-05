const express = require('express');
const router = express.Router();
const { updateLockedOutUsers } = require('../utils/lockedOutUsersUtils');
const logger = require('../utils/logger');

router.post('/', async (req, res) => {
    try {
        await updateLockedOutUsers();
        logger.verbose('Locked out users updated successfully');
        res.status(200).send('Locked out users updated successfully');
    } catch (error) {
        logger.error('Failed to update locked out users:', error);
        res.status(500).send('Failed to update locked out users.');
    }
});

module.exports = router;