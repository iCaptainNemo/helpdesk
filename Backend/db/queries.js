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
        INSERT INTO Users (UserID, LastHelped, TimesUnlocked, PasswordResets)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(UserID) DO UPDATE SET
            LastHelped = excluded.LastHelped,
            TimesUnlocked = excluded.TimesUnlocked,
            PasswordResets = excluded.PasswordResets
    `;
    const params = [
        user.UserID, user.LastHelped, user.TimesUnlocked, user.PasswordResets
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
            INSERT INTO Admin (AdminID, temppassword, computername, password)
            VALUES (?, ?, ?, ?);
        `;
        const params = [
            adminUser.AdminID, adminUser.temppassword, adminUser.computername, adminUser.password
        ];
        await executeQuery(insertQuery, params);
    } else {
        const fieldsToUpdate = {};

        // Check if temppassword needs to be updated
        if (adminUser.temppassword && adminUser.temppassword !== existingUser[0].temppassword) {
            fieldsToUpdate.temppassword = adminUser.temppassword;
        }

        // Check if computername needs to be updated
        if (adminUser.computername && adminUser.computername !== existingUser[0].computername) {
            fieldsToUpdate.computername = adminUser.computername;
        }

        // Check if password needs to be updated
        if (adminUser.password) {
            fieldsToUpdate.password = adminUser.password;
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

// New functions for managing servers
function InsertServer(server) {
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

module.exports = {
    storeUser,
    fetchUser,
    insertOrUpdateAdminUser,
    fetchAdminUser,
    InsertServer,
    updateServer,
    deleteServer,
    fetchServer,
    fetchAllServers
};