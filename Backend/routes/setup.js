const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { insertOrUpdateAdminUser } = require('../db/queries'); // Import the function
const { hashPassword } = require('../utils/hashUtils'); // Import the hashPassword function
const bcrypt = require('bcrypt');
const { getSystemInfo } = require('../config/modes'); // Import configuration system
const logger = require('../utils/logger'); // Import logger
const router = express.Router();

// Get system information for setup wizard
router.get('/system-info', (req, res) => {
  try {
    const systemUsername = process.env.USERNAME || process.env.USER || 'helpdesk_agent';
    const sanitizedUsername = systemUsername.replace(/[^a-zA-Z0-9_-]/g, ''); // Sanitize username
    const computerName = process.env.COMPUTERNAME || process.env.HOSTNAME || 'localhost';
    
    logger.info(`Providing system info: username=${sanitizedUsername}, computer=${computerName}`);
    
    res.json({
      systemUsername: sanitizedUsername,
      computerName: computerName,
      platform: process.platform,
      nodeVersion: process.version
    });
  } catch (error) {
    logger.error('Error getting system info:', error);
    res.status(500).json({ error: 'Failed to get system information' });
  }
});

// Check setup status
router.get('/status', (req, res) => {
  try {
    logger.info('Setup status check requested');
    
    const envFilePath = process.pkg 
      ? path.join(process.cwd(), '.env')
      : path.join(__dirname, '../.env');
    const setupConfigPath = process.pkg 
      ? path.join(process.cwd(), 'setupConfig.js')
      : path.join(__dirname, '../../setupConfig.js');
    
    // Check if essential files exist
    const envExists = fs.existsSync(envFilePath);
    const setupConfigExists = fs.existsSync(setupConfigPath);
    
    logger.info(`File existence check: .env=${envExists}, setupConfig=${setupConfigExists}`);
    
    let configured = false;
    let configDetails = {
      envExists,
      setupConfigExists,
      mode: 'unknown',
      hasRequiredFields: false
    };
    
    if (envExists && setupConfigExists) {
      const envContent = fs.readFileSync(envFilePath, 'utf8');
      
      // Check for deployment mode setup (new system)
      if (envContent.includes('DEPLOYMENT_MODE=')) {
        const mode = envContent.match(/DEPLOYMENT_MODE=(\w+)/)?.[1] || 'unknown';
        configDetails.mode = mode;
        logger.info(`Found deployment mode: ${mode}`);
        
        const hasJwtSecret = envContent.includes('JWT_SECRET=');
        const hasSessionSecret = envContent.includes('SESSION_SECRET=');
        
        if (mode === 'local') {
          const hasAdminCredentials = envContent.includes('ADMIN_USERNAME=') && envContent.includes('ADMIN_PASSWORD=');
          configured = hasJwtSecret && hasSessionSecret && hasAdminCredentials;
          configDetails.hasRequiredFields = hasAdminCredentials;
        } else if (mode === 'remote') {
          const hasRemoteConfig = envContent.includes('REMOTE_SERVER_URL=') && envContent.includes('API_KEY=');
          configured = hasJwtSecret && hasSessionSecret && hasRemoteConfig;
          configDetails.hasRequiredFields = hasRemoteConfig;
        }
      } else {
        // Legacy system - if basic configuration exists, consider it configured
        configDetails.mode = 'legacy';
        const hasJwtSecret = envContent.includes('JWT_SECRET=');
        const hasSessionSecret = envContent.includes('SESSION_SECRET=');
        const hasBackendUrl = envContent.includes('BACKEND_URL=');
        configured = hasJwtSecret && hasSessionSecret && hasBackendUrl;
        configDetails.hasRequiredFields = hasJwtSecret && hasSessionSecret && hasBackendUrl;
        logger.info(`Legacy system detected: JWT=${hasJwtSecret}, Session=${hasSessionSecret}, Backend=${hasBackendUrl}`);
      }
    }
    
    logger.info(`Setup status result: configured=${configured}, details:`, configDetails);
    
    res.json({ 
      configured,
      details: configDetails
    });
  } catch (error) {
    logger.error('Error checking setup status:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// Handle wizard setup
router.post('/wizard', async (req, res) => {
  try {
    const { mode, adminCredentials, remoteConnection, systemSettings } = req.body;
    
    const envFilePath = process.pkg 
      ? path.join(process.cwd(), '.env')
      : path.join(__dirname, '../.env');
    const setupConfigPath = process.pkg 
      ? path.join(process.cwd(), 'setupConfig.js')
      : path.join(__dirname, '../../setupConfig.js');
    
    // Read existing .env if it exists
    let existingEnv = {};
    if (fs.existsSync(envFilePath)) {
      const envContent = fs.readFileSync(envFilePath, 'utf8');
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          existingEnv[key] = value;
        }
      });
    }
    
    // Generate secure secrets if they don't exist
    const jwtSecret = existingEnv.JWT_SECRET || generateRandomString(32);
    const sessionSecret = existingEnv.SESSION_SECRET || generateRandomString(16);
    
    // Prepare environment variables based on mode
    let envVars = {
      ...existingEnv,
      DEPLOYMENT_MODE: mode,
      JWT_SECRET: jwtSecret,
      SESSION_SECRET: sessionSecret,
      JWT_EXPIRATION: '5D',
      AD_DOMAIN: systemSettings.adDomain,
      AD_GROUPS: systemSettings.adGroups,
      TEMP_PASSWORD: systemSettings.tempPassword,
    };
    
    if (mode === 'local') {
      // Local mode setup - use current system username
      const systemUsername = process.env.USERNAME || process.env.USER || 'helpdesk_agent';
      const sanitizedUsername = systemUsername.replace(/[^a-zA-Z0-9_-]/g, ''); // Sanitize username
      const hashedPassword = await bcrypt.hash(adminCredentials.password, 10);
      
      envVars = {
        ...envVars,
        ADMIN_USERNAME: sanitizedUsername,
        ADMIN_PASSWORD: hashedPassword,
        DB_PATH: './database.db',
        FRONTEND_URL_1: 'http://localhost:3000',
        BACKEND_URL: 'http://localhost:3001',
        LOCKED_OUT_USERS_REFRESH_INTERVAL: '2M',
        SERVER_STATUS_REFRESH_INTERVAL: '10M',
        LOGFILE: systemSettings.logPath || './logs/'
      };
      
      logger.info(`Setting up local mode for system user: ${sanitizedUsername}`);
    } else {
      // Remote mode setup
      envVars = {
        ...envVars,
        REMOTE_SERVER_URL: remoteConnection.serverUrl,
        API_KEY: remoteConnection.apiKey,
        FRONTEND_URL_1: 'http://localhost:3000',
        BACKEND_URL: 'http://localhost:3001'
      };
    }
    
    // Write .env file
    const envData = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    fs.writeFileSync(envFilePath, envData);
    
    // Update setupConfig.js if needed
    if (mode === 'local') {
      const setupConfigTemplate = `module.exports = {
  server: {
    port: 3001,
    backendUrl: 'http://localhost:3001',
    frontendUrl: 'http://localhost:3000'
  },
  database: {
    type: 'local',
    path: './Backend/db/database.db'
  },
  activeDirectory: {
    domain: '${systemSettings.adDomain}',
    groups: ['${systemSettings.adGroups}'],
    domainControllers: []
  },
  security: {
    jwtExpiration: '5D',
    tempPassword: '${systemSettings.tempPassword}'
  },
  monitoring: {
    lockedOutUsersRefreshInterval: '2M',
    serverStatusRefreshInterval: '10M',
    logfilePath: '${systemSettings.logPath || './logs/'}'
  }
};`;
      
      fs.writeFileSync(setupConfigPath, setupConfigTemplate);
    }
    
    res.json({ message: 'Setup completed successfully', mode });
  } catch (error) {
    logger.error('Error during wizard setup:', error);
    res.status(500).json({ error: 'Setup failed. Please try again.' });
  }
});

// Original setup endpoint (kept for backward compatibility)
router.post('/', async (req, res) => {
  const envFilePath = process.pkg 
    ? path.join(process.cwd(), '.env')
    : path.join(__dirname, '../.env');
  const { SUPER_ADMIN_ID, SUPER_ADMIN_PASSWORD, ...envVars } = req.body;

  const envData = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  try {
    // Write environment variables to .env file
    fs.writeFileSync(envFilePath, envData);

    // Hash the super admin password
    const hashedPassword = await hashPassword(SUPER_ADMIN_PASSWORD);

    // Create the super admin user
    await insertOrUpdateAdminUser({
      AdminID: SUPER_ADMIN_ID,
      password: hashedPassword,
      temppassword: SUPER_ADMIN_PASSWORD
    });

    res.json({ message: 'Environment variables and super admin created successfully' });
  } catch (err) {
    console.error('Error setting up environment and super admin:', err);
    res.status(500).json({ error: 'Failed to set up environment and super admin' });
  }
});

// Utility function to generate a cryptographically random secret string.
// Uses crypto.randomBytes (not Math.random) so per-deployment secrets are not
// predictable — important because these become the JWT/session secrets.
function generateRandomString(length) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

module.exports = router;