const express = require('express');
const router = express.Router();
const { fetchAllAdminUsers, fetchRolesForUser, fetchPermissionsForRoles } = require('../db/queries');
const logger = require('../utils/logger');

// Route to fetch all users with their roles and permissions
router.get('/', async (req, res) => {
    try {
        const deploymentMode = process.env.DEPLOYMENT_MODE;
        
        if (deploymentMode === 'local') {
            // Local mode: Return current admin user with full permissions
            const adminUsername = process.env.ADMIN_USERNAME || 'local_admin';
            const mockUsers = [{
                AdminID: adminUsername,
                AdminComputer: process.env.COMPUTERNAME || 'localhost',
                roles: [{ RoleID: 'local-admin', RoleName: 'Local Administrator' }],
                permissions: ['read', 'write', 'execute', 'access_configure_page', 'execute_script', 'manage_users', 'manage_tickets', 'view_reports', 'execute_command']
            }];
            
            logger.debug('Local mode users:', mockUsers);
            res.json(mockUsers);
            return;
        }
        
        if (deploymentMode === 'remote') {
            // Remote mode: Return simplified user data (no configuration access)
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
        
        // Legacy database mode: Use original database queries
        const users = await fetchAllAdminUsers();
        logger.debug('Fetched users:', users);

        const usersWithRolesAndPermissions = await Promise.all(users.map(async (user) => {
            const roles = await fetchRolesForUser(user.AdminID);
            logger.debug(`Fetched roles for user ${user.AdminID}:`, roles);

            const permissions = await fetchPermissionsForRoles(roles.map(role => role.RoleID));
            logger.debug(`Fetched permissions for user ${user.AdminID}:`, permissions);

            return {
                ...user,
                roles,
                permissions
            };
        }));

        logger.debug('Users with roles and permissions:', usersWithRolesAndPermissions);
        res.json(usersWithRolesAndPermissions);
    } catch (error) {
        logger.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

module.exports = router;