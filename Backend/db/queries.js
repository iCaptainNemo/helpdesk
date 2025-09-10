const { body, validationResult } = require('express-validator');
const db = require('./init');

function executeQuery(query, params = []) {
    try {
        const stmt = db.prepare(query);
        const rows = stmt.all(...params);
        return Promise.resolve(rows);
    } catch (err) {
        return Promise.reject(err);
    }
}

function storeUser(user) {
    const query = `
        INSERT INTO Users (UserID, LastHelped, LastAdminHelped, TimesUnlocked, PasswordResets, TimesHelped)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(UserID) DO UPDATE SET
            LastHelped = excluded.LastHelped,
            LastAdminHelped = excluded.LastAdminHelped,
            TimesUnlocked = excluded.TimesUnlocked,
            PasswordResets = excluded.PasswordResets,
            TimesHelped = excluded.TimesHelped
    `;
    const params = [
        user.UserID, 
        user.LastHelped, 
        user.LastAdminHelped || null, 
        user.TimesUnlocked, 
        user.PasswordResets, 
        user.TimesHelped
    ];
    return executeQuery(query, params);
}

function fetchUser(userID) {
    const query = `SELECT * FROM Users WHERE UserID = ?;`;
    return executeQuery(query, [userID]);
}

/**
 * Updates the LastAdminHelped field when an admin performs an action on a user
 * @param {string} userID - The ID of the user being helped
 * @param {string} adminID - The ID of the admin helping the user
 * @returns {Promise} - Promise resolving to the query result
 */
function updateLastAdminHelped(userID, adminID) {
    // Sanitize the adminID to prevent SQL injection
    const sanitizedAdminID = String(adminID).replace(/[^a-zA-Z0-9_-]/g, '');
    
    const query = `
        INSERT INTO Users (UserID, LastHelped, LastAdminHelped, TimesUnlocked, PasswordResets, TimesHelped)
        VALUES (?, datetime('now'), ?, 0, 0, 1)
        ON CONFLICT(UserID) DO UPDATE SET
            LastHelped = datetime('now'),
            LastAdminHelped = ?,
            TimesHelped = TimesHelped + 1
    `;
    const params = [userID, sanitizedAdminID, sanitizedAdminID];
    return executeQuery(query, params);
}

/**
 * Increments unlock count and updates LastAdminHelped for user unlock operations
 * @param {string} userID - The ID of the user being unlocked
 * @param {string} adminID - The ID of the admin unlocking the user
 * @returns {Promise} - Promise resolving to the query result
 */
function incrementUserUnlockCount(userID, adminID) {
    const sanitizedAdminID = String(adminID).replace(/[^a-zA-Z0-9_-]/g, '');
    
    const query = `
        INSERT INTO Users (UserID, LastHelped, LastAdminHelped, TimesUnlocked, PasswordResets, TimesHelped)
        VALUES (?, datetime('now'), ?, 1, 0, 1)
        ON CONFLICT(UserID) DO UPDATE SET
            LastHelped = datetime('now'),
            LastAdminHelped = ?,
            TimesUnlocked = TimesUnlocked + 1,
            TimesHelped = TimesHelped + 1
    `;
    const params = [userID, sanitizedAdminID, sanitizedAdminID];
    return executeQuery(query, params);
}

/**
 * Increments password reset count and updates LastAdminHelped for password reset operations
 * @param {string} userID - The ID of the user getting password reset
 * @param {string} adminID - The ID of the admin resetting the password
 * @returns {Promise} - Promise resolving to the query result
 */
function incrementUserPasswordResetCount(userID, adminID) {
    const sanitizedAdminID = String(adminID).replace(/[^a-zA-Z0-9_-]/g, '');
    
    const query = `
        INSERT INTO Users (UserID, LastHelped, LastAdminHelped, TimesUnlocked, PasswordResets, TimesHelped)
        VALUES (?, datetime('now'), ?, 0, 1, 1)
        ON CONFLICT(UserID) DO UPDATE SET
            LastHelped = datetime('now'),
            LastAdminHelped = ?,
            PasswordResets = PasswordResets + 1,
            TimesHelped = TimesHelped + 1
    `;
    const params = [userID, sanitizedAdminID, sanitizedAdminID];
    return executeQuery(query, params);
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
    const deploymentMode = process.env.DEPLOYMENT_MODE;
    
    // Handle local and remote modes without database queries
    if (deploymentMode === 'local') {
        const mockAdmin = {
            AdminID: process.env.ADMIN_USERNAME || adminID,
            AdminComputer: process.env.COMPUTERNAME || 'localhost'
        };
        return Promise.resolve(mockAdmin);
    }
    
    if (deploymentMode === 'remote') {
        const mockAdmin = {
            AdminID: 'remote_agent',
            AdminComputer: process.env.COMPUTERNAME || 'localhost'
        };
        return Promise.resolve(mockAdmin);
    }
    
    // Legacy database mode
    const query = `SELECT * FROM Admin WHERE AdminID = ?;`;
    try {
        const stmt = db.prepare(query);
        const row = stmt.get(adminID);
        return Promise.resolve(row);
    } catch (err) {
        return Promise.reject(err);
    }
}

function fetchAllAdminUsers() {
    const deploymentMode = process.env.DEPLOYMENT_MODE;
    
    // Handle local and remote modes without database queries
    if (deploymentMode === 'local') {
        const mockAdmins = [{
            AdminID: process.env.ADMIN_USERNAME || 'local_admin',
            AdminComputer: process.env.COMPUTERNAME || 'localhost'
        }];
        return Promise.resolve(mockAdmins);
    }
    
    if (deploymentMode === 'remote') {
        const mockAdmins = [{
            AdminID: 'remote_agent',
            AdminComputer: process.env.COMPUTERNAME || 'localhost'
        }];
        return Promise.resolve(mockAdmins);
    }
    
    // Legacy database mode
    const query = `SELECT * FROM Admin;`;
    try {
        const stmt = db.prepare(query);
        const rows = stmt.all();
        return Promise.resolve(rows);
    } catch (err) {
        return Promise.reject(err);
    }
}

// New functions for managing servers
function insertServer(server) {
    const query = `
        INSERT INTO Servers (ServerName, Description, Status, Location, FileShareService, OnlineTime, OfflineTime)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        server.ServerName, server.Description, server.Status, server.Location, server.FileShareService, server.OnlineTime, server.OfflineTime
    ];
    return executeQuery(query, params);
}

function updateServer(server) {
    const query = `
        UPDATE Servers
        SET Description = ?, Status = ?, Location = ?, FileShareService = ?, OnlineTime = ?, OfflineTime = ?
        WHERE ServerName = ?
    `;
    const params = [
        server.Description, server.Status, server.Location, server.FileShareService, server.OnlineTime, server.OfflineTime, server.ServerName
    ];
    return executeQuery(query, params);
}

function deleteServer(serverName) {
    const query = `DELETE FROM Servers WHERE ServerName = ?;`;
    return executeQuery(query, [serverName]);
}

function fetchServer(serverName) {
    try {
        const query = `SELECT * FROM Servers WHERE ServerName = ?`;
        const stmt = db.prepare(query);
        const row = stmt.get(serverName);
        return Promise.resolve(row);
    } catch (err) {
        return Promise.reject(err);
    }
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
    try {
        const query = `INSERT INTO DomainControllers (ControllerName, Details, Role) VALUES (?, ?, ?)`;
        const stmt = db.prepare(query);
        const result = stmt.run(controllerName, details, role);
        if (callback) callback(null, result);
        return Promise.resolve(result);
    } catch (err) {
        if (callback) callback(err);
        return Promise.reject(err);
    }
}

function insertCurrentDomain(domainName, PDC, DDC, callback) {
    try {
        const query = `INSERT INTO CurrentDomain (DomainName, PDC, DDC) VALUES (?, ?, ?)`;
        const stmt = db.prepare(query);
        const result = stmt.run(domainName, PDC, DDC);
        if (callback) callback(null, result);
        return Promise.resolve(result);
    } catch (err) {
        if (callback) callback(err);
        return Promise.reject(err);
    }
}

function updateDomainControllerStatus(controllerName, status, callback) {
    try {
        const query = `UPDATE DomainControllers SET Status = ? WHERE ControllerName = ?`;
        const stmt = db.prepare(query);
        const result = stmt.run(status, controllerName);
        if (callback) callback(null, result);
        return Promise.resolve(result);
    } catch (err) {
        if (callback) callback(err);
        return Promise.reject(err);
    }
}

const fetchPDC = (callback) => {
    try {
        const query = 'SELECT PDC FROM CurrentDomain LIMIT 1';
        const stmt = db.prepare(query);
        const row = stmt.get();
        if (callback) callback(null, row);
        return Promise.resolve(row);
    } catch (err) {
        if (callback) callback(err);
        return Promise.reject(err);
    }
  };

function fetchDomainControllers(callback) {
    try {
        const query = `
            SELECT dc.ControllerName, dc.Details, dc.Role, dc.Status, cd.PDC, cd.DDC
            FROM DomainControllers dc
            LEFT JOIN CurrentDomain cd ON dc.ControllerName = cd.PDC OR dc.ControllerName = cd.DDC
        `;
        const stmt = db.prepare(query);
        const rows = stmt.all();
        const result = {
            domainControllers: rows,
            PDC: rows.find(row => row.Role === 'PDC'),
            DDC: rows.find(row => row.Role === 'DDC')
        };
        if (callback) callback(null, result);
        return Promise.resolve(result);
    } catch (err) {
        if (callback) callback(err, null);
        return Promise.reject(err);
    }
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
    updateLastAdminHelped,
    incrementUserUnlockCount,
    incrementUserPasswordResetCount,
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