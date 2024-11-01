const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const verifyPermissions = require('../middleware/verifyPermissions');

// Apply the verifyToken and verifyPermissions middleware
router.get('/', verifyToken, verifyPermissions('access_configure_page'), (req, res) => {
    res.json({ message: 'Welcome to the configure page!' });
});

module.exports = router;