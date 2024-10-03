const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, process.env.DB_PATH || 'database.db');

const tables = [
    {
        name: 'Admin',
        columns: [
            'userID TEXT PRIMARY KEY',
            'temppassword TEXT',
            'logfile TEXT'
        ]
    },
    {
        name: 'Users',
        columns: [
            'UserID TEXT PRIMARY KEY',
            'LastHelped DATETIME',
            'TimesUnlocked INT',
            'PasswordResets INT',
            'badPwdCount INT',
            'City TEXT',
            'Created DATETIME',
            'department TEXT',
            'givenName TEXT',
            'homeDirectory TEXT',
            'lastLogon DATETIME',
            'Modified DATETIME',
            'badPasswordTime DATETIME',
            'lockoutTime DATETIME',
            'mail TEXT',
            'pwdLastSet DATETIME',
            'sn TEXT',
            'streetAddress TEXT',
            'telephoneNumber TEXT',
            'Title TEXT',
            'MemberOf TEXT',
            'Computers TEXT'
        ]
    }
];

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
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