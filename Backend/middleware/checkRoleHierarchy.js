const { fetchRolesForUser } = require('../db/queries');
const logger = require('../utils/logger');

const roleHierarchy = {
    superadmin: 3,
    admin: 2,
    support_agent: 1,
    user: 0
};

async function checkRoleHierarchy(req, res, next) {
    try {
        const adminID = req.AdminID;
        const targetAdminID = req.body.AdminID || req.params.adminID;

        const roles = await fetchRolesForUser(adminID);
        const targetRoles = await fetchRolesForUser(targetAdminID);

        const userRole = roles.reduce((max, role) => Math.max(max, roleHierarchy[role.RoleName]), -1);
        const targetUserRole = targetRoles.reduce((max, role) => Math.max(max, roleHierarchy[role.RoleName]), -1);

        if (userRole < roleHierarchy['manage_users']) {
            return res.status(403).json({ message: 'Access denied: Missing manage_users role' });
        }

        if (userRole <= targetUserRole) {
            return res.status(403).json({ message: 'Access denied: Cannot modify users with equal or higher role' });
        }

        next();
    } catch (error) {
        logger.error('Error checking role hierarchy:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

module.exports = checkRoleHierarchy;