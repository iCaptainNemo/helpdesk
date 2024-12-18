const { body, validationResult } = require('express-validator');
const db = require('./init');

function executeQuery(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function storeUser(user) {
    const query = `
        INSERT INTO Users (UserID, LastHelped, TimesUnlocked, PasswordResets, TimesHelped)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(UserID) DO UPDATE SET
            LastHelped = excluded.LastHelped,
            TimesUnlocked = excluded.TimesUnlocked,
            PasswordResets = excluded.PasswordResets,
            TimesHelped = excluded.TimesHelped
    `;
    const params = [
        user.UserID, user.LastHelped, user.TimesUnlocked, user.PasswordResets, user.TimesHelped
    ];
    return executeQuery(query, params);
}

function fetchUser(userID) {
    const query = `SELECT * FROM Users WHERE UserID = ?;`;
    return executeQuery(query, [userID]);
}

async function insertOrUpdateAdminUser(adminUser) {
    const fetchQuery = `SELECT * FROM Admin WHERE AdminID = ?;`;
    const existingUser = await executeQuery(fetchQuery, [adminUser.AdminID]);

    if (existingUser.length === 0) {
        const insertQuery = `
            INSERT INTO Admin (AdminID, AdminComputer, password, temppassword)
            VALUES (?, ?, ?, ?);
        `;
        const params = [
            adminUser.AdminID, adminUser.AdminComputer, adminUser.password, adminUser.temppassword
        ];
        await executeQuery(insertQuery, params);
    } else {
        const fieldsToUpdate = {};

        // Check if AdminComputer needs to be updated
        if (adminUser.AdminComputer && adminUser.AdminComputer !== existingUser[0].AdminComputer) {
            fieldsToUpdate.AdminComputer = adminUser.AdminComputer;
        }

        // Check if password needs to be updated
        if (adminUser.password) {
            fieldsToUpdate.password = adminUser.password;
        }

        // Check if temppassword needs to be updated
        if (adminUser.temppassword) {
            fieldsToUpdate.temppassword = adminUser.temppassword;
        }

        // If there are fields to update, construct and execute the update query
        if (Object.keys(fieldsToUpdate).length > 0) {
            const setClause = Object.keys(fieldsToUpdate).map(field => `${field} = ?`).join(', ');
            const updateQuery = `UPDATE Admin SET ${setClause} WHERE AdminID = ?;`;
            const params = [...Object.values(fieldsToUpdate), adminUser.AdminID];
            await executeQuery(updateQuery, params);
        }
    }
}

function fetchAdminUser(adminID) {
    const query = `SELECT * FROM Admin WHERE AdminID = ?;`;
    return new Promise((resolve, reject) => {
        db.get(query, [adminID], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function fetchAllAdminUsers() {
    const query = `SELECT * FROM Admin;`;
    return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// New functions for managing servers
function insertServer(server) {
    const query = `
        INSERT INTO Servers (ServerName, Description, Status, Location, Downtime, LastOnline, BackOnline)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        server.ServerName, server.Description, server.Status, server.Location, server.Downtime, server.LastOnline, server.BackOnline
    ];
    return executeQuery(query, params);
}

function updateServer(server) {
    const query = `
        UPDATE Servers
        SET Description = ?, Status = ?, Location = ?, Downtime = ?, LastOnline = ?, BackOnline = ?
        WHERE ServerName = ?
    `;
    const params = [
        server.Description, server.Status, server.Location, server.Downtime, server.LastOnline, server.BackOnline, server.ServerName
    ];
    return executeQuery(query, params);
}

function deleteServer(serverName) {
    const query = `DELETE FROM Servers WHERE ServerName = ?;`;
    return executeQuery(query, [serverName]);
}

function fetchServer(serverName) {
    const query = `SELECT * FROM Servers WHERE ServerName = ?;`;
    return executeQuery(query, [serverName]);
}

function fetchAllServers() {
    const query = `SELECT * FROM Servers;`;
    return executeQuery(query);
}

// New functions for managing roles and permissions
function fetchRoles() {
    const query = `SELECT * FROM Roles;`;
    return executeQuery(query);
}

function fetchPermissions() {
    const query = `SELECT * FROM Permissions;`;
    return executeQuery(query);
}

function assignRoleToUser(adminID, roleID) {
    const checkQuery = `SELECT * FROM UserRoles WHERE AdminID = ? AND RoleID = ?;`;
    const insertQuery = `INSERT INTO UserRoles (AdminID, RoleID) VALUES (?, ?);`;

    return new Promise((resolve, reject) => {
        executeQuery(checkQuery, [adminID, roleID])
            .then(result => {
                if (result.length > 0) {
                    // Role already assigned, do nothing
                    resolve();
                } else {
                    // Role not assigned, insert it
                    return executeQuery(insertQuery, [adminID, roleID]);
                }
            })
            .then(resolve)
            .catch(reject);
    });
}

function removeRoleFromUser(adminID, roleID) {
    const query = `DELETE FROM UserRoles WHERE AdminID = ? AND RoleID = ?;`;
    return executeQuery(query, [adminID, roleID]);
}

function assignPermissionToRole(roleID, permissionID) {
    const query = `INSERT INTO RolePermissions (RoleID, PermissionID) VALUES (?, ?);`;
    return executeQuery(query, [roleID, permissionID]);
}

async function fetchRolesForUser(adminID) {
    const query = `
        SELECT Roles.RoleID, Roles.RoleName 
        FROM UserRoles 
        JOIN Roles ON UserRoles.RoleID = Roles.RoleID 
        WHERE UserRoles.AdminID = ?;
    `;
    const roles = await executeQuery(query, [adminID]);
    return roles; // Return the full roles array with RoleID and RoleName
}

async function fetchPermissionsForRoles(roleIDs) {
    if (roleIDs.length === 0) return []; // Add this line to handle empty roleIDs
    const placeholders = roleIDs.map(() => '?').join(',');
    const query = `SELECT PermissionName FROM Permissions
                   JOIN RolePermissions ON Permissions.PermissionID = RolePermissions.PermissionID
                   WHERE RolePermissions.RoleID IN (${placeholders});`;
    const permissions = await executeQuery(query, roleIDs);
    return permissions.map(permission => permission.PermissionName);
}

function insertDomainController(controllerName, details, role, callback) {
    const query = `INSERT INTO DomainControllers (ControllerName, Details, Role) VALUES (?, ?, ?)`;
    db.run(query, [controllerName, details, role], callback);
}

function insertCurrentDomain(domainName, PDC, DDC, callback) {
    const query = `INSERT INTO CurrentDomain (DomainName, PDC, DDC) VALUES (?, ?, ?)`;
    db.run(query, [domainName, PDC, DDC], callback);
}

function updateDomainControllerStatus(controllerName, status, callback) {
    const query = `UPDATE DomainControllers SET Status = ? WHERE ControllerName = ?`;
    db.run(query, [status, controllerName], callback);
}

const fetchPDC = (callback) => {
    const query = 'SELECT PDC FROM CurrentDomain LIMIT 1'; // Adjust the query as necessary
    db.get(query, [], callback);
  };

function fetchDomainControllers(callback) {
    const query = `
        SELECT dc.ControllerName, dc.Details, dc.Role, dc.Status, cd.PDC, cd.DDC
        FROM DomainControllers dc
        LEFT JOIN CurrentDomain cd ON dc.ControllerName = cd.PDC OR dc.ControllerName = cd.DDC
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            callback(err, null);
        } else {
            const result = {
                domainControllers: rows,
                PDC: rows.find(row => row.Role === 'PDC'),
                DDC: rows.find(row => row.Role === 'DDC')
            };
            callback(null, result);
        }
    });
}

module.exports = {
    insertDomainController,
    insertCurrentDomain,
    updateDomainControllerStatus,
    fetchDomainControllers,
    fetchPDC,
    fetchAdminUser,
    fetchAllAdminUsers,
    executeQuery,
    storeUser,
    fetchUser,
    insertOrUpdateAdminUser,
    fetchAdminUser,
    insertServer,
    updateServer,
    deleteServer,
    fetchServer,
    fetchAllServers,
    fetchRoles,
    fetchPermissions,
    assignRoleToUser,
    removeRoleFromUser,
    assignPermissionToRole,
    fetchRolesForUser,
    fetchPermissionsForRoles
};