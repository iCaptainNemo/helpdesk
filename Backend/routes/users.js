const express = require('express');
const router = express.Router();
const { fetchAllAdminUsers, fetchAdminUser, insertOrUpdateAdminUser, deleteAdminUser } = require('../db/queries');
const logger = require('../utils/logger');
const db = require('../db/init');

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
        // AdminID is normalized case-insensitively (see insertOrUpdateAdminUser) -
        // without this check, adding "Alice" when "alice" already exists would
        // silently overwrite the existing account's password via ON CONFLICT
        // instead of failing, while still returning 201 as if a new user was created.
        const existing = await fetchAdminUser(AdminID);
        if (existing) {
            return res.status(409).json({ error: `A user named "${existing.AdminID}" already exists` });
        }

        const result = await insertOrUpdateAdminUser({ AdminID, password, displayName });
        logger.info(`Admin user added: ${result.AdminID} by ${req.AdminID}`);
        res.status(201).json({ AdminID: result.AdminID, DisplayName: displayName || AdminID });
    } catch (error) {
        logger.error('Error adding user:', error);
        res.status(500).json({ error: 'Failed to add user' });
    }
});

// Admin-initiated password reset for an existing hub-local user - only
// meaningful on the hub itself. Separate from auth.js's /update-password
// (self-service, always acts on the caller's own token identity) - this lets
// a hub admin reset a coworker's password when they're locked out or forgot
// it, without needing the coworker's current password.
router.put('/:adminID/password', async (req, res) => {
    if (process.env.DEPLOYMENT_MODE !== 'local') {
        return res.status(403).json({ error: 'User management is only available on the hub (local mode) instance' });
    }

    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'password is required' });
    }

    try {
        const existing = await fetchAdminUser(req.params.adminID);
        if (!existing) {
            return res.status(404).json({ error: `No user named "${req.params.adminID}" exists` });
        }

        await insertOrUpdateAdminUser({ AdminID: existing.AdminID, password });

        try {
            db.prepare(`
                INSERT INTO RecentActions (adminID, activity, target, action_type, details, result)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(req.AdminID, `Reset password for hub user: ${existing.AdminID}`, existing.AdminID, 'admin_password_reset', null, 'success');
        } catch (logErr) {
            logger.error('Failed to log admin password reset:', logErr);
        }

        logger.info(`Password reset for ${existing.AdminID} by ${req.AdminID}`);
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        logger.error('Error resetting user password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Remove a hub-local admin user - only meaningful on the hub itself
router.delete('/:adminID', async (req, res) => {
    if (process.env.DEPLOYMENT_MODE !== 'local') {
        return res.status(403).json({ error: 'User management is only available on the hub (local mode) instance' });
    }

    try {
        const result = await deleteAdminUser(req.params.adminID);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        logger.info(`Admin user removed: ${req.params.adminID} by ${req.AdminID}`);
        res.json({ message: 'User removed successfully' });
    } catch (error) {
        logger.error('Error removing user:', error);
        res.status(500).json({ error: 'Failed to remove user' });
    }
});

module.exports = router;
