const express = require('express');
const router = express.Router();
const db = require('../db/init');
const logger = require('../utils/logger');
const { cacheMiddleware } = require('../middleware/cache');

// Get locked users over time from ledger
router.get('/locked-users-timeline/:hours', cacheMiddleware(60), (req, res) => {
    try {
        const hours = parseInt(req.params.hours) || 3;
        const timeLimit = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();
        
        const query = `
            SELECT 
                timestamp,
                department,
                COUNT(*) as count
            FROM LockedUsersLedger 
            WHERE timestamp >= ? AND status = 'locked'
            GROUP BY timestamp, department
            ORDER BY timestamp ASC
        `;
        
        const rows = db.prepare(query).all(timeLimit);
        
        // Process data for chart format
        const timestamps = [...new Set(rows.map(row => row.timestamp))];
        
        // Get departments ordered by their latest count (same as pie chart ordering)
        const deptCounts = {};
        rows.forEach(row => {
            if (!deptCounts[row.department]) {
                deptCounts[row.department] = 0;
            }
            deptCounts[row.department] += row.count;
        });
        
        // Sort departments by total count DESC to match pie chart ordering
        const departments = Object.keys(deptCounts).sort((a, b) => deptCounts[b] - deptCounts[a]);
        
        const chartData = {
            labels: timestamps.map(ts => new Date(ts).toLocaleTimeString()),
            datasets: departments.map((dept, index) => {
                const data = timestamps.map(timestamp => {
                    const dataPoint = rows.find(row => row.timestamp === timestamp && row.department === dept);
                    return dataPoint ? dataPoint.count : 0;
                });
                
                // Use exact same color wheel as pie chart for consistency
                const colorWheel = [
                    '#667eea',  // Primary blue
                    '#4bc0c0',  // Complementary teal
                    '#ff9f40',  // Triadic orange
                    '#ff6384',  // Triadic red-pink
                    '#9966ff',  // Split-complementary purple
                    '#36a2eb',  // Analogous light blue
                    '#10b981',  // Tetradic green
                    '#3b82f6',  // Analogous blue
                    '#764ba2',  // Split-complementary purple-blue
                    '#f59e0b',  // Tetradic yellow
                    '#e74c3c',  // Additional red
                    '#8e44ad',  // Additional purple
                    '#2ecc71',  // Additional green
                    '#f39c12',  // Additional orange
                    '#7a8694'   // Fallback grey
                ];
                const color = colorWheel[index % colorWheel.length];
                
                return {
                    label: dept || 'Unknown',
                    data: data,
                    borderColor: color,
                    backgroundColor: `${color}20`,
                    tension: 0.4,
                    fill: false
                };
            })
        };
        
        res.json(chartData);
    } catch (error) {
        logger.error('[Ledger] Error fetching locked users timeline:', error);
        res.status(500).json({ error: 'Failed to fetch locked users timeline' });
    }
});

// Get locked users by department from ledger
router.get('/locked-users-by-department', cacheMiddleware(60), (req, res) => {
    try {
        // Get the single most recent snapshot timestamp (same as current-locked-users)
        const latestTimestampQuery = `
            SELECT MAX(timestamp) as latest_timestamp
            FROM LockedUsersLedger
            WHERE status = 'locked'
        `;
        
        const latestResult = db.prepare(latestTimestampQuery).get();
        
        if (!latestResult || !latestResult.latest_timestamp) {
            return res.json([]);
        }
        
        // Use the same timestamp for all departments to ensure consistency
        const query = `
            SELECT 
                department,
                COUNT(*) as count
            FROM LockedUsersLedger
            WHERE timestamp = ? AND status = 'locked'
            GROUP BY department
            ORDER BY count DESC
        `;
        
        const rows = db.prepare(query).all(latestResult.latest_timestamp);
        
        res.json(rows.map(row => ({
            department: row.department || 'Unknown',
            count: row.count
        })));
    } catch (error) {
        logger.error('[Ledger] Error fetching locked users by department:', error);
        res.status(500).json({ error: 'Failed to fetch locked users by department' });
    }
});

// Get current locked users from ledger (most recent snapshot)
router.get('/current-locked-users', cacheMiddleware(60), (req, res) => {
    try {
        // Get the most recent snapshot
        const latestTimestampQuery = `
            SELECT MAX(timestamp) as latest_timestamp
            FROM LockedUsersLedger
            WHERE status = 'locked'
        `;
        
        const latestResult = db.prepare(latestTimestampQuery).get();
        
        if (!latestResult || !latestResult.latest_timestamp) {
            return res.json([]);
        }
        
        const query = `
            SELECT UserID, name, department, AccountLockoutTime
            FROM LockedUsersLedger
            WHERE timestamp = ? AND status = 'locked'
            ORDER BY AccountLockoutTime DESC
        `;
        
        const rows = db.prepare(query).all(latestResult.latest_timestamp);
        res.json(rows);
    } catch (error) {
        logger.error('[Ledger] Error fetching current locked users:', error);
        res.status(500).json({ error: 'Failed to fetch current locked users' });
    }
});

// Background service endpoint to update ledger
router.post('/update-snapshot', (req, res) => {
    try {
        const { lockedUsers } = req.body;
        const timestamp = new Date().toISOString();
        
        if (!Array.isArray(lockedUsers)) {
            return res.status(400).json({ error: 'lockedUsers must be an array' });
        }
        
        // Clear previous snapshots for this interval (keep last 24 hours)
        const cleanupTime = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();
        const cleanupQuery = `DELETE FROM LockedUsersLedger WHERE timestamp < ?`;
        db.prepare(cleanupQuery).run(cleanupTime);
        
        // Insert new snapshot
        const insertQuery = `
            INSERT INTO LockedUsersLedger 
            (timestamp, UserID, name, department, AccountLockoutTime, status)
            VALUES (?, ?, ?, ?, ?, 'locked')
        `;
        const insertStmt = db.prepare(insertQuery);
        
        let insertedCount = 0;
        lockedUsers.forEach(user => {
            try {
                insertStmt.run(
                    timestamp,
                    user.UserID,
                    user.name,
                    user.department,
                    user.AccountLockoutTime
                );
                insertedCount++;
            } catch (error) {
                logger.error(`[Ledger] Error inserting user ${user.UserID}:`, error);
            }
        });
        
        // Update department ledger
        const deptQuery = `
            INSERT INTO DepartmentLedger (timestamp, department, locked_count)
            SELECT ?, department, COUNT(*) as locked_count
            FROM LockedUsersLedger
            WHERE timestamp = ? AND status = 'locked'
            GROUP BY department
        `;
        db.prepare(deptQuery).run(timestamp, timestamp);
        
        logger.info(`[Ledger] Updated snapshot with ${insertedCount} locked users`);
        res.json({ 
            success: true, 
            timestamp: timestamp,
            insertedCount: insertedCount
        });
    } catch (error) {
        logger.error('[Ledger] Error updating snapshot:', error);
        res.status(500).json({ error: 'Failed to update snapshot' });
    }
});

module.exports = router;