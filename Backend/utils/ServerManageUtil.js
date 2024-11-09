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
                SET Status = ?, FileShareService = ?, Downtime = ?, LastOnline = ?, BackOnline = ?
                WHERE ServerName = ?
            `);

            const currentTime = new Date();

            // Map through the server statuses and update the database
            const updatePromises = statusesArray.map(async server => {
                const existingServer = await fetchServer(server.ServerName);
                let downtime = null;
                let lastOnline = existingServer.LastOnline;
                let backOnline = existingServer.BackOnline;

                if (server.Status === 'Online') {
                    // Server is online
                    if (existingServer.Status !== 'Online') {
                        // Server was previously offline
                        if (lastOnline) {
                            // Set BackOnline time if LastOnline is set
                            backOnline = currentTime;
                            // Calculate downtime in minutes
                            downtime = Math.floor((currentTime - new Date(lastOnline)) / 60000);
                        }
                    } else {
                        // Check if the server has been online for 24 hours
                        if (backOnline && (currentTime - new Date(backOnline)) >= 24 * 60 * 60 * 1000) {
                            lastOnline = null;
                            backOnline = null;
                        }
                    }
                } else {
                    // Server is offline
                    if (existingServer.Status === 'Online') {
                        // Server was previously online
                        lastOnline = currentTime;
                    } else if (!lastOnline) {
                        // Set LastOnline time if it is null
                        lastOnline = currentTime;
                    }
                    if (lastOnline) {
                        // Calculate downtime in minutes
                        downtime = Math.floor((currentTime - new Date(lastOnline)) / 60000);
                    }
                    backOnline = null;
                }

                // Update the server status in the database
                return new Promise((resolve, reject) => {
                    updateStmt.run(
                        server.Status,
                        server.FileShareService,
                        downtime,
                        lastOnline,
                        backOnline,
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