const express = require('express');
const router = express.Router();
const { executeQuery, assignRoleToUser, removeRoleFromUser } = require('../db/queries');
const logger = require('../utils/logger'); // Import the logger
const verifyToken = require('../middleware/verifyToken'); // Import the verifyToken middleware
const checkRoleHierarchy = require('../middleware/checkRoleHierarchy');

// Fetch all roles
router.get('/', async (req, res) => {
    try {
        const roles = await executeQuery('SELECT * FROM Roles');
        res.json(roles);
    } catch (error) {
        logger.error(`Failed to fetch roles: ${error}`);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});

// Create a new role
router.post('/', async (req, res) => {
    const { roleName } = req.body;
    if (!roleName) {
        return res.status(400).json({ error: 'Role name is required' });
    }

    try {
        await executeQuery('INSERT INTO Roles (RoleName) VALUES (?)', [roleName]);
        res.status(201).json({ message: 'Role created successfully' });
    } catch (error) {
        logger.error(`Failed to create role: ${error}`);
        res.status(500).json({ error: 'Failed to create role' });
    }
});

// Update an existing role
router.put('/:roleId', async (req, res) => {
    const { roleId } = req.params;
    const { roleName } = req.body;
    if (!roleName) {
        return res.status(400).json({ error: 'Role name is required' });
    }

    try {
        await executeQuery('UPDATE Roles SET RoleName = ? WHERE RoleID = ?', [roleName, roleId]);
        res.json({ message: 'Role updated successfully' });
    } catch (error) {
        logger.error(`Failed to update role: ${error}`);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// Delete a role
router.delete('/:roleId', async (req, res) => {
    const { roleId } = req.params;

    try {
        await executeQuery('DELETE FROM Roles WHERE RoleID = ?', [roleId]);
        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        logger.error(`Failed to delete role: ${error}`);
        res.status(500).json({ error: 'Failed to delete role' });
    }
});

// Assign a role to a user
router.post('/assign', verifyToken, checkRoleHierarchy, async (req, res) => {
    const { adminID, roleID } = req.body;
    if (!adminID || !roleID) {
        return res.status(400).json({ error: 'AdminID and RoleID are required' });
    }

    try {
        await assignRoleToUser(adminID, roleID);
        logger.info(`Role ${roleID} assigned to user ${adminID}`);
        logger.verbose(`Role ${roleID} assigned to user ${adminID} by ${req.AdminID}`);
        logger.debug(`Assign role request body: ${JSON.stringify(req.body)}`);
        res.json({ message: 'Role assigned successfully' });
    } catch (error) {
        logger.error(`Failed to assign role: ${error}`);
        res.status(500).json({ error: 'Failed to assign role' });
    }
});

// Remove a role from a user
router.post('/remove', verifyToken, checkRoleHierarchy, async (req, res) => {
    const { adminID, roleID } = req.body;
    if (!adminID || !roleID) {
        return res.status(400).json({ error: 'AdminID and RoleID are required' });
    }

    try {
        await removeRoleFromUser(adminID, roleID);
        logger.info(`Role ${roleID} removed from user ${adminID}`);
        logger.verbose(`Role ${roleID} removed from user ${adminID} by ${req.AdminID}`);
        logger.debug(`Remove role request body: ${JSON.stringify(req.body)}`);
        res.json({ message: 'Role removed successfully' });
    } catch (error) {
        logger.error(`Failed to remove role: ${error}`);
        res.status(500).json({ error: 'Failed to remove role' });
    }
});
module.exports = router;