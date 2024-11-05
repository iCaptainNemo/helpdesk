const { fetchAdminUser, fetchRolesForUser, fetchPermissionsForRoles } = require('../db/queries');

function verifyPermissions(requiredPermission) {
  return async (req, res, next) => {
    try {
      const adminID = req.AdminID;
      const adminUser = await fetchAdminUser(adminID);

      if (!adminUser) {
        return res.status(403).json({ message: 'Access denied: Not an Admin' });
      }

      const roles = await fetchRolesForUser(adminID);
      console.log(`User roles: ${roles}`);

      const permissions = await fetchPermissionsForRoles(roles);
      console.log(`Required permission: ${requiredPermission}`);
      console.log(`User permissions: ${permissions}`);

      if (permissions.includes(requiredPermission)) {
        next();
      } else {
        res.status(403).json({ message: `Access denied: Missing permission ${requiredPermission}` });
      }
    } catch (error) {
      next(error);
    }
  };
}

module.exports = verifyPermissions;