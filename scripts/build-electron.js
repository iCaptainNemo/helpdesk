const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Electron build process...\n');

// Step 1: Build frontend
console.log('📦 Building React frontend...');
exec('cd frontend && npm run build', (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Frontend build failed:', error);
        process.exit(1);
    }
    
    if (stderr) {
        console.warn('⚠️  Frontend build warnings:', stderr);
    }
    
    console.log('✅ Frontend build completed\n');
    
    // Step 2: Verify backend structure
    console.log('🔍 Verifying backend structure...');
    const backendPath = path.join(__dirname, '../Backend');
    const requiredFiles = ['server.js', 'package.json'];
    
    for (const file of requiredFiles) {
        const filePath = path.join(backendPath, file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ Missing required backend file: ${file}`);
            process.exit(1);
        }
    }
    
    console.log('✅ Backend structure verified\n');
    
    // Step 3: Install backend dependencies in build context
    console.log('📋 Installing backend production dependencies...');
    exec('cd Backend && npm install --only=production', (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Backend dependency installation failed:', error);
            process.exit(1);
        }
        
        console.log('✅ Backend dependencies installed\n');
        
        // Step 4: Build Electron package
        console.log('⚡ Building Electron application...');
        exec('electron-builder', (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Electron build failed:', error);
                console.error('Make sure you have the required dependencies installed:');
                console.error('npm install --save-dev electron electron-builder wait-on electron-is-dev');
                process.exit(1);
            }
            
            if (stderr && !stderr.includes('warning')) {
                console.error('❌ Electron build error:', stderr);
                process.exit(1);
            }
            
            console.log('🎉 Electron application built successfully!');
            console.log('\n📁 Built files are located in the /dist directory');
            console.log('🚀 You can now distribute the installer to users\n');
            
            // Display build artifacts
            const distPath = path.join(__dirname, '../dist');
            if (fs.existsSync(distPath)) {
                const files = fs.readdirSync(distPath);
                console.log('📦 Build artifacts:');
                files.forEach(file => {
                    const stats = fs.statSync(path.join(distPath, file));
                    const size = (stats.size / 1024 / 1024).toFixed(2);
                    console.log(`   - ${file} (${size} MB)`);
                });
            }
        });
    });
});

// Handle script termination
process.on('SIGINT', () => {
    console.log('\n⚠️  Build process interrupted');
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});