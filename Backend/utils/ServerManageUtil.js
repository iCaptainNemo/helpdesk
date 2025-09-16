const path = require('path');
const { serverPowerShellScript } = require('../powershell');
const db = require('../db/init');
const logger = require('../utils/logger'); // Import the logger module
const { insertServer, updateServer, deleteServer, fetchServer, fetchAllServers } = require('../db/queries');

const scriptPath = process.pkg 
    ? path.join(process.cwd(), 'functions', 'Get-ServerStatus.ps1')
    : path.join(__dirname, '../functions/Get-ServerStatus.ps1');

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

        // Pre-fetch all existing server data before transaction
        const existingServersMap = new Map();
        for (const server of statusesArray) {
            try {
                const existingServer = await fetchServer(server.ServerName);
                existingServersMap.set(server.ServerName, existingServer);
            } catch (err) {
                logger.warn(`Failed to fetch existing server data for ${server.ServerName}:`, err);
                existingServersMap.set(server.ServerName, null);
            }
        }

        // Update server statuses using better-sqlite3 transaction
        const transaction = db.transaction(() => {
            try {
                // Prepare the SQL statement for updating server statuses
                const updateStmt = db.prepare(`
                    UPDATE Servers
                    SET Status = ?, FileShareService = ?, OnlineTime = ?, OfflineTime = ?
                    WHERE ServerName = ?
                `);

                const currentTime = new Date();

                // Process each server status update
                for (const server of statusesArray) {
                    const existingServer = existingServersMap.get(server.ServerName);
                    
                    let onlineTime = existingServer?.OnlineTime;
                    let offlineTime = existingServer?.OfflineTime;

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
                    updateStmt.run(
                        server.Status,
                        server.FileShareService,
                        onlineTime ? (onlineTime instanceof Date ? onlineTime.toISOString() : onlineTime) : null,
                        offlineTime ? (offlineTime instanceof Date ? offlineTime.toISOString() : offlineTime) : null,
                        server.ServerName
                    );
                }

                logger.info('Server statuses updated in the database.');
            } catch (err) {
                logger.error('Failed to update server statuses:', err);
                throw err;
            }
        });
        
        transaction();

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