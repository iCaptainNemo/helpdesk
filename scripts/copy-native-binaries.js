#!/usr/bin/env node

/**
 * Copy native (.node) addons into the paths the pkg bundle expects.
 *
 * Done in Node (not shell) because npm runs scripts via cmd.exe on Windows,
 * where `mkdir -p "a/b/c"` and `cp` behave inconsistently. fs.mkdirSync/copyFileSync
 * are cross-platform and fail loudly if a source binary is genuinely missing.
 *
 * The better-sqlite3 target folder is named for the Node ABI of the pkg target
 * (node22 => ABI 127 => node-v127). If you change the pkg target Node version,
 * update ABI_FOLDER to match (Node18=108, 20=115, 22=127).
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ABI_FOLDER = 'node-v127-win32-x64'; // Node 22 ABI

const copies = [
  {
    label: 'better-sqlite3',
    from: path.join(root, 'Backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node'),
    to: path.join(root, 'Backend/node_modules/better-sqlite3/lib/binding', ABI_FOLDER, 'better_sqlite3.node'),
    required: true
  },
  {
    label: 'bcrypt',
    from: path.join(root, 'Backend/node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node'),
    to: path.join(root, 'dist/Backend/node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node'),
    required: false // NAPI is ABI-stable; bcryptPkg.js wrapper also handles loading
  }
];

let failed = false;
for (const c of copies) {
  if (!fs.existsSync(c.from)) {
    const msg = `Source binary not found for ${c.label}: ${c.from}`;
    if (c.required) { console.error(`❌ ${msg}`); failed = true; }
    else { console.warn(`⚠️  ${msg} (skipping, non-required)`); }
    continue;
  }
  fs.mkdirSync(path.dirname(c.to), { recursive: true });
  fs.copyFileSync(c.from, c.to);
  console.log(`✅ ${c.label} binary copied -> ${path.relative(root, c.to)}`);
}

if (failed) {
  console.error('Native binary copy failed — the exe would crash on startup.');
  process.exit(1);
}
console.log('Native binaries ready.');
