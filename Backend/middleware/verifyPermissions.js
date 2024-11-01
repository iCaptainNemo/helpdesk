const { fetchAdminUser, executeQuery } = require('../db/queries'); // Ensure executeQuery is imported

function verifyPermissions(requiredPermission) {
  return async (req, res, next) => {
    try {
      const adminID = req.AdminID;
      const adminUser = await fetchAdminUser(adminID);

      if (!adminUser) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const roles = await fetchRolesForUser(adminID);
      const permissions = await fetchPermissionsForRoles(roles);

      if (permissions.includes(requiredPermission)) {
        next();
      } else {
        res.status(403).json({ message: 'Access denied' });
      }
    } catch (error) {
      next(error);
    }
  };
}

async function fetchRolesForUser(adminID) {
  const query = `SELECT RoleID FROM UserRoles WHERE AdminID = ?;`;
  const roles = await executeQuery(query, [adminID]);
  return roles.map(role => role.RoleID);
}

async function fetchPermissionsForRoles(roleIDs) {
  const query = `SELECT PermissionName FROM Permissions
                 JOIN RolePermissions ON Permissions.PermissionID = RolePermissions.PermissionID
                 WHERE RolePermissions.RoleID IN (${roleIDs.join(',')});`;
  const permissions = await executeQuery(query);
  return permissions.map(permission => permission.PermissionName);
}

module.exports = verifyPermissions;