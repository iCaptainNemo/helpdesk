const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Configure dotenv with explicit path for Electron compatibility
const envPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });

const logger = require('../utils/logger'); // Import the logger module

// Create a wrapper for the logger functions to add the [Database] prefix
const dbLogger = {
    info: (message, ...optionalParams) => logger.info(`[Database] ${message}`, ...optionalParams),
    verbose: (message, ...optionalParams) => logger.verbose(`[Database] ${message}`, ...optionalParams),
    error: (message, ...optionalParams) => logger.error(`[Database] ${message}`, ...optionalParams),
};

// Determine the appropriate database path for standalone app
function getDatabasePath() {
    // Check if running as standalone executable (pkg)
    if (process.pkg) {
        // Use current directory for standalone executable
        const dbDir = path.join(process.cwd(), 'database');
        
        // Ensure directory exists
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        return path.join(dbDir, 'database.db');
    } else {
        // Development mode - use local path
        return path.resolve(__dirname, process.env.DB_PATH || 'database.db');
    }
}

const dbPath = getDatabasePath();

dbLogger.info(`Attempting to open database at path: ${dbPath}`);

const tables = [
    // Note: Admin table removed - authentication now handled via .env file
    // Admin credentials are stored in Backend/.env as ADMIN_USERNAME and ADMIN_PASSWORD
    {
        name: 'Users', // Active Directory Users
        columns: [
            'UserID TEXT PRIMARY KEY',
            'LastHelped DATETIME',
            'LastAdminHelped TEXT', // Track which admin last helped this user
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

// Initialize database with better-sqlite3
let db;
try {
    db = new Database(dbPath);
    dbLogger.info('Connected to the SQLite database.');
    // Initialize database tables and data
    initializeDatabase();
} catch (err) {
    dbLogger.error('Error opening database:', err.message);
    dbLogger.error('Ensure the database file exists and has the correct permissions.');
    throw err;
}

// Initialize database tables and data
function initializeDatabase() {
    try {
        // Create tables
        tables.forEach(table => {
            const columns = table.columns.join(', ');
            const createTableQuery = `CREATE TABLE IF NOT EXISTS ${table.name} (${columns});`;
            try {
                db.exec(createTableQuery);
                dbLogger.info(`Table ${table.name} created or already exists.`);
                checkAndAddMissingColumns(table);
            } catch (err) {
                dbLogger.error(`Error creating table ${table.name}:`, err.message);
            }
        });

        // Insert initial roles
        const roles = ['superadmin', 'admin', 'support_agent', 'user'];
        const insertRoleStmt = db.prepare('INSERT OR IGNORE INTO Roles (RoleName) VALUES (?)');
        roles.forEach(role => {
            try {
                insertRoleStmt.run(role);
                dbLogger.verbose(`Role ${role} inserted or already exists.`);
            } catch (err) {
                dbLogger.error(`Error inserting role ${role}:`, err.message);
            }
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
        const insertPermissionStmt = db.prepare('INSERT OR IGNORE INTO Permissions (PermissionName) VALUES (?)');
        permissions.forEach(permission => {
            try {
                insertPermissionStmt.run(permission);
                dbLogger.verbose(`Permission ${permission} inserted or already exists.`);
            } catch (err) {
                dbLogger.error(`Error inserting permission ${permission}:`, err.message);
            }
        });

        // Assign permissions to roles
        const rolePermissions = {
            superadmin: ['access_configure_page', 'manage_users', 'manage_tickets', 'view_reports', 'execute_command', 'execute_script'],
            admin: ['manage_users', 'manage_tickets', 'view_reports'],
            support_agent: ['manage_tickets', 'view_reports'],
            user: []
        };

        const assignPermissionToRoleStmt = db.prepare(`
            INSERT OR IGNORE INTO RolePermissions (RoleID, PermissionID)
            SELECT Roles.RoleID, Permissions.PermissionID
            FROM Roles, Permissions
            WHERE Roles.RoleName = ? AND Permissions.PermissionName = ?
        `);

        Object.keys(rolePermissions).forEach(role => {
            rolePermissions[role].forEach(permission => {
                try {
                    assignPermissionToRoleStmt.run(role, permission);
                    dbLogger.verbose(`Permission ${permission} assigned to role ${role}.`);
                } catch (err) {
                    dbLogger.error(`Error assigning permission ${permission} to role ${role}:`, err.message);
                }
            });
        });

        // Assign the superadmin role to the first admin user
        const checkSuperadminQuery = `
            SELECT AdminID FROM UserRoles
            JOIN Roles ON UserRoles.RoleID = Roles.RoleID
            WHERE Roles.RoleName = 'superadmin'
        `;
        try {
            const existingSuperadmin = db.prepare(checkSuperadminQuery).get();
            if (!existingSuperadmin) {
                const assignRoleToUserQuery = `
                    INSERT OR IGNORE INTO UserRoles (AdminID, RoleID)
                    SELECT Admin.AdminID, Roles.RoleID
                    FROM Admin, Roles
                    WHERE Admin.AdminID = (SELECT AdminID FROM Admin ORDER BY ROWID LIMIT 1) AND Roles.RoleName = 'superadmin'
                `;
                try {
                    db.prepare(assignRoleToUserQuery).run();
                    dbLogger.info('Superadmin role assigned to the first admin user.');
                } catch (err) {
                    dbLogger.error('Error assigning superadmin role to the first admin user:', err.message);
                }
            } else {
                dbLogger.info('Superadmin role already assigned to an admin user.');
            }
        } catch (err) {
            dbLogger.error('Error checking for existing superadmin:', err.message);
        }
    } catch (err) {
        dbLogger.error('Database initialization failed:', err.message);
        throw err;
    }
}

function checkAndAddMissingColumns(table) {
    try {
        const existingColumnsQuery = `PRAGMA table_info(${table.name})`;
        const rows = db.prepare(existingColumnsQuery).all();
        const existingColumns = rows.map(row => row.name);
        
        table.columns.forEach(column => {
            const columnName = column.split(' ')[0];
            if (!existingColumns.includes(columnName) && !column.includes('FOREIGN') && !column.includes('PRIMARY')) {
                const addColumnQuery = `ALTER TABLE ${table.name} ADD COLUMN ${column}`;
                try {
                    db.prepare(addColumnQuery).run();
                    dbLogger.info(`Column ${columnName} added to table ${table.name}.`);
                } catch (err) {
                    dbLogger.error(`Error adding column ${columnName} to table ${table.name}:`, err.message);
                }
            }
        });
    } catch (err) {
        dbLogger.error(`Error fetching columns for table ${table.name}:`, err.message);
    }
}

module.exports = db;