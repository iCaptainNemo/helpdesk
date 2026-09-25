#!/usr/bin/env node

/**
 * Copy frontend/build into releases/build/ at build time.
 *
 * pkg's snapshot asset embedding was found to silently drop files under
 * frontend/build/static/js and static/css with no clear pattern - the exact
 * same unexplained behavior hit Backend/functions/*.ps1 (see
 * copy-ps-scripts.js for the full writeup). pkg itself reports these files as
 * "not included into executable at compilation stage" at runtime despite
 * matching the configured asset globs. Copying the whole build output to a
 * real folder next to the exe sidesteps the snapshot entirely - server.js
 * serves it with plain express.static() in both dev and packaged mode now,
 * the same code path either way.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'frontend/build');
const targetDir = path.join(root, 'releases/build');

if (!fs.existsSync(sourceDir)) {
    console.error('frontend/build not found - run the frontend build first.');
    process.exit(1);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log('Frontend build copied -> releases/build/');
