const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const os = require('os');
const fetch = require('node-fetch');
const logger = require('../utils/logger');
const db = require('../db/init');
const { fetchAllAdminUsers, insertOrUpdateAdminUser } = require('../db/queries');
const { readEnvFile, writeEnvVars } = require('../utils/envFile');
const { hashPassword } = require('../utils/hashUtils');

// Adapter names that are virtual/tunnel interfaces rather than the machine's
// real LAN NIC - common on admin/dev machines running Docker Desktop, WSL2, or
// a VPN client. os.networkInterfaces() key order isn't guaranteed to put the
// real adapter first, so without this a hub admin on such a machine could copy
// out a Docker-internal or VPN-only address that's unreachable from a
// coworker's machine, and get a confusing "could not reach hub" instead of an
// explanation.
const VIRTUAL_ADAPTER_PATTERN = /virtual|vethernet|vpn|tailscale|zerotier|docker|wsl|hyper-v|loopback|\btap\b|\btun\d/i;

// Best-effort LAN-reachable address for this machine, so the hub admin can copy
// it straight into a remote instance's setup instead of guessing their own IP.
// Falls back to whatever's in .env's BACKEND_URL if it's already a real address
// (set manually or by an older wizard run); only auto-detects when that value is
// missing or still the wizard's default 'localhost' (which nothing else on the
// LAN could actually reach).
function detectHubUrl(envBackendUrl) {
    const port = process.env.PORT || 3001;

    if (envBackendUrl && !/localhost|127\.0\.0\.1/i.test(envBackendUrl)) {
        return envBackendUrl;
    }

    const candidates = [];
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                candidates.push({ name, address: iface.address });
            }
        }
    }

    const preferred = candidates.find((c) => !VIRTUAL_ADAPTER_PATTERN.test(c.name));
    const chosen = preferred || candidates[0];
    if (chosen) {
        return `http://${chosen.address}:${port}`;
    }

    return envBackendUrl || `http://localhost:${port}`;
}

// Deployment mode + hub connection settings (Configure > Application tab).
// Deliberately its own router, gated by 'manage_deployment' rather than
// 'access_configure_page' - a remote-mode instance needs to be able to view/
// change its own connection to the hub (or switch back to local), even though
// verifyPermissions denies 'access_configure_page' outright in remote mode.
// The rest of Configure (Users, System, Infrastructure) stays hub-only.

function logDeploymentChange(adminID, activity, details) {
    try {
        db.prepare(`
            INSERT INTO RecentActions (adminID, activity, target, action_type, details, result)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(adminID, activity, null, 'deployment_config', details ? JSON.stringify(details) : null, 'success');
    } catch (err) {
        logger.error('Failed to log deployment config change:', err);
    }
}

router.get('/', async (req, res) => {
    try {
        const env = readEnvFile();
        const hasLocalAdmin = (await fetchAllAdminUsers()).length > 0;

        res.json({
            mode: env.DEPLOYMENT_MODE || process.env.DEPLOYMENT_MODE || 'local',
            remoteServerUrl: env.REMOTE_SERVER_URL || '',
            apiKey: env.API_KEY || '',
            hubUrl: detectHubUrl(env.BACKEND_URL),
            hasLocalAdmin
        });
    } catch (error) {
        logger.error('Failed to fetch deployment settings:', error);
        res.status(500).json({ error: 'Failed to fetch deployment settings' });
    }
});

// Switch deployment mode / update hub connection settings. Safe to apply live -
// DEPLOYMENT_MODE, REMOTE_SERVER_URL and API_KEY are read fresh per-request
// everywhere in this codebase, never cached at module load.
router.put('/', async (req, res) => {
    const { mode, remoteServerUrl, apiKey, adminUsername, adminPassword } = req.body;

    if (mode !== 'local' && mode !== 'remote') {
        return res.status(400).json({ error: 'mode must be "local" or "remote"' });
    }

    try {
        if (mode === 'remote') {
            if (!remoteServerUrl || !apiKey) {
                return res.status(400).json({ error: 'remoteServerUrl and apiKey are required for remote mode' });
            }

            writeEnvVars({
                DEPLOYMENT_MODE: 'remote',
                REMOTE_SERVER_URL: remoteServerUrl,
                API_KEY: apiKey
            });
        } else {
            const hasLocalAdmin = (await fetchAllAdminUsers()).length > 0;

            if (!hasLocalAdmin) {
                if (!adminUsername || !adminPassword) {
                    return res.status(400).json({ error: 'adminUsername and adminPassword are required - this instance has no local admin account yet' });
                }

                const hashedPassword = await hashPassword(adminPassword);
                await insertOrUpdateAdminUser({ AdminID: adminUsername, password: adminPassword });
                writeEnvVars({
                    DEPLOYMENT_MODE: 'local',
                    ADMIN_USERNAME: adminUsername,
                    ADMIN_PASSWORD: hashedPassword
                });
            } else {
                writeEnvVars({ DEPLOYMENT_MODE: 'local' });
            }
        }

        logDeploymentChange(req.AdminID, `Switched deployment mode to ${mode}`, { mode, remoteServerUrl: mode === 'remote' ? remoteServerUrl : undefined });
        logger.info(`Deployment mode switched to ${mode} by ${req.AdminID}`);

        res.json({ success: true, mode });
    } catch (error) {
        logger.error('Failed to update deployment settings:', error);
        res.status(500).json({ error: 'Failed to update deployment settings' });
    }
});

// Reachability + API-key validity check against a candidate hub, before committing to it
router.post('/test-connection', async (req, res) => {
    const { remoteServerUrl, apiKey } = req.body;
    if (!remoteServerUrl || !apiKey) {
        return res.status(400).json({ error: 'remoteServerUrl and apiKey are required' });
    }

    const baseUrl = remoteServerUrl.replace(/\/$/, '');
    let reachable = false;
    let validKey = false;
    let message = '';

    try {
        const healthRes = await fetch(`${baseUrl}/api/remote/health`);
        reachable = healthRes.ok;
        if (!reachable) {
            message = `Hub responded with ${healthRes.status}`;
        }
    } catch (err) {
        message = `Could not reach hub: ${err.message}`;
        return res.json({ reachable: false, validKey: false, message });
    }

    try {
        const authRes = await fetch(`${baseUrl}/api/remote/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
            body: JSON.stringify({ clientId: 'test-connection' })
        });
        validKey = authRes.ok;
        if (!validKey) {
            message = 'Hub is reachable but rejected the API key';
        }
    } catch (err) {
        message = `Reached the hub but the key check failed: ${err.message}`;
    }

    res.json({ reachable, validKey, message });
});

// Local-mode only: rotate the key remote instances must present at /api/remote/*.
// Existing remote instances start getting 401s until given the new value - the
// frontend confirms with the user before calling this.
router.post('/regenerate-api-key', (req, res) => {
    if (process.env.DEPLOYMENT_MODE !== 'local') {
        return res.status(403).json({ error: 'API key management is only available on the hub (local mode) instance' });
    }

    const apiKey = crypto.randomBytes(24).toString('base64url');
    writeEnvVars({ API_KEY: apiKey });

    logDeploymentChange(req.AdminID, 'Regenerated hub API key', {});
    logger.info(`Hub API key regenerated by ${req.AdminID}`);

    res.json({ apiKey });
});

module.exports = router;
