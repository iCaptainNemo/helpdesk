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

        // 'manage_users' is a permission name, not a key in roleHierarchy (which only
        // has superadmin/admin/support_agent/user) - roleHierarchy['manage_users'] was
        // always undefined, so `userRole < undefined` was always false and this guard
        // never actually fired for anyone. Only practically reachable via the legacy
        // DB-permissions deployment mode (local/remote mode grant everything and never
        // consult roles at all - see verifyPermissions.js), but fixing the logic anyway:
        // require at least 'admin' role to modify anyone's role assignment.
        if (userRole < roleHierarchy['admin']) {
            return res.status(403).json({ message: 'Access denied: Insufficient role to manage user roles' });
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