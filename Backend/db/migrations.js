const sqlite3 = require('sqlite3').verbose();
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
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            reject(err);
          } else {
            this.ensureMigrationTable()
              .then(() => resolve(this.db))
              .catch(reject);
          }
        });
      } else {
        resolve(this.db);
      }
    });
  }

  disconnect() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database:', err);
          }
          this.db = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  ensureMigrationTable() {
    return new Promise((resolve, reject) => {
      const createMigrationTable = `
        CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT UNIQUE NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          description TEXT
        )
      `;
      this.db.run(createMigrationTable, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  getAppliedMigrations() {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT version FROM ${MIGRATION_TABLE} ORDER BY version`, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => row.version));
        }
      });
    });
  }

  recordMigration(version, description) {
    return new Promise((resolve, reject) => {
      this.db.run(`INSERT INTO ${MIGRATION_TABLE} (version, description) VALUES (?, ?)`, 
        [version, description], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
    });
  }

  isMigrationApplied(version) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT 1 FROM ${MIGRATION_TABLE} WHERE version = ?`, [version], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row !== undefined);
        }
      });
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
        const adminTableExists = await new Promise((resolveCheck, rejectCheck) => {
          this.db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='Admin'`, 
            (err, row) => {
              if (err) rejectCheck(err);
              else resolveCheck(row !== undefined);
            });
        });

        if (adminTableExists) {
          logger.info('Admin table found, backing up admin data before removal');
          
          // Backup admin data to a JSON file for reference
          const adminData = await new Promise((resolveData, rejectData) => {
            this.db.all('SELECT * FROM Admin', (err, rows) => {
              if (err) rejectData(err);
              else resolveData(rows);
            });
          });

          if (adminData.length > 0) {
            const backupPath = path.join(__dirname, `admin_backup_${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(adminData, null, 2));
            logger.info(`Admin data backed up to: ${backupPath}`);
          }
          
          // Drop the Admin table
          await new Promise((resolveDrop, rejectDrop) => {
            this.db.run('DROP TABLE Admin', (err) => {
              if (err) rejectDrop(err);
              else {
                logger.info('Admin table removed successfully');
                resolveDrop();
              }
            });
          });
        }

        // Check if Users table needs LastAdminHelped column
        const userTableInfo = await new Promise((resolveInfo, rejectInfo) => {
          this.db.all(`PRAGMA table_info(Users)`, (err, rows) => {
            if (err) rejectInfo(err);
            else resolveInfo(rows);
          });
        });

        const hasLastAdminHelped = userTableInfo.some(col => col.name === 'LastAdminHelped');

        if (!hasLastAdminHelped) {
          logger.info('Adding LastAdminHelped column to Users table');
          await new Promise((resolveAlter, rejectAlter) => {
            this.db.run('ALTER TABLE Users ADD COLUMN LastAdminHelped TEXT', (err) => {
              if (err) rejectAlter(err);
              else {
                logger.info('LastAdminHelped column added successfully');
                resolveAlter();
              }
            });
          });
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
      const adminTableExists = await new Promise((resolve, reject) => {
        this.db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='Admin'`, 
          (err, row) => {
            if (err) reject(err);
            else resolve(row !== undefined);
          });
      });

      if (adminTableExists) {
        await this.disconnect();
        return true;
      }

      // Check if Users table has LastAdminHelped column
      const userTableInfo = await new Promise((resolve, reject) => {
        this.db.all(`PRAGMA table_info(Users)`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

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