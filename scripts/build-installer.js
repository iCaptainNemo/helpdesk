const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 Building Custom NSIS Installer...\n');

// Configuration
const config = {
    nsisPath: 'C:\\Program Files (x86)\\NSIS\\makensis.exe', // Default NSIS path
    scriptPath: path.join(__dirname, '../installer/setup.nsi'),
    outputDir: path.join(__dirname, '../dist'),
    assetsDir: path.join(__dirname, '../installer/assets')
};

// Step 1: Check prerequisites
console.log('📋 Checking prerequisites...');

function checkPrerequisites() {
    // Check if NSIS is installed
    if (!fs.existsSync(config.nsisPath)) {
        console.error('❌ NSIS not found at:', config.nsisPath);
        console.error('Please install NSIS from: https://nsis.sourceforge.io/Download');
        console.error('Or update the nsisPath in this script to match your installation');
        return false;
    }
    
    // Check if Electron build exists
    const electronBuildPath = path.join(__dirname, '../dist/win-unpacked');
    if (!fs.existsSync(electronBuildPath)) {
        console.error('❌ Electron build not found at:', electronBuildPath);
        console.error('Please run "npm run dist:win" first to create the Electron build');
        return false;
    }
    
    // Check if installer script exists
    if (!fs.existsSync(config.scriptPath)) {
        console.error('❌ NSIS script not found at:', config.scriptPath);
        return false;
    }
    
    console.log('✅ Prerequisites check passed');
    return true;
}

// Step 2: Prepare assets
function prepareAssets() {
    console.log('🎨 Preparing installer assets...');
    
    const requiredAssets = ['license.txt'];
    const optionalAssets = ['icon.ico', 'header.bmp', 'wizard.bmp'];
    
    for (const asset of requiredAssets) {
        const assetPath = path.join(config.assetsDir, asset);
        if (!fs.existsSync(assetPath)) {
            console.error(`❌ Required asset missing: ${asset}`);
            return false;
        }
    }
    
    for (const asset of optionalAssets) {
        const assetPath = path.join(config.assetsDir, asset);
        if (!fs.existsSync(assetPath)) {
            console.warn(`⚠️  Optional asset missing: ${asset} (installer will use defaults)`);
        }
    }
    
    console.log('✅ Assets preparation completed');
    return true;
}

// Step 3: Build installer
function buildInstaller() {
    return new Promise((resolve, reject) => {
        console.log('🚀 Building NSIS installer...');
        
        const command = `"${config.nsisPath}" "${config.scriptPath}"`;
        
        exec(command, { cwd: path.dirname(config.scriptPath) }, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ NSIS build failed:', error);
                reject(error);
                return;
            }
            
            if (stderr && !stderr.includes('warning')) {
                console.error('❌ NSIS build error:', stderr);
                reject(new Error(stderr));
                return;
            }
            
            console.log('📦 NSIS Output:');
            console.log(stdout);
            
            // Check if installer was created
            const installerPath = path.join(path.dirname(config.scriptPath), 'Helpdesk-Jarvis-Setup.exe');
            if (fs.existsSync(installerPath)) {
                // Move installer to dist directory
                const finalPath = path.join(config.outputDir, 'Helpdesk-Jarvis-Setup.exe');
                fs.copyFileSync(installerPath, finalPath);
                fs.unlinkSync(installerPath); // Remove from original location
                
                const stats = fs.statSync(finalPath);
                const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
                
                console.log('🎉 Installer built successfully!');
                console.log(`📁 Location: ${finalPath}`);
                console.log(`📊 Size: ${sizeInMB} MB`);
                
                resolve(finalPath);
            } else {
                reject(new Error('Installer file not found after build'));
            }
        });
    });
}

// Step 4: Validate installer
function validateInstaller(installerPath) {
    console.log('🔍 Validating installer...');
    
    if (!fs.existsSync(installerPath)) {
        console.error('❌ Installer file not found');
        return false;
    }
    
    const stats = fs.statSync(installerPath);
    if (stats.size < 1024 * 1024) { // Less than 1MB is suspicious
        console.warn('⚠️  Installer size seems small, please verify');
    }
    
    console.log('✅ Installer validation completed');
    return true;
}

// Main execution
async function main() {
    try {
        // Check prerequisites
        if (!checkPrerequisites()) {
            process.exit(1);
        }
        
        // Prepare assets
        if (!prepareAssets()) {
            process.exit(1);
        }
        
        // Build installer
        const installerPath = await buildInstaller();
        
        // Validate installer
        if (!validateInstaller(installerPath)) {
            process.exit(1);
        }
        
        console.log('\n🎊 Custom installer build completed successfully!');
        console.log('📋 Next steps:');
        console.log('   1. Test the installer on a clean system');
        console.log('   2. Verify all shortcuts and registry entries');
        console.log('   3. Test uninstaller functionality');
        console.log('   4. Sign the installer for production distribution');
        console.log(`   5. Upload to release: ${installerPath}`);
        
    } catch (error) {
        console.error('❌ Installer build failed:', error);
        process.exit(1);
    }
}

// Handle script termination
process.on('SIGINT', () => {
    console.log('\n⚠️  Installer build interrupted');
    process.exit(1);
});

// Run main function
main();