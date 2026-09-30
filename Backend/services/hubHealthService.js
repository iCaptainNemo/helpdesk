const fetch = require('node-fetch');
const logger = require('../utils/logger');
const { isInFallback, getFallbackStatus, expireFallbackIfDue } = require('../utils/hubFallback');

// Background poller for hub connectivity, mirroring ledgerService's
// start*Service() interval pattern. Serves two purposes: (1) keep a live
// {reachable, lastChecked} status for the frontend ticker/Configure page to
// display, whether we're normally in remote mode or currently fallen back to
// local, and (2) enforce the 72h fallback window by wall-clock time, so it
// expires even if nobody attempts to log in while the hub is down.
const POLL_INTERVAL_MS = 60 * 1000;
const HEALTH_TIMEOUT_MS = 5000;

let lastStatus = { reachable: null, lastChecked: null };

async function pingHub(hubUrl) {
    if (!hubUrl) {
        return false;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
        const res = await fetch(`${hubUrl.replace(/\/$/, '')}/api/remote/health`, { signal: controller.signal });
        return res.ok;
    } catch (err) {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

async function checkHubHealth() {
    try {
        const deploymentMode = process.env.DEPLOYMENT_MODE;

        if (isInFallback()) {
            // Check expiry regardless of reachability - the clock runs whether
            // or not the hub happens to be reachable at this particular tick.
            await expireFallbackIfDue();
            const status = getFallbackStatus();
            if (!status) {
                // Just expired on this tick - nothing left to check against.
                lastStatus = { reachable: null, lastChecked: new Date().toISOString() };
                return;
            }
            const reachable = await pingHub(status.originalRemoteServerUrl);
            lastStatus = { reachable, lastChecked: new Date().toISOString() };
            return;
        }

        if (deploymentMode === 'remote') {
            const reachable = await pingHub(process.env.REMOTE_SERVER_URL);
            lastStatus = { reachable, lastChecked: new Date().toISOString() };
            return;
        }

        // Local mode, not in fallback - hub connectivity isn't relevant.
        lastStatus = { reachable: null, lastChecked: new Date().toISOString() };
    } catch (error) {
        logger.error('[HubHealthService] Error checking hub health:', error);
    }
}

function getLastHubStatus() {
    return lastStatus;
}

function startHubHealthService() {
    logger.info('[HubHealthService] Starting periodic hub health checks (60s intervals)');

    checkHubHealth();

    const interval = setInterval(checkHubHealth, POLL_INTERVAL_MS);

    process.on('SIGTERM', () => clearInterval(interval));
    process.on('SIGINT', () => clearInterval(interval));

    return interval;
}

module.exports = { startHubHealthService, getLastHubStatus, checkHubHealth };
