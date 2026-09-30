// State management for the remote-mode hub-outage fallback: when a remote
// instance can't reach its hub at login time but has a previously cached
// credential for the attempted AdminID, it switches to local mode for up to
// 72 hours rather than locking the tech out entirely. See auth.js's /login
// remote branch for where this gets triggered, and services/hubHealthService.js
// for the background poller that enforces the window and checks hub recovery.
const { readEnvFile, writeEnvVars, deleteEnvVars } = require('./envFile');
const { hashPassword } = require('./hashUtils');
const { clearAllAdminUsers } = require('../db/queries');
const logger = require('./logger');

const FALLBACK_WINDOW_MS = 72 * 60 * 60 * 1000;

function isInFallback() {
    return Boolean(readEnvFile().FALLBACK_SINCE);
}

async function enterFallback(adminID, plaintextPassword, originalRemoteUrl, originalApiKey) {
    const passwordHash = await hashPassword(plaintextPassword);
    writeEnvVars({
        DEPLOYMENT_MODE: 'local',
        ADMIN_USERNAME: adminID,
        ADMIN_PASSWORD: passwordHash,
        FALLBACK_SINCE: new Date().toISOString(),
        FALLBACK_REMOTE_SERVER_URL: originalRemoteUrl || '',
        FALLBACK_API_KEY: originalApiKey || ''
    });
    logger.warn(`[HubFallback] Hub unreachable - entered local fallback for ${adminID}`);
}

function getFallbackStatus() {
    const env = readEnvFile();
    if (!env.FALLBACK_SINCE) {
        return null;
    }

    const since = new Date(env.FALLBACK_SINCE).getTime();
    const expiresAt = since + FALLBACK_WINDOW_MS;

    return {
        since: env.FALLBACK_SINCE,
        expiresAt: new Date(expiresAt).toISOString(),
        remainingMs: Math.max(0, expiresAt - Date.now()),
        originalRemoteServerUrl: env.FALLBACK_REMOTE_SERVER_URL || '',
        originalApiKey: env.FALLBACK_API_KEY || ''
    };
}

// Instance-wide clock, not per-admin - if multiple coworkers each cached
// credentials before the outage, they're all equally subject to the same
// window, so expiry wipes every cached admin, not just the one who triggered it.
async function expireFallbackIfDue() {
    const status = getFallbackStatus();
    if (!status || status.remainingMs > 0) {
        return false;
    }

    await clearAllAdminUsers();
    deleteEnvVars(['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'FALLBACK_SINCE', 'FALLBACK_REMOTE_SERVER_URL', 'FALLBACK_API_KEY']);
    logger.warn('[HubFallback] 72-hour fallback window expired - cleared cached credentials, setup wizard required');
    return true;
}

// Called when the tech manually switches back to remote mode via
// Configure > Application - resolves the fallback state.
function clearFallback() {
    deleteEnvVars(['FALLBACK_SINCE', 'FALLBACK_REMOTE_SERVER_URL', 'FALLBACK_API_KEY']);
}

module.exports = { isInFallback, enterFallback, getFallbackStatus, expireFallbackIfDue, clearFallback, FALLBACK_WINDOW_MS };
