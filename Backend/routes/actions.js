const express = require('express');
const router = express.Router();
const db = require('../db/init');
const logger = require('../utils/logger');
const verifyToken = require('../middleware/verifyToken');
const { cacheMiddleware } = require('../middleware/cache');

// Log a new action
router.post('/log', verifyToken, (req, res) => {
    try {
        const { activity, target, action_type, details, result } = req.body;
        const adminID = req.user?.AdminID; // Get admin ID from JWT token

        if (!adminID || !activity) {
            return res.status(400).json({ error: 'Admin authentication and activity are required' });
        }

        const insertQuery = `
            INSERT INTO RecentActions (adminID, activity, target, action_type, details, result)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const stmt = db.prepare(insertQuery);
        const actionResult = stmt.run(
            adminID,
            activity,
            target || null,
            action_type || null,
            details ? JSON.stringify(details) : null,
            result || 'success'
        );

        logger.info(`[Actions] Logged action: ${action_type} by ${adminID} - ${activity}`);
        
        res.json({ 
            success: true, 
            actionId: actionResult.lastInsertRowid,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('[Actions] Error logging action:', error);
        res.status(500).json({ error: 'Failed to log action' });
    }
});

// Get recent actions (last N actions, no date filtering for now)
router.get('/recent/:limit?', cacheMiddleware(60), (req, res) => {
    try {
        const limit = parseInt(req.params.limit) || 10;
        
        console.log(`[DEBUG] Recent actions endpoint hit with limit: ${limit}`);
        
        const query = `
            SELECT 
                ID,
                timestamp,
                adminID,
                activity,
                target,
                action_type,
                details,
                result
            FROM RecentActions 
            ORDER BY timestamp DESC
            LIMIT ?
        `;
        
        console.log(`[DEBUG] Executing query: ${query}`);
        console.log(`[DEBUG] Query params: [${limit}]`);
        
        const actions = db.prepare(query).all(limit);
        console.log(`[DEBUG] Raw actions from DB:`, actions);
        
        // Parse details JSON for each action
        const processedActions = actions.map(action => ({
            ...action,
            details: action.details ? JSON.parse(action.details) : null
        }));
        
        res.json(processedActions);
    } catch (error) {
        logger.error('[Actions] Error fetching recent actions:', error);
        res.status(500).json({ error: 'Failed to fetch recent actions' });
    }
});

// Get actions by admin
router.get('/by-admin/:adminID/:limit?', cacheMiddleware(60), (req, res) => {
    try {
        const { adminID } = req.params;
        const limit = parseInt(req.params.limit) || 10;
        
        const query = `
            SELECT 
                ID,
                timestamp,
                adminID,
                activity,
                target,
                action_type,
                details,
                result
            FROM RecentActions 
            WHERE adminID = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;
        
        const actions = db.prepare(query).all(adminID, limit);
        
        // Parse details JSON for each action
        const processedActions = actions.map(action => ({
            ...action,
            details: action.details ? JSON.parse(action.details) : null
        }));
        
        res.json(processedActions);
    } catch (error) {
        logger.error('[Actions] Error fetching actions by admin:', error);
        res.status(500).json({ error: 'Failed to fetch actions by admin' });
    }
});

// Get actions by type
router.get('/by-type/:action_type/:limit?', (req, res) => {
    try {
        const { action_type } = req.params;
        const limit = parseInt(req.params.limit) || 10;
        
        const query = `
            SELECT 
                ID,
                timestamp,
                adminID,
                activity,
                target,
                action_type,
                details,
                result
            FROM RecentActions 
            WHERE action_type = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;
        
        const actions = db.prepare(query).all(action_type, limit);
        
        // Parse details JSON for each action
        const processedActions = actions.map(action => ({
            ...action,
            details: action.details ? JSON.parse(action.details) : null
        }));
        
        res.json(processedActions);
    } catch (error) {
        logger.error('[Actions] Error fetching actions by type:', error);
        res.status(500).json({ error: 'Failed to fetch actions by type' });
    }
});

// Clean up old actions (keep last 30 days)
router.delete('/cleanup', (req, res) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();
        
        const deleteQuery = `DELETE FROM RecentActions WHERE timestamp < ?`;
        const result = db.prepare(deleteQuery).run(thirtyDaysAgo);
        
        logger.info(`[Actions] Cleaned up ${result.changes} old actions`);
        
        res.json({ 
            success: true, 
            deletedCount: result.changes,
            cutoffDate: thirtyDaysAgo
        });
    } catch (error) {
        logger.error('[Actions] Error cleaning up actions:', error);
        res.status(500).json({ error: 'Failed to cleanup actions' });
    }
});

// Clean up actions older than current day (daily cleanup)
router.delete('/cleanup-daily', (req, res) => {
    try {
        // Get start of current day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfDay = today.toISOString();
        
        const deleteQuery = `DELETE FROM RecentActions WHERE timestamp < ?`;
        const result = db.prepare(deleteQuery).run(startOfDay);
        
        logger.info(`[Actions] Daily cleanup: removed ${result.changes} old actions`);
        
        res.json({ 
            success: true, 
            deletedCount: result.changes,
            cutoffDate: startOfDay
        });
    } catch (error) {
        logger.error('[Actions] Error in daily cleanup:', error);
        res.status(500).json({ error: 'Failed to perform daily cleanup' });
    }
});

module.exports = router;