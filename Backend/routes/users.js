const express = require('express');
const router = express.Router();
const { fetchAllAdminUsers, fetchRolesForUser, fetchPermissionsForRoles } = require('../db/queries');
const logger = require('../utils/logger'); // Import the logger

// Route to fetch all users with their roles and permissions
router.get('/', async (req, res) => {
    try {
        const users = await fetchAllAdminUsers();
        logger.debug('Fetched users:', users); // Debugging: Log fetched users

        const usersWithRolesAndPermissions = await Promise.all(users.map(async (user) => {
            const roles = await fetchRolesForUser(user.AdminID);
            logger.debug(`Fetched roles for user ${user.AdminID}:`, roles); // Debugging: Log fetched roles for each user

            const permissions = await fetchPermissionsForRoles(roles.map(role => role.RoleID));
            logger.debug(`Fetched permissions for user ${user.AdminID}:`, permissions); // Debugging: Log fetched permissions for each user

            return {
                ...user,
                roles,
                permissions
            };
        }));

        logger.debug('Users with roles and permissions:', usersWithRolesAndPermissions); // Debugging: Log final users with roles and permissions
        res.json(usersWithRolesAndPermissions);
    } catch (error) {
        logger.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

module.exports = router;