const path = require('path');
const { serverPowerShellScript } = require('../powershell');
const db = require('../db/init');
const logger = require('../utils/logger'); // Import the logger module
const { insertServer, updateServer, deleteServer, fetchServer, fetchAllServers } = require('../db/queries');

const scriptPath = path.join(__dirname, '../functions/Get-ServerStatus.ps1');

async function getServerStatuses() {
    try {
        const servers = await fetchAllServers();
        const serverNames = servers.map(server => server.ServerName);

        const serverStatuses = await serverPowerShellScript(scriptPath, serverNames);
        logger.info('Server statuses fetched successfully.');

        // Ensure serverStatuses is an array
        const statusesArray = Array.isArray(serverStatuses) ? serverStatuses : [serverStatuses];

        // Start a transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Update server statuses in the database
            const updateStmt = db.prepare(`
                UPDATE Servers
                SET Status = ?, FileShareService = ?, Downtime = ?, LastOnline = ?, BackOnline = ?
                WHERE ServerName = ?
            `);

            const currentTime = new Date();

            const updatePromises = statusesArray.map(async server => {
                const existingServer = await fetchServer(server.ServerName);
                let downtime = 0;
                let lastOnline = existingServer.LastOnline;
                let backOnline = existingServer.BackOnline;

                if (server.Status === 'Online') {
                    if (existingServer.Status !== 'Online') {
                        backOnline = lastOnline ? currentTime : null;
                        downtime = 0;
                    }
                } else {
                    if (existingServer.Status === 'Online') {
                        lastOnline = currentTime;
                    } else if (!lastOnline) {
                        lastOnline = currentTime;
                    }
                    if (lastOnline) {
                        downtime = Math.floor((currentTime - new Date(lastOnline)) / 60000); // Downtime in minutes
                    }
                    backOnline = null;
                }

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