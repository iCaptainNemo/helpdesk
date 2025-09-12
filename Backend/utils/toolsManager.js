const fs = require('fs');
const path = require('path');
const https = require('https');
const logger = require('./logger');

class ToolsManager {
    constructor() {
        // GitHub repository information
        this.githubOwner = 'iCaptainNemo'; 
        this.githubRepo = 'helpdesk'; 
        this.githubBranch = 'Jarvis-GUI';
        
        // Tools folder path (relative to exe location)
        this.toolsPath = process.pkg 
            ? path.join(process.cwd(), 'Tools')
            : path.join(__dirname, '../../Tools');
            
        // Required tools configuration
        this.requiredTools = [
            {
                name: 'PsLoggedon.exe',
                url: `https://raw.githubusercontent.com/${this.githubOwner}/${this.githubRepo}/${this.githubBranch}/Tools/PsLoggedon.exe`,
                description: 'PsTools - Show logged on users'
            },
            {
                name: 'PsInfo.exe', 
                url: `https://raw.githubusercontent.com/${this.githubOwner}/${this.githubRepo}/${this.githubBranch}/Tools/PsInfo.exe`,
                description: 'PsTools - System information utility'
            },
            {
                name: 'windirstat.exe',
                url: `https://raw.githubusercontent.com/${this.githubOwner}/${this.githubRepo}/${this.githubBranch}/Tools/windirstat.exe`,
                description: 'WinDirStat - Directory statistics'
            }
        ];
    }

    /**
     * Check if Tools folder exists and create it if needed
     */
    ensureToolsFolder() {
        try {
            if (!fs.existsSync(this.toolsPath)) {
                fs.mkdirSync(this.toolsPath, { recursive: true });
                logger.info(`Created Tools folder: ${this.toolsPath}`);
            }
            return true;
        } catch (error) {
            logger.error('Failed to create Tools folder:', error);
            return false;
        }
    }

    /**
     * Check if a specific tool exists
     */
    toolExists(toolName) {
        const toolPath = path.join(this.toolsPath, toolName);
        return fs.existsSync(toolPath);
    }

    /**
     * Get missing tools
     */
    getMissingTools() {
        return this.requiredTools.filter(tool => !this.toolExists(tool.name));
    }

    /**
     * Download a file from URL
     */
    downloadFile(url, outputPath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(outputPath);
            
            https.get(url, (response) => {
                if (response.statusCode === 200) {
                    response.pipe(file);
                    
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                    
                    file.on('error', (err) => {
                        fs.unlink(outputPath, () => {}); // Delete partial file
                        reject(err);
                    });
                } else {
                    file.close();
                    fs.unlink(outputPath, () => {}); // Delete empty file
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                }
            }).on('error', (err) => {
                file.close();
                fs.unlink(outputPath, () => {}); // Delete empty file
                reject(err);
            });
        });
    }

    /**
     * Download a specific tool
     */
    async downloadTool(tool) {
        const outputPath = path.join(this.toolsPath, tool.name);
        
        try {
            logger.info(`Downloading ${tool.name}...`);
            await this.downloadFile(tool.url, outputPath);
            logger.info(`✅ Successfully downloaded ${tool.name}`);
            return true;
        } catch (error) {
            logger.error(`❌ Failed to download ${tool.name}:`, error.message);
            return false;
        }
    }

    /**
     * Download all missing tools
     */
    async downloadMissingTools() {
        const missingTools = this.getMissingTools();
        
        if (missingTools.length === 0) {
            logger.info('✅ All required tools are already present');
            return true;
        }

        logger.info(`📥 Found ${missingTools.length} missing tools, downloading...`);
        
        let downloadCount = 0;
        
        for (const tool of missingTools) {
            const success = await this.downloadTool(tool);
            if (success) {
                downloadCount++;
            }
        }
        
        if (downloadCount === missingTools.length) {
            logger.info(`✅ Successfully downloaded all ${downloadCount} missing tools`);
            return true;
        } else {
            logger.warn(`⚠️ Downloaded ${downloadCount}/${missingTools.length} tools. Some downloads failed.`);
            return false;
        }
    }

    /**
     * Check tools status and provide report
     */
    getToolsStatus() {
        const status = {
            toolsFolder: fs.existsSync(this.toolsPath),
            tools: {}
        };

        for (const tool of this.requiredTools) {
            status.tools[tool.name] = {
                exists: this.toolExists(tool.name),
                description: tool.description,
                path: path.join(this.toolsPath, tool.name)
            };
        }

        return status;
    }

    /**
     * Main setup routine - ensures tools are available
     */
    async setupTools() {
        try {
            logger.info('🔧 Checking Tools folder setup...');

            // Ensure Tools folder exists
            if (!this.ensureToolsFolder()) {
                logger.error('❌ Failed to create Tools folder');
                return false;
            }

            // Check and download missing tools
            const success = await this.downloadMissingTools();
            
            if (success) {
                logger.info('✅ Tools setup completed successfully');
                
                // Log final status
                const status = this.getToolsStatus();
                logger.info('📋 Tools Status:');
                for (const [toolName, toolInfo] of Object.entries(status.tools)) {
                    const statusIcon = toolInfo.exists ? '✅' : '❌';
                    logger.info(`  ${statusIcon} ${toolName} - ${toolInfo.description}`);
                }
                
                return true;
            } else {
                logger.warn('⚠️ Tools setup completed with some failures');
                return false;
            }

        } catch (error) {
            logger.error('❌ Tools setup failed:', error);
            return false;
        }
    }

    /**
     * Alternative fallback instructions for manual download
     */
    displayManualInstructions() {
        const missingTools = this.getMissingTools();
        
        if (missingTools.length === 0) return;

        const instructions = `
⚠️  MANUAL TOOLS SETUP REQUIRED ⚠️

Some required tools could not be downloaded automatically.
Please manually download the following files to: ${this.toolsPath}

${missingTools.map(tool => `📁 ${tool.name} - ${tool.description}
   Download from: ${tool.url}`).join('\n\n')}

Alternative: Clone the repository and copy the Tools folder:
git clone https://github.com/${this.githubOwner}/${this.githubRepo}.git
copy Tools\\* "${this.toolsPath}\\"

This is required for external system information features.
`;

        logger.warn(instructions);
        console.warn(instructions);
    }
}

module.exports = ToolsManager;