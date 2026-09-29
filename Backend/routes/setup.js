const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { insertOrUpdateAdminUser } = require('../db/queries'); // Import the function
const { hashPassword } = require('../utils/hashUtils'); // Import the hashPassword function
const { readEnvFile, writeEnvVars } = require('../utils/envFile');
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

// Shared "is this instance already configured" check - used both by /status
// (informational) and as a guard on /wizard and the legacy / endpoint (below).
// Those write endpoints are intentionally unauthenticated (there's no admin
// account to authenticate with on a brand-new instance yet), but that also
// means without this guard, anyone reachable on the network (this server binds
// 0.0.0.0 for remote-mode agents) could re-run setup on an already-configured
// instance at any time and overwrite ADMIN_USERNAME/PASSWORD, JWT_SECRET, etc.
function getSetupStatus() {
  const envFilePath = process.pkg
    ? path.join(process.cwd(), '.env')
    : path.join(__dirname, '../.env');
  const setupConfigPath = process.pkg
    ? path.join(process.cwd(), 'setupConfig.js')
    : path.join(__dirname, '../../setupConfig.js');

  const envExists = fs.existsSync(envFilePath);
  const setupConfigExists = fs.existsSync(setupConfigPath);

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
    }
  }

  return { configured, configDetails };
}

// Check setup status
router.get('/status', (req, res) => {
  try {
    logger.info('Setup status check requested');
    const { configured, configDetails } = getSetupStatus();
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
  if (getSetupStatus().configured) {
    return res.status(403).json({ error: 'This instance is already configured. Use Configure > Application to change deployment settings instead of re-running setup.' });
  }

  try {
    const { mode, adminCredentials, remoteConnection, systemSettings } = req.body;

    const setupConfigPath = process.pkg
      ? path.join(process.cwd(), 'setupConfig.js')
      : path.join(__dirname, '../../setupConfig.js');

    // Prefer whatever's already active in this process - server.js's
    // ephemeral-secret bootstrap guarantees process.env.JWT_SECRET/SESSION_SECRET
    // are set before any route (including this one) can be reached. Persisting
    // that same value (rather than generating a fresh one here) keeps the on-disk
    // .env in sync with what's already signing things in memory for the rest of
    // this process's life. Generating a different secret here was the root cause
    // of a bug where login right after the wizard would sign a JWT with one
    // secret while every other route verified against a newly-generated one.
    const existingEnv = readEnvFile();
    const jwtSecret = process.env.JWT_SECRET || existingEnv.JWT_SECRET || generateRandomString(32);
    const sessionSecret = process.env.SESSION_SECRET || existingEnv.SESSION_SECRET || generateRandomString(16);

    // Prepare environment variables based on mode
    let envVars = {
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
      const hashedPassword = await hashPassword(adminCredentials.password);
      
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
      
      // Seed the AdminUsers table with the same credentials just written to
      // .env, so login (which now checks the DB, not .env) works immediately.
      await insertOrUpdateAdminUser({ AdminID: sanitizedUsername, password: adminCredentials.password });

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
    
    writeEnvVars(envVars);

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
  if (getSetupStatus().configured) {
    return res.status(403).json({ error: 'This instance is already configured.' });
  }

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

    // insertOrUpdateAdminUser hashes internally - passing an already-hashed
    // value here double-hashed it, so the stored hash never matched the real
    // password and this account could never actually log in.
    await insertOrUpdateAdminUser({
      AdminID: SUPER_ADMIN_ID,
      password: SUPER_ADMIN_PASSWORD
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