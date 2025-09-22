const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { insertServer } = require('../db/queries');

// Test endpoint to populate sample data
router.post('/populate-sample-data', async (req, res) => {
    try {
        // Clear existing data
        db.exec('DELETE FROM LockedOutUsers');
        db.exec('DELETE FROM Servers');

        // Insert sample locked out users
        const sampleLockedUsers = [
            {
                UserID: 'john.doe',
                name: 'John Doe',
                department: 'IT',
                AccountLockoutTime: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
            },
            {
                UserID: 'jane.smith',
                name: 'Jane Smith', 
                department: 'HR',
                AccountLockoutTime: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
            },
            {
                UserID: 'bob.wilson',
                name: 'Bob Wilson',
                department: 'Finance',
                AccountLockoutTime: new Date(Date.now() - 45 * 60 * 1000).toISOString() // 45 minutes ago
            },
            {
                UserID: 'alice.brown',
                name: 'Alice Brown',
                department: 'IT',
                AccountLockoutTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
            },
            {
                UserID: 'charlie.davis',
                name: 'Charlie Davis',
                department: 'Sales',
                AccountLockoutTime: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() // 5 hours ago
            },
            {
                UserID: 'diana.miller',
                name: 'Diana Miller',
                department: 'Marketing',
                AccountLockoutTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
            },
            {
                UserID: 'frank.jones',
                name: 'Frank Jones',
                department: 'HR',
                AccountLockoutTime: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() // 8 hours ago
            }
        ];

        const insertUserStmt = db.prepare(`
            INSERT INTO LockedOutUsers (UserID, name, department, AccountLockoutTime) 
            VALUES (?, ?, ?, ?)
        `);

        for (const user of sampleLockedUsers) {
            insertUserStmt.run(user.UserID, user.name, user.department, user.AccountLockoutTime);
        }

        // Insert sample servers
        const sampleServers = [
            {
                ServerName: 'DC01',
                Description: 'Primary Domain Controller',
                Status: 'Online',
                Location: 'Data Center 1',
                FileShareService: null,
                OnlineTime: new Date().toISOString(),
                OfflineTime: null
            },
            {
                ServerName: 'DC02',
                Description: 'Secondary Domain Controller',
                Status: 'Online',
                Location: 'Data Center 2', 
                FileShareService: null,
                OnlineTime: new Date().toISOString(),
                OfflineTime: null
            },
            {
                ServerName: 'FILE01',
                Description: 'File Server 1',
                Status: 'Warning',
                Location: 'Data Center 1',
                FileShareService: 'Running',
                OnlineTime: new Date().toISOString(),
                OfflineTime: null
            },
            {
                ServerName: 'FILE02',
                Description: 'File Server 2',
                Status: 'Offline',
                Location: 'Data Center 2',
                FileShareService: 'Stopped',
                OnlineTime: null,
                OfflineTime: new Date(Date.now() - 30 * 60 * 1000).toISOString()
            },
            {
                ServerName: 'PRINT01',
                Description: 'Print Server',
                Status: 'Online',
                Location: 'Office',
                FileShareService: null,
                OnlineTime: new Date().toISOString(),
                OfflineTime: null
            },
            {
                ServerName: 'EXCHANGE01',
                Description: 'Exchange Server',
                Status: 'Online',
                Location: 'Data Center 1',
                FileShareService: null,
                OnlineTime: new Date().toISOString(),
                OfflineTime: null
            }
        ];

        for (const server of sampleServers) {
            await insertServer(server);
        }

        res.json({ 
            message: 'Sample data populated successfully',
            lockedUsers: sampleLockedUsers.length,
            servers: sampleServers.length
        });

    } catch (error) {
        console.error('Error populating sample data:', error);
        res.status(500).json({ error: 'Failed to populate sample data' });
    }
});

// Test endpoint to clear all data
router.post('/clear-all-data', (req, res) => {
    try {
        db.exec('DELETE FROM LockedOutUsers');
        db.exec('DELETE FROM Servers');
        res.json({ message: 'All test data cleared successfully' });
    } catch (error) {
        console.error('Error clearing data:', error);
        res.status(500).json({ error: 'Failed to clear data' });
    }
});

module.exports = router;