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

function insertOrUpdateUser(user) {
    const query = `
        INSERT INTO Users (UserID, LastHelped, TimesUnlocked, PasswordResets, badPwdCount, City, Created, department, givenName, homeDirectory, lastLogon, Modified, badPasswordTime, lockoutTime, mail, pwdLastSet, sn, streetAddress, telephoneNumber, Title, MemberOf, Computers)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(UserID) DO UPDATE SET
            LastHelped=excluded.LastHelped,
            TimesUnlocked=excluded.TimesUnlocked,
            PasswordResets=excluded.PasswordResets,
            badPwdCount=excluded.badPwdCount,
            City=excluded.City,
            Created=excluded.Created,
            department=excluded.department,
            givenName=excluded.givenName,
            homeDirectory=excluded.homeDirectory,
            lastLogon=excluded.lastLogon,
            Modified=excluded.Modified,
            badPasswordTime=excluded.badPasswordTime,
            lockoutTime=excluded.lockoutTime,
            mail=excluded.mail,
            pwdLastSet=excluded.pwdLastSet,
            sn=excluded.sn,
            streetAddress=excluded.streetAddress,
            telephoneNumber=excluded.telephoneNumber,
            Title=excluded.Title,
            MemberOf=excluded.MemberOf,
            Computers=excluded.Computers;
    `;
    const params = [
        user.UserID, user.LastHelped, user.TimesUnlocked, user.PasswordResets, user.badPwdCount, user.City, user.Created, user.department, user.givenName, user.homeDirectory, user.lastLogon, user.Modified, user.badPasswordTime, user.lockoutTime, user.mail, user.pwdLastSet, user.sn, user.streetAddress, user.telephoneNumber, user.Title, user.MemberOf, user.Computers
    ];
    return executeQuery(query, params);
}

function fetchUser(userID) {
    const query = `SELECT * FROM Users WHERE UserID = ?;`;
    return executeQuery(query, [userID]);
}

async function insertOrUpdateAdminUser(adminUser) {
    const fetchQuery = `SELECT * FROM Admin WHERE userID = ?;`;
    const existingUser = await executeQuery(fetchQuery, [adminUser.userID]);

    if (existingUser.length === 0) {
        const insertQuery = `
            INSERT INTO Admin (userID, temppassword, logfile, computername)
            VALUES (?, ?, ?, ?);
        `;
        const params = [
            adminUser.userID, adminUser.temppassword, adminUser.logfile, adminUser.computername
        ];
        await executeQuery(insertQuery, params);
    } else {
        const fieldsToUpdate = {};
        if (!existingUser[0].temppassword && adminUser.temppassword) {
            fieldsToUpdate.temppassword = adminUser.temppassword;
        }
        if (!existingUser[0].logfile && adminUser.logfile) {
            fieldsToUpdate.logfile = adminUser.logfile;
        }
        if (!existingUser[0].computername && adminUser.computername) {
            fieldsToUpdate.computername = adminUser.computername;
        }

        if (Object.keys(fieldsToUpdate).length > 0) {
            const setClause = Object.keys(fieldsToUpdate).map(field => `${field} = ?`).join(', ');
            const updateQuery = `UPDATE Admin SET ${setClause} WHERE userID = ?;`;
            const params = [...Object.values(fieldsToUpdate), adminUser.userID];
            await executeQuery(updateQuery, params);
        }
    }
}

function fetchAdminUser(userID) {
    const query = `SELECT * FROM Admin WHERE userID = ?;`;
    return executeQuery(query, [userID]);
}

module.exports = {
    insertOrUpdateUser,
    fetchUser,
    insertOrUpdateAdminUser,
    fetchAdminUser
};