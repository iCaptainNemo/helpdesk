const express = require('express');
const router = express.Router();
const { executeQuery } = require('../db/queries');
const logger = require('../utils/logger'); // Import the logger

// Fetch all permissions
router.get('/', async (req, res) => {
    try {
        const permissions = await executeQuery('SELECT * FROM Permissions');
        res.json(permissions);
    } catch (error) {
        logger.error(`Failed to fetch permissions: ${error}`);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

// Create a new permission
router.post('/', async (req, res) => {
    const { permissionName } = req.body;
    if (!permissionName) {
        return res.status(400).json({ error: 'Permission name is required' });
    }

    try {
        await executeQuery('INSERT INTO Permissions (PermissionName) VALUES (?)', [permissionName]);
        res.status(201).json({ message: 'Permission created successfully' });
    } catch (error) {
        logger.error(`Failed to create permission: ${error}`);
        res.status(500).json({ error: 'Failed to create permission' });
    }
});

// Update an existing permission
router.put('/:permissionId', async (req, res) => {
    const { permissionId } = req.params;
    const { permissionName } = req.body;
    if (!permissionName) {
        return res.status(400).json({ error: 'Permission name is required' });
    }

    try {
        await executeQuery('UPDATE Permissions SET PermissionName = ? WHERE PermissionID = ?', [permissionName, permissionId]);
        res.json({ message: 'Permission updated successfully' });
    } catch (error) {
        logger.error(`Failed to update permission: ${error}`);
        res.status(500).json({ error: 'Failed to update permission' });
    }
});

// Delete a permission
router.delete('/:permissionId', async (req, res) => {
    const { permissionId } = req.params;

    try {
        await executeQuery('DELETE FROM Permissions WHERE PermissionID = ?', [permissionId]);
        res.json({ message: 'Permission deleted successfully' });
    } catch (error) {
        logger.error(`Failed to delete permission: ${error}`);
        res.status(500).json({ error: 'Failed to delete permission' });
    }
});

module.exports = router;