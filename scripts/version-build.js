#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Starting versioned build...\n');

// Read version from package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`📦 Building Helpdesk Jarvis v${version}`);
console.log('━'.repeat(50));

// Define output paths
const releasesDir = path.join(__dirname, '../releases');
const versionedExe = path.join(releasesDir, `helpdesk-jarvis-v${version}.exe`);
const latestExe = path.join(releasesDir, 'helpdesk-jarvis.exe');

// Ensure releases directory exists
if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
  console.log('✅ Created releases directory');
}

// Run pkg to build the executable
console.log('\n📦 Running pkg...');
try {
  execSync(
    `pkg Backend/server.js --targets node18-win-x64 --output "${versionedExe}"`,
    { stdio: 'inherit', cwd: path.join(__dirname, '..') }
  );
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Create a copy as latest
console.log('\n📋 Creating latest copy...');
fs.copyFileSync(versionedExe, latestExe);

// Get file size
const stats = fs.statSync(versionedExe);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log('\n✅ Build completed successfully!');
console.log('━'.repeat(50));
console.log(`📦 Version:       v${version}`);
console.log(`📁 Versioned EXE: releases/helpdesk-jarvis-v${version}.exe`);
console.log(`📁 Latest EXE:    releases/helpdesk-jarvis.exe`);
console.log(`💾 File Size:     ${fileSizeMB} MB`);
console.log('━'.repeat(50));
console.log('\n🚀 Ready to deploy!');
