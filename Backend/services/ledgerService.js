const db = require('../db/init');
const logger = require('../utils/logger');

/**
 * Background service to populate the ledger tables
 * This runs periodically (every 5 minutes) as part of the backend server
 */

function updateLedger() {
    try {
        logger.info('[LedgerService] Starting ledger update...');
        
        // Fetch current locked users directly from database
        const lockedUsersQuery = `SELECT UserID, name, department, AccountLockoutTime FROM LockedOutUsers`;
        const lockedUsers = db.prepare(lockedUsersQuery).all();
        
        logger.info(`[LedgerService] Found ${lockedUsers.length} locked users`);
        
        const timestamp = new Date().toISOString();
        
        // Clear old snapshots (keep last 24 hours)
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
                logger.error(`[LedgerService] Error inserting user ${user.UserID}:`, error);
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
        
        logger.info(`[LedgerService] Ledger updated successfully. Inserted ${insertedCount} records at ${timestamp}`);
        
        return {
            success: true,
            timestamp: timestamp,
            insertedCount: insertedCount
        };
    } catch (error) {
        logger.error('[LedgerService] Error updating ledger:', error);
        throw error;
    }
}

// Start the periodic ledger update service
function startLedgerService() {
    logger.info('[LedgerService] Starting periodic ledger service (5 minute intervals)');
    
    // Run immediately
    try {
        updateLedger();
    } catch (error) {
        logger.error('[LedgerService] Initial ledger update failed:', error);
    }
    
    // Set up interval (5 minutes = 300000ms)
    const interval = setInterval(() => {
        try {
            updateLedger();
        } catch (error) {
            logger.error('[LedgerService] Scheduled ledger update failed:', error);
        }
    }, 300000);
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        logger.info('[LedgerService] Stopping ledger service...');
        clearInterval(interval);
    });
    
    process.on('SIGINT', () => {
        logger.info('[LedgerService] Stopping ledger service...');
        clearInterval(interval);
    });
    
    return interval;
}

module.exports = { updateLedger, startLedgerService };