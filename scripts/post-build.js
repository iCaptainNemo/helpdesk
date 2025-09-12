#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Running post-build script...');

const frontendBuildDir = path.join(__dirname, '../frontend/build');
const serverJsPath = path.join(__dirname, '../Backend/server.js');

// 1. Fix CSP in index.html
const indexHtmlPath = path.join(frontendBuildDir, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let indexContent = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Replace the CSP meta tag
  const originalCSP = 'default-src \'self\' \'unsafe-inline\' \'unsafe-eval\' data: blob:; connect-src \'self\' http://localhost:* ws://localhost:* http://172.25.129.95:* ws://172.25.129.95:*; img-src \'self\' data: blob:;';
  const updatedCSP = 'default-src \'self\' \'unsafe-inline\' \'unsafe-eval\' data: blob:; connect-src \'self\' http://localhost:* ws://localhost:* http://172.25.129.95:* ws://172.25.129.95:*; img-src \'self\' data: blob:; style-src-elem \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src \'self\' https://fonts.gstatic.com;';
  
  indexContent = indexContent.replace(originalCSP, updatedCSP);
  
  fs.writeFileSync(indexHtmlPath, indexContent);
  console.log('✅ Fixed CSP in index.html');
} else {
  console.log('❌ index.html not found');
}

// 2. Update server.js with correct JS filename
const assetManifestPath = path.join(frontendBuildDir, 'asset-manifest.json');
if (fs.existsSync(assetManifestPath) && fs.existsSync(serverJsPath)) {
  const assetManifest = JSON.parse(fs.readFileSync(assetManifestPath, 'utf8'));
  const mainJsFile = assetManifest.files['main.js'];
  
  if (mainJsFile) {
    // Extract just the filename (e.g., "main.52aabf04.js")
    const jsFileName = path.basename(mainJsFile);
    
    let serverContent = fs.readFileSync(serverJsPath, 'utf8');
    
    // Find and replace the JS file serving route
    const jsRouteStartPattern = /app\.get\('\/static\/js\/main\.[a-f0-9]{8}\.js'/;
    const jsRouteFullPattern = /(\/\/ Serve main JS file\s*app\.get\('\/static\/js\/main\.[a-f0-9]{8}\.js'[\s\S]*?\}\);)/;
    
    if (jsRouteFullPattern.test(serverContent)) {
      const newJsRoute = `// Serve main JS file
    app.get('/static/js/${jsFileName}', (req, res) => {
        try {
            const jsPath = path.join(__dirname, '../frontend/build/static/js/${jsFileName}');
            const content = fs.readFileSync(jsPath, 'utf8');
            res.setHeader('Content-Type', 'application/javascript');
            res.send(content);
        } catch (err) {
            console.log(\`[DEBUG] Failed to serve JS file: \${err.message}\`);
            res.status(404).send('JS file not found');
        }
    });`;
      
      serverContent = serverContent.replace(jsRouteFullPattern, newJsRoute);
      fs.writeFileSync(serverJsPath, serverContent);
      console.log(`✅ Updated server.js with JS filename: ${jsFileName}`);
    } else if (jsRouteStartPattern.test(serverContent)) {
      // Fallback: just replace the filename in the route
      serverContent = serverContent.replace(
        /app\.get\('\/static\/js\/main\.[a-f0-9]{8}\.js'/,
        `app.get('/static/js/${jsFileName}'`
      );
      serverContent = serverContent.replace(
        /const jsPath = path\.join\(__dirname, '\.\.\/frontend\/build\/static\/js\/main\.[a-f0-9]{8}\.js'\);/,
        `const jsPath = path.join(__dirname, '../frontend/build/static/js/${jsFileName}');`
      );
      fs.writeFileSync(serverJsPath, serverContent);
      console.log(`✅ Updated server.js with JS filename (fallback method): ${jsFileName}`);
    } else {
      console.log('❌ Could not find JS route pattern in server.js');
    }
  } else {
    console.log('❌ main.js not found in asset-manifest.json');
  }
} else {
  console.log('❌ asset-manifest.json or server.js not found');
}

console.log('Post-build script completed!');