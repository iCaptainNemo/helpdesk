// Detection for external tools the jarvis:// deep link launches (see
// registrySetup.js / JarvisLauncher.bat). CmRcViewer (SCCM/MECM's Remote
// Control Viewer) and PsExec are not part of Windows and aren't guaranteed to
// be installed at any particular path - this lets the app report whether
// they're actually available, and where, instead of the launcher silently
// trying (and failing) to run a missing exe.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { readEnvFile } = require('./envFile');

function probePath(candidatePath) {
    try {
        return Boolean(candidatePath) && fs.existsSync(candidatePath);
    } catch {
        return false;
    }
}

// Non-invasive PATH lookup - unlike spawning the tool itself, `where` just
// resolves the path (or fails) without side effects.
function probeOnPath(exeName) {
    return new Promise((resolve) => {
        execFile('where', [exeName], (error, stdout) => {
            if (error || !stdout) {
                resolve(null);
                return;
            }
            const firstMatch = stdout.split(/\r?\n/).map(l => l.trim()).find(Boolean);
            resolve(firstMatch || null);
        });
    });
}

const CMRCVIEWER_CANDIDATES = [
    'C:\\Program Files (x86)\\Microsoft Endpoint Manager\\AdminConsole\\bin\\i386\\CmRcViewer.exe',
    'C:\\Program Files\\Microsoft Configuration Manager\\AdminConsole\\bin\\i386\\CmRcViewer.exe',
    'C:\\Program Files\\RcViewer\\CmRcViewer.exe',
    'C:\\Program Files (x86)\\RcViewer\\CmRcViewer.exe'
];

async function detectCmRcViewer() {
    const env = readEnvFile();
    if (env.CMRCVIEWER_PATH && probePath(env.CMRCVIEWER_PATH)) {
        return { available: true, path: env.CMRCVIEWER_PATH, source: 'override' };
    }

    for (const candidate of CMRCVIEWER_CANDIDATES) {
        if (probePath(candidate)) {
            return { available: true, path: candidate, source: 'detected' };
        }
    }

    const onPath = await probeOnPath('CmRcViewer.exe');
    if (onPath) {
        return { available: true, path: onPath, source: 'detected' };
    }

    return { available: false, path: null, source: null };
}

function bundledPsExecPath() {
    const toolsPath = process.pkg
        ? path.join(process.cwd(), 'Tools')
        : path.join(__dirname, '../../Tools');
    return path.join(toolsPath, 'PsExec.exe');
}

async function detectPsExec() {
    const env = readEnvFile();
    if (env.PSEXEC_PATH && probePath(env.PSEXEC_PATH)) {
        return { available: true, path: env.PSEXEC_PATH, source: 'override' };
    }

    const bundled = bundledPsExecPath();
    if (probePath(bundled)) {
        return { available: true, path: bundled, source: 'detected' };
    }

    const onPath = await probeOnPath('psexec.exe');
    if (onPath) {
        return { available: true, path: onPath, source: 'detected' };
    }

    return { available: false, path: null, source: null };
}

async function getExternalToolsStatus() {
    const [cmRcViewer, psExec] = await Promise.all([detectCmRcViewer(), detectPsExec()]);
    return { cmRcViewer, psExec };
}

module.exports = { detectCmRcViewer, detectPsExec, getExternalToolsStatus, probePath };
