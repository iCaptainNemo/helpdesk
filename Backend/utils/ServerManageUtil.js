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
                SET Status = ?, FileShareService = ?
                WHERE ServerName = ?
            `);

            statusesArray.forEach(server => {
                updateStmt.run(server.Status, server.FileShareService, server.ServerName);
            });

            updateStmt.finalize();

            // Commit the transaction
            db.run('COMMIT', (err) => {
                if (err) {
                    logger.error('Failed to commit transaction:', err);
                } else {
                    logger.info('Server statuses updated in the database.');
                }
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