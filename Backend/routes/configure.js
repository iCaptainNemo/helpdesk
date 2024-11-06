const express = require('express');
const router = express.Router();
const logger = require('../utils/logger'); 

router.get('/', (req, res) => {
    logger.info(`User ${req.user.AdminID} accessed the configure page`);
    res.json({ message: 'Welcome to the configure page!' });
});

module.exports = router;