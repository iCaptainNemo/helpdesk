const express = require('express');
const router = express.Router();
const UpdateChecker = require('../utils/updateChecker');
const logger = require('../utils/logger');

const updateChecker = new UpdateChecker();

// Check for application updates
router.get('/check', async (req, res) => {
    try {
        logger.info('Checking for updates via API');
        
        const includePrerelease = req.query.prerelease === 'true';
        const updateInfo = await updateChecker.checkForUpdates(includePrerelease);
        
        res.json(updateInfo);
    } catch (error) {
        logger.error('Error checking for updates via API:', error);
        res.status(500).json({
            error: 'Failed to check for updates',
            message: error.message
        });
    }
});

// Get current application version
router.get('/version', (req, res) => {
    try {
        const { version } = require('../../package.json');
        res.json({
            version: version,
            buildTime: process.env.BUILD_TIME || 'unknown'
        });
    } catch (error) {
        logger.error('Error getting version:', error);
        res.status(500).json({
            error: 'Failed to get version information'
        });
    }
});

// Get release notes for a specific version
router.get('/release-notes/:version', async (req, res) => {
    try {
        const { version } = req.params;
        logger.info(`Fetching release notes for version: ${version}`);
        
        const releaseNotes = await updateChecker.getReleaseNotes(version);
        
        res.json({
            version: version,
            releaseNotes: releaseNotes
        });
    } catch (error) {
        logger.error('Error fetching release notes:', error);
        res.status(500).json({
            error: 'Failed to fetch release notes',
            message: error.message
        });
    }
});

// Get update status summary
router.get('/status', async (req, res) => {
    try {
        const status = await updateChecker.getUpdateStatus();
        res.json({
            status: status,
            lastCheck: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error getting update status:', error);
        res.status(500).json({
            error: 'Failed to get update status',
            message: error.message
        });
    }
});

module.exports = router;