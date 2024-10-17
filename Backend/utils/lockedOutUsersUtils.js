const path = require('path');
const { executePowerShellScript } = require('../powershell');
const db = require('../db/init');
const { log, info, warn, error } = require('../utils/logger'); 

const scriptPath = path.join(__dirname, '../functions/LockedOutList.ps1');

async function updateLockedOutUsers() {
    try {
        const lockedOutUsers = await executePowerShellScript(scriptPath);

        // Check if lockedOutUsers is an empty array
        if (Array.isArray(lockedOutUsers) && lockedOutUsers.length === 0) {
            // Clear the LockedOutUsers table
            db.run('DELETE FROM LockedOutUsers', (err) => {
                if (err) {
                    error('Failed to clear locked out users:', err);
                } else {
                    info('Locked out users table cleared.');
                }
            });
            return;
        }

        // Start a transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Get the current locked out users from the database
            db.all('SELECT UserID FROM LockedOutUsers', (err, rows) => {
                if (err) {
                    error('Failed to fetch locked out users:', err);
                    return;
                }

                const currentLockedOutUsers = new Set(rows.map(row => row.UserID));
                const newLockedOutUsers = new Set(lockedOutUsers.map(user => user.SamAccountName));

                // Remove users who are no longer locked out
                currentLockedOutUsers.forEach(userID => {
                    if (!newLockedOutUsers.has(userID)) {
                        db.run('DELETE FROM LockedOutUsers WHERE UserID = ?', userID);
                    }
                });

                // Insert or update the new locked out users
                const insertStmt = db.prepare(`
                    INSERT INTO LockedOutUsers (UserID, Name, Department, AccountLockoutTime)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(UserID) DO UPDATE SET
                        Name = excluded.Name,
                        Department = excluded.Department,
                        AccountLockoutTime = excluded.AccountLockoutTime
                `);

                lockedOutUsers.forEach(user => {
                    insertStmt.run(user.SamAccountName, user.Name, user.Department, user.AccountLockoutTime);
                });

                insertStmt.finalize();

                // Commit the transaction
                db.run('COMMIT');
            });
        });

        info('Locked out users updated successfully.');
    } catch (error) {
        error('Failed to update locked out users:', error);
    }
}

module.exports = {
    updateLockedOutUsers
};