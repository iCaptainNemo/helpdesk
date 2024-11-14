const { fetchAdminUser, fetchRolesForUser, fetchPermissionsForRoles } = require('../db/queries');
const logger = require('../utils/logger');

function verifyPermissions(requiredPermission) {
  return async (req, res, next) => {
    try {
      const adminID = req.AdminID;
      logger.verbose(`Verifying permissions for AdminID: ${adminID}`);

      const adminUser = await fetchAdminUser(adminID);

      if (!adminUser) {
        logger.verbose(`Access denied: AdminID ${adminID} is not an Admin`);
        return res.status(403).json({ message: 'Access denied: Not an Admin' });
      }

      const roles = await fetchRolesForUser(adminID);
      logger.verbose(`AdminID ${adminID} roles: ${JSON.stringify(roles)}`);

      const permissions = await fetchPermissionsForRoles(roles.map(role => role.RoleID));
      logger.verbose(`AdminID ${adminID} required permission: ${requiredPermission}`);
      logger.verbose(`AdminID ${adminID} permissions: ${JSON.stringify(permissions)}`);

      if (permissions.includes(requiredPermission)) {
        next();
      } else {
        logger.verbose(`Access denied: AdminID ${adminID} is missing permission ${requiredPermission}`);
        res.status(403).json({ message: `Access denied: Missing permission ${requiredPermission}` });
      }
    } catch (error) {
      logger.error('Error verifying permissions:', error);
      next(error);
    }
  };
}

module.exports = verifyPermissions;