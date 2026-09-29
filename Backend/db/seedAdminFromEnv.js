const logger = require('../utils/logger');

// Real bcrypt hashes look like $2a$10$<53 more chars> / $2b$.../ $2y$... - guards
// against seeding a broken login row if .env's ADMIN_PASSWORD was ever hand-edited
// to a plaintext value or got corrupted by an interrupted write. Without this, a
// non-hash value gets inserted verbatim and bcrypt.compare() throws on every login
// attempt, which auth.js surfaces as an opaque 500 instead of a clear cause.
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

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

        if (!BCRYPT_HASH_PATTERN.test(adminPasswordHash)) {
            logger.error(`[Database] ADMIN_PASSWORD in .env doesn't look like a valid bcrypt hash - skipping AdminUsers seed for ${adminUsername}. Use the setup wizard or Configure > Application to create a working admin account.`);
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
