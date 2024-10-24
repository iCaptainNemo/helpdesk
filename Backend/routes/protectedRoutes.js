const express = require('express');
const router = express.Router();
const checkSession = require('../middleware/checkSession');
const logger = require('../utils/logger'); // Import the logger module
const getLogs = require('./getLogs');
const updateLockedOutUsers = require('./updateLockedOutUsers');
const getLockedOutUsers = require('./getLockedOutUsers');
const checkSessionRoute = require('./checkSession');

// Apply the checkSession middleware to all routes in this router
router.use(checkSession);

// Protected routes
router.use('/get-logs', getLogs);
router.use('/update-locked-out-users', updateLockedOutUsers);
router.use('/get-locked-out-users', getLockedOutUsers);
router.use('/check-session', checkSessionRoute);


module.exports = router;