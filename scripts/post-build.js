#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Running post-build script...');

const frontendBuildDir = path.join(__dirname, '../frontend/build');

// 1. Fix CSP in index.html
const indexHtmlPath = path.join(frontendBuildDir, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let indexContent = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Replace any existing CSP with the updated one
  const targetCSP = 'default-src \'self\' \'unsafe-inline\' \'unsafe-eval\' data: blob:; connect-src \'self\' http://localhost:* ws://localhost:* http://172.25.129.95:* ws://172.25.129.95:*; img-src \'self\' data: blob:; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; style-src-elem \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src \'self\' https://fonts.gstatic.com;';
  
  // Find and replace the entire Content-Security-Policy content
  indexContent = indexContent.replace(
    /<meta http-equiv="Content-Security-Policy" content="[^"]*">/,
    `<meta http-equiv="Content-Security-Policy" content="${targetCSP}">`
  );
  
  fs.writeFileSync(indexHtmlPath, indexContent);
  console.log('✅ Fixed CSP in index.html');
} else {
  console.log('❌ index.html not found');
}

// 2. Verify asset-manifest.json exists (no longer need to update server.js)
const assetManifestPath = path.join(frontendBuildDir, 'asset-manifest.json');
if (fs.existsSync(assetManifestPath)) {
  const assetManifest = JSON.parse(fs.readFileSync(assetManifestPath, 'utf8'));
  console.log('✅ Asset manifest verified - dynamic asset serving will handle file routing');
  console.log(`   Main JS: ${assetManifest.files['main.js']}`);
  console.log(`   Main CSS: ${assetManifest.files['main.css']}`);
} else {
  console.log('❌ asset-manifest.json not found - this may cause static asset issues');
}

console.log('Post-build script completed!');