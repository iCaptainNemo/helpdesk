const express = require('express');
const router = express.Router();
const { fetchAllAdminUsers, insertOrUpdateAdminUser, deleteAdminUser } = require('../db/queries');
const logger = require('../utils/logger');

// Route to fetch all users
router.get('/', async (req, res) => {
    try {
        const deploymentMode = process.env.DEPLOYMENT_MODE;

        if (deploymentMode === 'local') {
            // Local (hub) mode: real multi-user directory from the AdminUsers table
            const users = await fetchAllAdminUsers();
            logger.debug('Local mode users:', users);
            res.json(users);
            return;
        }

        if (deploymentMode === 'remote') {
            // Remote mode: user management lives on the hub, not here
            const mockUsers = [{
                AdminID: 'remote_agent',
                AdminComputer: process.env.COMPUTERNAME || 'localhost',
                roles: [{ RoleID: 'remote-agent', RoleName: 'Remote Agent' }],
                permissions: ['read', 'write', 'execute', 'execute_script', 'manage_tickets', 'view_reports', 'execute_command']
            }];

            logger.debug('Remote mode users:', mockUsers);
            res.json(mockUsers);
            return;
        }

        res.json([]);
    } catch (error) {
        logger.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Add a new hub-local admin user - only meaningful on the hub itself
router.post('/', async (req, res) => {
    if (process.env.DEPLOYMENT_MODE !== 'local') {
        return res.status(403).json({ error: 'User management is only available on the hub (local mode) instance' });
    }

    const { AdminID, password, displayName } = req.body;
    if (!AdminID || !AdminID.trim() || !password) {
        return res.status(400).json({ error: 'AdminID and password are required' });
    }

    try {
        const result = await insertOrUpdateAdminUser({ AdminID, password, displayName });
        logger.info(`Admin user added: ${result.AdminID} by ${req.AdminID}`);
        res.status(201).json({ AdminID: result.AdminID, DisplayName: displayName || AdminID });
    } catch (error) {
        logger.error('Error adding user:', error);
        res.status(500).json({ error: 'Failed to add user' });
    }
});

// Remove a hub-local admin user - only meaningful on the hub itself
router.delete('/:adminID', async (req, res) => {
    if (process.env.DEPLOYMENT_MODE !== 'local') {
        return res.status(403).json({ error: 'User management is only available on the hub (local mode) instance' });
    }

    try {
        const users = await fetchAllAdminUsers();
        if (users.length <= 1) {
            return res.status(400).json({ error: 'Cannot remove the last remaining admin user' });
        }

        await deleteAdminUser(req.params.adminID);
        logger.info(`Admin user removed: ${req.params.adminID} by ${req.AdminID}`);
        res.json({ message: 'User removed successfully' });
    } catch (error) {
        logger.error('Error removing user:', error);
        res.status(500).json({ error: 'Failed to remove user' });
    }
});

module.exports = router;
