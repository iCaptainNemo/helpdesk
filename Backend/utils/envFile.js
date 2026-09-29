const fs = require('fs');
const path = require('path');

// Centralizes the .env location + read/modify/write pattern that used to be
// copy-pasted in auth.js and setup.js. Writing here also updates process.env
// in memory, so callers take effect immediately without a restart - safe
// because DEPLOYMENT_MODE/REMOTE_SERVER_URL/API_KEY (and everything else this
// touches) are read fresh per-request everywhere in this codebase, never
// cached into a module-level const.
function getEnvPath() {
    return process.pkg
        ? path.join(process.cwd(), '.env')
        : path.join(__dirname, '../.env');
}

function readEnvFile() {
    const envPath = getEnvPath();
    if (!fs.existsSync(envPath)) {
        return {};
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) {
            return;
        }
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1);
        if (key) {
            env[key] = value;
        }
    });
    return env;
}

function writeEnvVars(updates) {
    const envPath = getEnvPath();
    const current = readEnvFile();
    const merged = { ...current, ...updates };

    const envData = Object.entries(merged)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    fs.writeFileSync(envPath, envData);

    Object.entries(updates).forEach(([key, value]) => {
        process.env[key] = value;
    });

    return merged;
}

module.exports = { getEnvPath, readEnvFile, writeEnvVars };
