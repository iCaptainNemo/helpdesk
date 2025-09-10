const path = require('path');
const { serverPowerShellScript } = require('../powershell');
const db = require('../db/init');
const logger = require('../utils/logger');

const scriptPath = path.join(__dirname, '../functions/LockedOutList.ps1');

async function clearLockedOutUsers() {
    try {
        const stmt = db.prepare('DELETE FROM LockedOutUsers');
        stmt.run();
        logger.info('Locked out users table cleared - no active lockouts');
    } catch (err) {
        logger.error('Failed to clear locked out users:', err);
        throw err;
    }
}

async function updateLockedOutUsers() {
    try {
        // Get locked out users from PowerShell
        let lockedOutUsers = await serverPowerShellScript(scriptPath);

        // Handle no output or empty results
        if (!lockedOutUsers) {
            logger.info('No locked out users found - clearing table');
            await clearLockedOutUsers();
            return;
        }

        // Parse JSON if string response
        if (typeof lockedOutUsers === 'string') {
            try {
                lockedOutUsers = JSON.parse(lockedOutUsers);
            } catch (e) {
                logger.error('Failed to parse PowerShell output:', e);
                await clearLockedOutUsers();
                return;
            }
        }

        // Ensure array format and handle empty results
        if (!Array.isArray(lockedOutUsers)) {
            lockedOutUsers = [lockedOutUsers].filter(Boolean);
        }

        if (lockedOutUsers.length === 0) {
            await clearLockedOutUsers();
            return;
        }

        // Database operations with transaction
        const transaction = db.transaction(() => {
            try {
                // Get current locked out users
                const stmt = db.prepare('SELECT UserID FROM LockedOutUsers');
                const rows = stmt.all();
                
                const currentLockedOutUsers = new Set(rows.map(row => row.UserID));
                const newLockedOutUsers = new Set(lockedOutUsers.map(user => user.SamAccountName));

                // Remove unlocked users
                const deleteStmt = db.prepare('DELETE FROM LockedOutUsers WHERE UserID = ?');
                for (const userID of currentLockedOutUsers) {
                    if (!newLockedOutUsers.has(userID)) {
                        deleteStmt.run(userID);
                    }
                }

                // Update/Insert locked users
                const insertStmt = db.prepare(`
                    INSERT INTO LockedOutUsers (UserID, Name, Department, AccountLockoutTime)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(UserID) DO UPDATE SET
                        Name = excluded.Name,
                        Department = excluded.Department,
                        AccountLockoutTime = excluded.AccountLockoutTime
                `);

                for (const user of lockedOutUsers) {
                    insertStmt.run(
                        user.SamAccountName,
                        user.Name,
                        user.Department,
                        user.AccountLockoutTime
                    );
                }

                logger.info(`Updated locked out users table with ${lockedOutUsers.length} entries`);
            } catch (err) {
                logger.error('Error during database update:', err);
                throw err;
            }
        });
        
        transaction();
    } catch (err) {
        logger.error('Failed to update locked out users:', err);
        await clearLockedOutUsers();
        // Don't throw error, just log it
        logger.warn('Cleared table due to error, will retry on next update cycle');
    }
}

module.exports = {
    updateLockedOutUsers
};