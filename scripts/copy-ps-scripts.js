#!/usr/bin/env node

/**
 * Copy Backend/functions/*.ps1 into releases/functions/ at build time.
 *
 * PowerShell.exe (an external process) needs real files on disk - it can't read
 * pkg's embedded snapshot filesystem, so these have always needed to land next
 * to the exe one way or another. They used to be pulled from pkg's snapshot at
 * startup (Backend/utils/scriptExtractor.js), but pkg's asset bundling was found
 * to silently drop a subset of these files with no clear pattern (verified: the
 * same ~12 of 20 scripts were missing regardless of glob pattern, total asset
 * count, file size, or encoding - the cause wasn't isolated). Copying them
 * directly at build time, the same way copy-native-binaries.js already handles
 * the native .node binaries, sidesteps that entirely: no snapshot involved.
 *
 * scriptExtractor.js's runtime extraction is left in place as a harmless
 * fallback (it no-ops if the target file already exists).
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'Backend/functions');
const targetDir = path.join(root, 'releases/functions');

fs.mkdirSync(targetDir, { recursive: true });

const scripts = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.ps1'));

if (scripts.length === 0) {
    console.error('No PowerShell scripts found in Backend/functions - nothing copied.');
    process.exit(1);
}

for (const scriptName of scripts) {
    fs.copyFileSync(path.join(sourceDir, scriptName), path.join(targetDir, scriptName));
}

console.log(`PowerShell scripts copied: ${scripts.length} files -> releases/functions/`);
