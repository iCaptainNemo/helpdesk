const path = require('path');
const { serverPowerShellScript } = require('../powershell');
const db = require('../db/init');
const logger = require('../utils/logger'); // Import the logger module
const { insertServer, updateServer, deleteServer, fetchServer, fetchAllServers } = require('../db/queries');

const scriptPath = path.join(__dirname, '../functions/Get-ServerStatus.ps1');

async function getServerStatuses() {
    try {
        // Fetch all servers from the database
        const servers = await fetchAllServers();
        const serverNames = servers.map(server => server.ServerName);

        // Execute the PowerShell script to get the server statuses
        const serverStatuses = await serverPowerShellScript(scriptPath, serverNames);
        logger.info('Server statuses fetched successfully.');

        // Ensure serverStatuses is an array
        const statusesArray = Array.isArray(serverStatuses) ? serverStatuses : [serverStatuses];

        // Start a transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Prepare the SQL statement for updating server statuses
            const updateStmt = db.prepare(`
                UPDATE Servers
                SET Status = ?, FileShareService = ?, OnlineTime = ?, OfflineTime = ?
                WHERE ServerName = ?
            `);

            const currentTime = new Date();

            // Map through the server statuses and update the database
            const updatePromises = statusesArray.map(async server => {
                const existingServer = await fetchServer(server.ServerName);
                let onlineTime = existingServer.OnlineTime;
                let offlineTime = existingServer.OfflineTime;

                if (server.Status === 'Online') {
                    // Server is online
                    if (!onlineTime) {
                        // Set OnlineTime to current time if it is null
                        onlineTime = currentTime;
                    }
                    // Nullify OfflineTime
                    offlineTime = null;
                } else {
                    // Server is offline
                    if (!offlineTime) {
                        // Set OfflineTime to current time if it is null
                        offlineTime = currentTime;
                    }
                    // Nullify OnlineTime
                    onlineTime = null;
                }

                // Update the server status in the database
                return new Promise((resolve, reject) => {
                    updateStmt.run(
                        server.Status,
                        server.FileShareService,
                        onlineTime,
                        offlineTime,
                        server.ServerName,
                        (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        }
                    );
                });
            });

            // Execute all update promises
            Promise.all(updatePromises)
                .then(() => {
                    updateStmt.finalize();

                    // Commit the transaction
                    db.run('COMMIT', (err) => {
                        if (err) {
                            logger.error('Failed to commit transaction:', err);
                        } else {
                            logger.info('Server statuses updated in the database.');
                        }
                    });
                })
                .catch((err) => {
                    logger.error('Failed to update server statuses:', err);
                    db.run('ROLLBACK');
                });
        });

        return statusesArray;
    } catch (error) {
        logger.error(`Failed to get server statuses: ${error.message}`);
        throw error;
    }
}

module.exports = {
    insertServer,
    updateServer,
    deleteServer,
    fetchServer,
    fetchAllServers,
    getServerStatuses
};