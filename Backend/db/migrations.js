const db = require('./init');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Database migration system for schema updates
 */

const MIGRATION_TABLE = 'schema_migrations';

class DatabaseMigrator {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        // Use the existing better-sqlite3 connection from init.js
        this.db = db;
        this.ensureMigrationTable()
          .then(() => resolve(this.db))
          .catch(reject);
      } else {
        resolve(this.db);
      }
    });
  }

  disconnect() {
    return new Promise((resolve) => {
      // For better-sqlite3, we don't close the shared connection
      // Just reset our reference
      this.db = null;
      resolve();
    });
  }

  ensureMigrationTable() {
    return new Promise((resolve, reject) => {
      try {
        const createMigrationTable = `
          CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT UNIQUE NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            description TEXT
          )
        `;
        this.db.exec(createMigrationTable);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  getAppliedMigrations() {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(`SELECT version FROM ${MIGRATION_TABLE} ORDER BY version`);
        const rows = stmt.all();
        resolve(rows.map(row => row.version));
      } catch (err) {
        reject(err);
      }
    });
  }

  recordMigration(version, description) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(`INSERT INTO ${MIGRATION_TABLE} (version, description) VALUES (?, ?)`);
        stmt.run(version, description);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  isMigrationApplied(version) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(`SELECT 1 FROM ${MIGRATION_TABLE} WHERE version = ?`);
        const row = stmt.get(version);
        resolve(row !== undefined);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Run all pending migrations
   */
  async migrate() {
    await this.connect();
    
    const migrations = [
      {
        version: '2024-01-01-remove-admin-table',
        description: 'Remove Admin table and add LastAdminHelped to Users table',
        up: this.migration_removeAdminTable.bind(this)
      }
    ];

    let migrationsRun = 0;
    
    for (const migration of migrations) {
      const isApplied = await this.isMigrationApplied(migration.version);
      if (!isApplied) {
        logger.info(`Running migration: ${migration.version} - ${migration.description}`);
        
        try {
          await migration.up();
          await this.recordMigration(migration.version, migration.description);
          migrationsRun++;
          logger.info(`Migration completed: ${migration.version}`);
        } catch (error) {
          logger.error(`Migration failed: ${migration.version}`, error);
          throw error;
        }
      }
    }

    if (migrationsRun === 0) {
      logger.info('No migrations to run, database schema is up to date');
    } else {
      logger.info(`Applied ${migrationsRun} migrations successfully`);
    }

    await this.disconnect();
  }

  /**
   * Migration: Remove Admin table and update Users table
   */
  migration_removeAdminTable() {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if Admin table exists
        const adminTableExists = (() => {
          try {
            const stmt = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='Admin'`);
            const row = stmt.get();
            return row !== undefined;
          } catch (err) {
            throw err;
          }
        })();

        if (adminTableExists) {
          logger.info('Admin table found, backing up admin data before removal');
          
          // Backup admin data to a JSON file for reference
          const adminData = (() => {
            try {
              const stmt = this.db.prepare('SELECT * FROM Admin');
              return stmt.all();
            } catch (err) {
              throw err;
            }
          })();

          if (adminData.length > 0) {
            const backupPath = path.join(__dirname, `admin_backup_${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(adminData, null, 2));
            logger.info(`Admin data backed up to: ${backupPath}`);
          }
          
          // Drop the Admin table
          try {
            this.db.exec('DROP TABLE Admin');
            logger.info('Admin table removed successfully');
          } catch (err) {
            throw err;
          }
        }

        // Check if Users table needs LastAdminHelped column
        const userTableInfo = (() => {
          try {
            const stmt = this.db.prepare(`PRAGMA table_info(Users)`);
            return stmt.all();
          } catch (err) {
            throw err;
          }
        })();

        const hasLastAdminHelped = userTableInfo.some(col => col.name === 'LastAdminHelped');

        if (!hasLastAdminHelped) {
          logger.info('Adding LastAdminHelped column to Users table');
          try {
            this.db.exec('ALTER TABLE Users ADD COLUMN LastAdminHelped TEXT');
            logger.info('LastAdminHelped column added successfully');
          } catch (err) {
            throw err;
          }
        } else {
          logger.info('Users table already has LastAdminHelped column');
        }

        resolve();
      } catch (error) {
        logger.error('Migration error:', error);
        reject(error);
      }
    });
  }

  /**
   * Check if database needs migration
   */
  async needsMigration() {
    await this.connect();
    
    try {
      // Check if Admin table still exists
      const adminTableExists = (() => {
        try {
          const stmt = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='Admin'`);
          const row = stmt.get();
          return row !== undefined;
        } catch (err) {
          throw err;
        }
      })();

      if (adminTableExists) {
        await this.disconnect();
        return true;
      }

      // Check if Users table has LastAdminHelped column
      const userTableInfo = (() => {
        try {
          const stmt = this.db.prepare(`PRAGMA table_info(Users)`);
          return stmt.all();
        } catch (err) {
          throw err;
        }
      })();

      const hasLastAdminHelped = userTableInfo.some(col => col.name === 'LastAdminHelped');

      await this.disconnect();
      return !hasLastAdminHelped;
    } catch (error) {
      await this.disconnect();
      logger.error('Error checking migration status:', error);
      return false;
    }
  }
}

/**
 * Factory function to create migrator instance
 */
function createMigrator(dbPath = null) {
  const targetPath = dbPath || path.resolve(__dirname, process.env.DB_PATH || 'database.db');
  return new DatabaseMigrator(targetPath);
}

/**
 * Run migrations for the default database
 */
async function runMigrations() {
  const migrator = createMigrator();
  await migrator.migrate();
}

module.exports = {
  DatabaseMigrator,
  createMigrator,
  runMigrations
};