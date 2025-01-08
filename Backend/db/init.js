const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();
const logger = require('../utils/logger'); // Import the logger module

// Create a wrapper for the logger functions to add the [Database] prefix
const dbLogger = {
    info: (message, ...optionalParams) => logger.info(`[Database] ${message}`, ...optionalParams),
    verbose: (message, ...optionalParams) => logger.verbose(`[Database] ${message}`, ...optionalParams),
    error: (message, ...optionalParams) => logger.error(`[Database] ${message}`, ...optionalParams),
};

const dbPath = path.resolve(__dirname, process.env.DB_PATH || 'database.db');

dbLogger.info(`Attempting to open database at path: ${dbPath}`);

const tables = [
    {
        name: 'Admin', // IT Staff
        columns: [
            'AdminID TEXT PRIMARY KEY',
            'temppassword TEXT',
            'AdminComputer TEXT',
            'password TEXT'
        ]
    },
    {
        name: 'Users', // Active Directory Users
        columns: [
            'UserID TEXT PRIMARY KEY',
            'LastHelped DATETIME',
            'TimesUnlocked INT',
            'PasswordResets INT',
            'TimesHelped INT'
        ]
    },
    {
        name: 'LockedOutUsers', // Locked out users
        columns: [
            'UserID TEXT PRIMARY KEY',
            'name TEXT',
            'department TEXT',
            'AccountLockoutTime DATETIME'
        ]
    },
    {
        name: 'Servers', // Servers
        columns: [
            'ServerName TEXT PRIMARY KEY',
            'Description TEXT',
            'Status TEXT',
            'FileShareService TEXT',
            'Location TEXT',
            'OnlineTime DATETIME', 
            'OfflineTime DATETIME'
        ]
    },
    {
        name: 'Roles', // Roles
        columns: [
            'RoleID INTEGER PRIMARY KEY AUTOINCREMENT',
            'RoleName TEXT UNIQUE NOT NULL'
        ]
    },
    {
        name: 'Permissions', // Permissions
        columns: [
            'PermissionID INTEGER PRIMARY KEY AUTOINCREMENT',
            'PermissionName TEXT UNIQUE NOT NULL'
        ]
    },
    {
        name: 'RolePermissions', // Role-Permission mapping
        columns: [
            'RoleID INTEGER',
            'PermissionID INTEGER',
            'FOREIGN KEY (RoleID) REFERENCES Roles(RoleID)',
            'FOREIGN KEY (PermissionID) REFERENCES Permissions(PermissionID)',
            'PRIMARY KEY (RoleID, PermissionID)'
        ]
    },
    {
        name: 'UserRoles', // User-Role mapping
        columns: [
            'AdminID TEXT',
            'RoleID INTEGER',
            'FOREIGN KEY (AdminID) REFERENCES Admin(AdminID)',
            'FOREIGN KEY (RoleID) REFERENCES Roles(RoleID)',
            'PRIMARY KEY (AdminID, RoleID)'
        ]
    },    
    {
        name: 'DomainControllers',
        columns: [
            'ControllerName TEXT PRIMARY KEY',
            'Details TEXT',
            'Role TEXT', // PDC or DDC
            'Status TEXT' // New column for status
        ]
    },
    {
        name: 'CurrentDomain',
        columns: [
            'DomainName TEXT PRIMARY KEY',
            'PDC TEXT',
            'DDC TEXT',
            'FOREIGN KEY (PDC) REFERENCES DomainControllers(ControllerName)',
            'FOREIGN KEY (DDC) REFERENCES DomainControllers(ControllerName)'
        ]
    }
];

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        dbLogger.error('Error opening database:', err.message);
        dbLogger.error('Ensure the database file exists and has the correct permissions.');
    } else {
        dbLogger.info('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    tables.forEach(table => {
        const columns = table.columns.join(', ');
        const createTableQuery = `CREATE TABLE IF NOT EXISTS ${table.name} (${columns});`;
        db.run(createTableQuery, (err) => {
            if (err) {
                dbLogger.error(`Error creating table ${table.name}:`, err.message);
            } else {
                dbLogger.info(`Table ${table.name} created or already exists.`);
                checkAndAddMissingColumns(table);
            }
        });
    });

    // Insert initial roles
    const roles = ['superadmin', 'admin', 'support_agent', 'user'];
    roles.forEach(role => {
        const insertRoleQuery = `INSERT OR IGNORE INTO Roles (RoleName) VALUES (?);`;
        db.run(insertRoleQuery, [role], (err) => {
            if (err) {
                dbLogger.error(`Error inserting role ${role}:`, err.message);
            } else {
                dbLogger.verbose(`Role ${role} inserted or already exists.`);
            }
        });
    });

    // Insert initial permissions
    const permissions = [
        'access_configure_page',
        'manage_users',
        'manage_tickets',
        'view_reports',
        'execute_command',
        'execute_script'
    ];
    permissions.forEach(permission => {
        const insertPermissionQuery = `INSERT OR IGNORE INTO Permissions (PermissionName) VALUES (?);`;
        db.run(insertPermissionQuery, [permission], (err) => {
            if (err) {
                dbLogger.error(`Error inserting permission ${permission}:`, err.message);
            } else {
                dbLogger.verbose(`Permission ${permission} inserted or already exists.`);
            }
        });
    });

    // Assign permissions to roles
    const rolePermissions = {
        superadmin: ['access_configure_page', 'manage_users', 'manage_tickets', 'view_reports', 'execute_command', 'execute_script'],
        admin: ['manage_users', 'manage_tickets', 'view_reports'],
        support_agent: ['manage_tickets', 'view_reports'],
        user: []
    };

    Object.keys(rolePermissions).forEach(role => {
        rolePermissions[role].forEach(permission => {
            const assignPermissionToRoleQuery = `
                INSERT OR IGNORE INTO RolePermissions (RoleID, PermissionID)
                SELECT Roles.RoleID, Permissions.PermissionID
                FROM Roles, Permissions
                WHERE Roles.RoleName = ? AND Permissions.PermissionName = ?;
            `;
            db.run(assignPermissionToRoleQuery, [role, permission], (err) => {
                if (err) {
                    dbLogger.error(`Error assigning permission ${permission} to role ${role}:`, err.message);
                } else {
                    dbLogger.verbose(`Permission ${permission} assigned to role ${role}.`);
                }
            });
        });
    });

    // Assign the superadmin role to the first admin user
    const checkSuperadminQuery = `
        SELECT AdminID FROM UserRoles
        JOIN Roles ON UserRoles.RoleID = Roles.RoleID
        WHERE Roles.RoleName = 'superadmin';
    `;
    db.get(checkSuperadminQuery, (err, row) => {
        if (err) {
            dbLogger.error('Error checking for existing superadmin:', err.message);
        } else if (!row) {
            const assignRoleToUserQuery = `
                INSERT OR IGNORE INTO UserRoles (AdminID, RoleID)
                SELECT Admin.AdminID, Roles.RoleID
                FROM Admin, Roles
                WHERE Admin.AdminID = (SELECT AdminID FROM Admin ORDER BY ROWID LIMIT 1) AND Roles.RoleName = 'superadmin';
            `;
            db.run(assignRoleToUserQuery, (err) => {
                if (err) {
                    dbLogger.error('Error assigning superadmin role to the first admin user:', err.message);
                } else {
                    dbLogger.info('Superadmin role assigned to the first admin user.');
                }
            });
        } else {
            dbLogger.info('Superadmin role already assigned to an admin user.');
        }
    });
}

function checkAndAddMissingColumns(table) {
    const existingColumnsQuery = `PRAGMA table_info(${table.name});`;
    db.all(existingColumnsQuery, (err, rows) => {
        if (err) {
            dbLogger.error(`Error fetching columns for table ${table.name}:`, err.message);
            return;
        }
        const existingColumns = rows.map(row => row.name);
        table.columns.forEach(column => {
            const columnName = column.split(' ')[0];
            if (!existingColumns.includes(columnName) && !column.includes('FOREIGN') && !column.includes('PRIMARY')) {
                const addColumnQuery = `ALTER TABLE ${table.name} ADD COLUMN ${column};`;
                db.run(addColumnQuery, (err) => {
                    if (err) {
                        dbLogger.error(`Error adding column ${columnName} to table ${table.name}:`, err.message);
                    } else {
                        dbLogger.info(`Column ${columnName} added to table ${table.name}.`);
                    }
                });
            }
        });
    });
}

module.exports = db;