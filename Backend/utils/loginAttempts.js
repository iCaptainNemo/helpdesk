// Simple in-memory brute-force guard for /api/auth/login. No dependency added
// on purpose - login had zero throttling (bcrypt's own cost factor is the only
// friction an attacker faces), and this is a small, self-contained module in
// the same spirit as terminalHistory.js's in-memory buffer. Resets on restart,
// which is fine for this - it's a speed bump against automated guessing, not a
// durable audit mechanism (RecentActions/logging already covers that).
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // failures older than this don't count toward the limit
const LOCKOUT_MS = 5 * 60 * 1000; // how long a lockout lasts once triggered

const attempts = new Map(); // normalizedAdminID -> { count, firstAttempt, lockedUntil }

function isLocked(key) {
    const entry = attempts.get(key);
    if (!entry || !entry.lockedUntil) {
        return false;
    }
    if (Date.now() >= entry.lockedUntil) {
        attempts.delete(key);
        return false;
    }
    return true;
}

function getLockRemainingMs(key) {
    const entry = attempts.get(key);
    if (!entry || !entry.lockedUntil) {
        return 0;
    }
    return Math.max(0, entry.lockedUntil - Date.now());
}

function recordFailure(key) {
    const now = Date.now();
    let entry = attempts.get(key);
    if (!entry || now - entry.firstAttempt > WINDOW_MS) {
        entry = { count: 0, firstAttempt: now, lockedUntil: null };
    }
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) {
        entry.lockedUntil = now + LOCKOUT_MS;
    }
    attempts.set(key, entry);
}

function recordSuccess(key) {
    attempts.delete(key);
}

module.exports = { isLocked, getLockRemainingMs, recordFailure, recordSuccess };
