const express = require('express');
const router = express.Router();
const checkSession = require('../middleware/checkSession');
const logger = require('../utils/logger'); // Import the logger module
const updateLockedOutUsers = require('./updateLockedOutUsers');
const getLockedOutUsers = require('./getLockedOutUsers');
const checkSessionRoute = require('./checkSession');
const configureRoute = require('./configure'); // Import the configure route
const getLogsRoute = require('./getLogs'); // Import the get logs route

// Apply the checkSession middleware to all routes in this router
router.use(checkSession);

// Protected routes
router.use('/update-locked-out-users', updateLockedOutUsers);
router.use('/get-locked-out-users', getLockedOutUsers);
router.use('/check-session', checkSessionRoute);
router.use('/configure', configureRoute); // Add the configure route
router.use('/get-logs', getLogsRoute); // Add the get logs route

module.exports = router;