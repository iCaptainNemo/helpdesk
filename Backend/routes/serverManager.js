const express = require('express');
const router = express.Router();
const { insertServer, updateServer, deleteServer, fetchServer, fetchAllServers } = require('../db/queries');
const logger = require('../utils/logger'); // Import the logger module

// Route to fetch all servers
router.get('/', async (req, res) => {
    try {
        const servers = await fetchAllServers();
        res.json(servers);
    } catch (error) {
        logger.error('Error fetching servers:', error);
        res.status(500).json({ error: 'Failed to fetch servers' });
    }
});

// Route to fetch a server by name
router.get('/:serverName', async (req, res) => {
    const { serverName } = req.params;
    try {
        const server = await fetchServer(serverName);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        res.json(server);
    } catch (error) {
        logger.error(`Error fetching server ${serverName}:`, error);
        res.status(500).json({ error: 'Failed to fetch server' });
    }
});

// Route to insert a new server
router.post('/', async (req, res) => {
    const { ServerName, Description = '', Location = '' } = req.body;

    if (!ServerName) {
        return res.status(400).json({ error: 'ServerName is required' });
    }

    const server = { ServerName, Description, Location };

    try {
        await insertServer(server);
        res.status(201).json({ message: 'Server inserted successfully' });
    } catch (error) {
        logger.error('Error inserting server:', error);
        res.status(500).json({ error: 'Failed to insert server' });
    }
});

// Route to update an existing server
router.put('/:serverName', async (req, res) => {
    const { serverName } = req.params;
    const server = req.body;
    server.ServerName = serverName; // Ensure the server name is set
    try {
        await updateServer(server);
        res.json({ message: 'Server updated successfully' });
    } catch (error) {
        logger.error(`Error updating server ${serverName}:`, error);
        res.status(500).json({ error: 'Failed to update server' });
    }
});

// Route to delete a server
router.delete('/:serverName', async (req, res) => {
    const { serverName } = req.params;
    try {
        await deleteServer(serverName);
        res.json({ message: 'Server deleted successfully' });
    } catch (error) {
        logger.error(`Error deleting server ${serverName}:`, error);
        res.status(500).json({ error: 'Failed to delete server' });
    }
});

module.exports = router;