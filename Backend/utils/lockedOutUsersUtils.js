const path = require('path');
const { serverPowerShellScript } = require('../powershell');
const db = require('../db/init');
const logger = require('../utils/logger');

const scriptPath = path.join(__dirname, '../functions/LockedOutList.ps1');

async function clearLockedOutUsers() {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM LockedOutUsers', (err) => {
            if (err) {
                logger.error('Failed to clear locked out users:', err);
                reject(err);
            } else {
                logger.info('Locked out users table cleared - no active lockouts');
                resolve();
            }
        });
    });
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

        // Database operations
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION', async (err) => {
                    if (err) {
                        logger.error('Failed to begin transaction:', err);
                        reject(err);
                        return;
                    }

                    try {
                        // Get current locked out users
                        const rows = await new Promise((res, rej) => {
                            db.all('SELECT UserID FROM LockedOutUsers', (err, rows) => {
                                if (err) rej(err);
                                else res(rows);
                            });
                        });

                        const currentLockedOutUsers = new Set(rows.map(row => row.UserID));
                        const newLockedOutUsers = new Set(lockedOutUsers.map(user => user.SamAccountName));

                        // Remove unlocked users
                        for (const userID of currentLockedOutUsers) {
                            if (!newLockedOutUsers.has(userID)) {
                                await new Promise((res, rej) => {
                                    db.run('DELETE FROM LockedOutUsers WHERE UserID = ?', userID, (err) => {
                                        if (err) rej(err);
                                        else res();
                                    });
                                });
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
                            await new Promise((res, rej) => {
                                insertStmt.run(
                                    user.SamAccountName,
                                    user.Name,
                                    user.Department,
                                    user.AccountLockoutTime,
                                    (err) => {
                                        if (err) rej(err);
                                        else res();
                                    }
                                );
                            });
                        }

                        insertStmt.finalize();

                        // Commit transaction
                        db.run('COMMIT', (err) => {
                            if (err) {
                                logger.error('Failed to commit transaction:', err);
                                db.run('ROLLBACK');
                                reject(err);
                            } else {
                                logger.info(`Updated locked out users table with ${lockedOutUsers.length} entries`);
                                resolve();
                            }
                        });
                    } catch (err) {
                        logger.error('Error during update:', err);
                        db.run('ROLLBACK');
                        reject(err);
                    }
                });
            });
        });
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