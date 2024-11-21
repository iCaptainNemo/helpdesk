const express = require('express');
const router = express.Router();
const config = require('../utils/config'); // Import the configuration object
const logger = require('../utils/logger'); // Import the logger module

// Route to get the current logging settings
router.get('/', (req, res) => {
    res.json(config.logging);
});

// Route to update the logging settings
router.post('/', (req, res) => {
    const { debug, verbose } = req.body;
    if (typeof debug !== 'undefined') {
        config.logging.debug = debug;
        if (debug) {
            logger.info('Debug logging has been enabled.');
        } else {
            logger.info('Debug logging has been disabled.');
        }
    }
    if (typeof verbose !== 'undefined') {
        config.logging.verbose = verbose;
        if (verbose) {
            logger.info('Verbose logging has been enabled.');
        } else {
            logger.info('Verbose logging has been disabled.');
        }
    }
    res.json(config.logging);
});

module.exports = router;