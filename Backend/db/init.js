const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, process.env.DB_PATH || 'database.db');

console.log(`Attempting to open database at path: ${dbPath}`);

const tables = [
    {
        name: 'Admin', //IT Staff
        columns: [
            'AdminID TEXT PRIMARY KEY',
            'AdminComputer TEXT',
            'password TEXT',
        ]
    },
    {
        name: 'Users', //Active Directory Users
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
            'Location TEXT',
            'Downtime DATETIME',
            'LastOnline DATETIME',
            'BackOnline DATETIME'
        ]
    }
];

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        console.error('Ensure the database file exists and has the correct permissions.');
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    tables.forEach(table => {
        const columns = table.columns.join(', ');
        const createTableQuery = `CREATE TABLE IF NOT EXISTS ${table.name} (${columns});`;
        db.run(createTableQuery, (err) => {
            if (err) {
                console.error(`Error creating table ${table.name}:`, err.message);
            } else {
                console.log(`Table ${table.name} created or already exists.`);
                checkAndAddMissingColumns(table);
            }
        });
    });
}

function checkAndAddMissingColumns(table) {
    const existingColumnsQuery = `PRAGMA table_info(${table.name});`;
    db.all(existingColumnsQuery, (err, rows) => {
        if (err) {
            console.error(`Error fetching columns for table ${table.name}:`, err.message);
            return;
        }
        const existingColumns = rows.map(row => row.name);
        table.columns.forEach(column => {
            const columnName = column.split(' ')[0];
            if (!existingColumns.includes(columnName)) {
                const addColumnQuery = `ALTER TABLE ${table.name} ADD COLUMN ${column};`;
                db.run(addColumnQuery, (err) => {
                    if (err) {
                        console.error(`Error adding column ${columnName} to table ${table.name}:`, err.message);
                    } else {
                        console.log(`Column ${columnName} added to table ${table.name}.`);
                    }
                });
            }
        });
    });
}

module.exports = db;