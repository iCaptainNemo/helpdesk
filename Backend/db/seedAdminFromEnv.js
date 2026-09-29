const logger = require('../utils/logger');

// Seeds the AdminUsers table with the current .env ADMIN_USERNAME/ADMIN_PASSWORD
// as the first hub login, but only if the table is still empty - preserves login
// after upgrading an existing local-mode install with zero re-setup. ADMIN_PASSWORD
// in .env is already a bcrypt hash, so it's copied in directly (no re-hashing).
// Shared by db/init.js (fresh DB), db/migrations.js (existing DB upgrade), and the
// setup wizard (fresh local-mode install).
function seedAdminFromEnv(db) {
    try {
        const { count } = db.prepare('SELECT COUNT(*) AS count FROM AdminUsers').get();
        if (count > 0) {
            return;
        }

        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPasswordHash = process.env.ADMIN_PASSWORD;
        if (!adminUsername || !adminPasswordHash) {
            return;
        }

        const normalizedAdminID = adminUsername.toLowerCase();
        db.prepare(
            'INSERT OR IGNORE INTO AdminUsers (AdminID, PasswordHash, DisplayName) VALUES (?, ?, ?)'
        ).run(normalizedAdminID, adminPasswordHash, adminUsername);
        logger.info(`[Database] Seeded AdminUsers from .env for ${normalizedAdminID}`);
    } catch (err) {
        logger.error('[Database] Failed to seed AdminUsers from .env:', err.message);
    }
}

module.exports = { seedAdminFromEnv };
