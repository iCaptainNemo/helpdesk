const express = require('express');
const router = express.Router();
const { executeQuery } = require('../db/queries');
const logger = require('../utils/logger'); // Import the logger

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

module.exports = router;