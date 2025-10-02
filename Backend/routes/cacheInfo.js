const express = require('express');
const router = express.Router();
const { getCacheStats, clearCache } = require('../middleware/cache');
const verifyToken = require('../middleware/verifyToken');

// Get cache statistics (for monitoring and debugging)
router.get('/stats', verifyToken, (req, res) => {
    try {
        const stats = getCacheStats();
        res.json({
            success: true,
            cache: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting cache stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cache statistics'
        });
    }
});

// Clear cache (for admin use)
router.delete('/clear', verifyToken, (req, res) => {
    try {
        clearCache();
        res.json({
            success: true,
            message: 'Cache cleared successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear cache'
        });
    }
});

module.exports = router;