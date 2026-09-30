const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getExternalToolsStatus, probePath } = require('../utils/externalTools');
const { writeEnvVars, deleteEnvVars } = require('../utils/envFile');
const RegistrySetup = require('../utils/registrySetup');
const db = require('../db/init');

// CmRcViewer (SCCM/MECM's Remote Control Viewer) and PsExec aren't part of
// Windows, so their install path varies per machine/domain - this lets the
// tech see what was auto-detected and override it if needed. Per-machine
// instance config, not hub-database config, so it's gated the same as
// /api/deployment ('manage_deployment') rather than 'access_configure_page' -
// relevant in both local and remote mode.

function logToolPathChange(adminID, details) {
    try {
        db.prepare(`
            INSERT INTO RecentActions (adminID, activity, target, action_type, details, result)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(adminID, 'Updated external tool path', null, 'external_tools_config', JSON.stringify(details), 'success');
    } catch (err) {
        logger.error('Failed to log external tool path change:', err);
    }
}

router.get('/', async (req, res) => {
    try {
        const status = await getExternalToolsStatus();
        res.json(status);
    } catch (error) {
        logger.error('Failed to get external tools status:', error);
        res.status(500).json({ error: 'Failed to get external tools status' });
    }
});

router.put('/', async (req, res) => {
    const { cmRcViewerPath, psExecPath } = req.body;

    try {
        const updates = {};
        const removals = [];

        if (cmRcViewerPath !== undefined) {
            if (cmRcViewerPath === '') {
                removals.push('CMRCVIEWER_PATH');
            } else if (!probePath(cmRcViewerPath)) {
                return res.status(400).json({ error: `CmRcViewer path does not exist: ${cmRcViewerPath}` });
            } else {
                updates.CMRCVIEWER_PATH = cmRcViewerPath;
            }
        }

        if (psExecPath !== undefined) {
            if (psExecPath === '') {
                removals.push('PSEXEC_PATH');
            } else if (!probePath(psExecPath)) {
                return res.status(400).json({ error: `PsExec path does not exist: ${psExecPath}` });
            } else {
                updates.PSEXEC_PATH = psExecPath;
            }
        }

        if (Object.keys(updates).length > 0) {
            writeEnvVars(updates);
        }
        if (removals.length > 0) {
            deleteEnvVars(removals);
        }

        // Re-resolve (picks up the new override or the fallback to auto-detect)
        // and rewrite the launcher .bat so the deep link uses it immediately.
        const status = await getExternalToolsStatus();
        const registrySetup = new RegistrySetup();
        await registrySetup.createLauncherFiles(status.cmRcViewer.path, status.psExec.path);

        logToolPathChange(req.AdminID, { cmRcViewerPath: updates.CMRCVIEWER_PATH, psExecPath: updates.PSEXEC_PATH, cleared: removals });
        logger.info(`External tool paths updated by ${req.AdminID}`);

        res.json(status);
    } catch (error) {
        logger.error('Failed to update external tool paths:', error);
        res.status(500).json({ error: 'Failed to update external tool paths' });
    }
});

module.exports = router;
