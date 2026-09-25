const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { fetchUserTabs, upsertUserTabsBlob, upsertSyncPreference } = require('../db/queries');

// Generous cap - {name, showAdvanced} objects are ~50 bytes each, so this stays well
// under body-parser's 100KB JSON limit even fully loaded.
const MAX_TABS = 300;

// Strip request input down to exactly {name, showAdvanced} - defends against a client
// ever sending the full AD object blob (the frontend never should, but this is the
// server-side backstop so a stray `data` field never gets persisted or bloats storage).
function sanitizeTabs(input) {
    if (!Array.isArray(input)) return null;
    return input
        .filter(t => t && typeof t.name === 'string' && t.name.length > 0)
        .slice(0, MAX_TABS)
        .map(t => ({ name: t.name, showAdvanced: !!t.showAdvanced }));
}

// GET /api/tabs -> { enabled, tabs, updatedAt } for the logged-in admin
router.get('/', async (req, res) => {
    try {
        const adminID = req.user?.AdminID;
        if (!adminID) {
            return res.status(400).json({ error: 'Admin authentication required' });
        }
        const result = await fetchUserTabs(adminID);
        res.json(result);
    } catch (error) {
        logger.error('[Tabs] Error fetching tabs:', error);
        res.status(500).json({ error: 'Failed to fetch tabs' });
    }
});

// POST /api/tabs { tabs: [...] } -> background sync write (overwrite, no merge)
router.post('/', async (req, res) => {
    try {
        const adminID = req.user?.AdminID;
        if (!adminID) {
            return res.status(400).json({ error: 'Admin authentication required' });
        }
        const tabs = sanitizeTabs(req.body.tabs);
        if (tabs === null) {
            return res.status(400).json({ error: 'tabs must be an array' });
        }
        await upsertUserTabsBlob(adminID, tabs);
        res.json({ success: true, updatedAt: new Date().toISOString() });
    } catch (error) {
        logger.error('[Tabs] Error saving tabs:', error);
        res.status(500).json({ error: 'Failed to save tabs' });
    }
});

// PUT /api/tabs/preference { enabled, tabs? } -> toggle sync on/off, optionally seeding
// (unioning) tabs when turning on
router.put('/preference', async (req, res) => {
    try {
        const adminID = req.user?.AdminID;
        if (!adminID) {
            return res.status(400).json({ error: 'Admin authentication required' });
        }
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled must be boolean' });
        }

        let tabs;
        if (req.body.tabs !== undefined) {
            tabs = sanitizeTabs(req.body.tabs);
            if (tabs === null) {
                return res.status(400).json({ error: 'tabs must be an array' });
            }
        }

        await upsertSyncPreference(adminID, enabled, tabs);
        const result = await fetchUserTabs(adminID);
        logger.info(`[Tabs] Sync ${enabled ? 'enabled' : 'disabled'} for ${adminID}`);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('[Tabs] Error updating sync preference:', error);
        res.status(500).json({ error: 'Failed to update sync preference' });
    }
});

module.exports = router;
