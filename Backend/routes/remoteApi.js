const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { verifyAdminCredentials } = require('../db/queries');
const { isLocked, getLockRemainingMs, recordFailure, recordSuccess } = require('../utils/loginAttempts');
require('dotenv').config();

// Read fresh (process.env.X) at each use site below, not cached at module load -
// see the matching note in routes/auth.js for why a frozen const here goes stale
// after the setup wizard writes a new JWT_SECRET post-boot.

// Middleware to verify API key for remote connections
function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    logger.error('No API key provided for remote connection');
    return res.status(401).json({ message: 'API key required' });
  }
  
  // In a production environment, API keys would be stored securely in the database
  // For now, we'll check against environment variables or a hardcoded list
  const validApiKeys = [
    process.env.API_KEY,
    process.env.MASTER_API_KEY
  ].filter(Boolean); // Remove any undefined values
  
  if (!validApiKeys.includes(apiKey)) {
    logger.error('Invalid API key provided:', apiKey.substring(0, 8) + '...');
    return res.status(401).json({ message: 'Invalid API key' });
  }
  
  logger.info('Valid API key authenticated');
  next();
}

// Remote authentication endpoint
router.post('/authenticate', verifyApiKey, (req, res) => {
  try {
    const { clientId } = req.body;
    const clientIdentifier = clientId || 'remote-client';
    const jwtExpiration = process.env.JWT_EXPIRATION || '1d';

    // Generate JWT token for the remote client
    const token = jwt.sign(
      {
        clientId: clientIdentifier,
        type: 'remote',
        authenticated: true
      },
      process.env.JWT_SECRET,
      { expiresIn: jwtExpiration }
    );

    logger.info(`Remote client authenticated: ${clientIdentifier}`);

    res.json({
      success: true,
      token,
      clientId: clientIdentifier,
      expiresIn: jwtExpiration,
      serverCapabilities: {
        lockoutUsers: true,
        serverStatus: true,
        domainControllers: true,
        logs: true
      }
    });
  } catch (error) {
    logger.error('Remote authentication failed:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Verify hub-local admin credentials on behalf of a remote instance's login
// screen. Returns a plain valid/invalid result rather than a token - each
// instance mints and verifies its own JWT locally (JWT_SECRET is per-instance,
// so a token issued here wouldn't validate on the remote side anyway).
router.post('/verify-credentials', verifyApiKey, async (req, res) => {
  const { AdminID, password } = req.body;
  if (!AdminID || !password) {
    return res.status(400).json({ valid: false, message: 'AdminID and password required' });
  }

  // Shares the same lockout tracker as auth.js's local /login - both ultimately
  // check the same AdminUsers table, so a failed attempt through either path
  // should count toward the same limit.
  const normalizedAdminID = AdminID.toLowerCase();
  if (isLocked(normalizedAdminID)) {
    const remainingMinutes = Math.ceil(getLockRemainingMs(normalizedAdminID) / 60000);
    return res.status(429).json({ valid: false, message: `Too many failed attempts. Try again in ${remainingMinutes} minute(s).` });
  }

  try {
    const user = await verifyAdminCredentials(AdminID, password);
    if (!user) {
      recordFailure(normalizedAdminID);
      return res.status(401).json({ valid: false });
    }
    recordSuccess(normalizedAdminID);
    res.json({ valid: true, AdminID: user.AdminID, displayName: user.DisplayName || user.AdminID });
  } catch (error) {
    logger.error('Remote API: verify-credentials failed:', error);
    res.status(500).json({ valid: false, message: 'Internal error' });
  }
});

// Remote data endpoints

// Get locked out users
router.get('/locked-users', verifyApiKey, async (req, res) => {
  try {
    // Import required modules for data fetching
    const { executePowerShellScript } = require('../powershell');
    const path = require('path');
    
    const scriptPath = process.pkg 
        ? path.join(process.cwd(), 'functions', 'LockedOutList.ps1')
        : path.join(__dirname, '../functions/LockedOutList.ps1');
    const result = await executePowerShellScript(scriptPath);
    
    logger.info('Remote API: Fetched locked out users');
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Remote API: Failed to fetch locked users:', error);
    res.status(500).json({ error: 'Failed to fetch locked users' });
  }
});

// Get server status
router.get('/server-status', verifyApiKey, async (req, res) => {
  try {
    const { serverPowerShellScript, MONITORING_SCRIPT_TIMEOUT_MS } = require('../powershell');
    const path = require('path');

    // Get server list from query parameters or use default
    const serverNames = req.query.servers ? req.query.servers.split(',') : [];

    if (serverNames.length === 0) {
      return res.status(400).json({ error: 'Server names required' });
    }

    const scriptPath = process.pkg
        ? path.join(process.cwd(), 'functions', 'Get-ServerStatus.ps1')
        : path.join(__dirname, '../functions/Get-ServerStatus.ps1');
    const result = await serverPowerShellScript(scriptPath, serverNames, MONITORING_SCRIPT_TIMEOUT_MS);
    
    logger.info('Remote API: Fetched server status');
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Remote API: Failed to fetch server status:', error);
    res.status(500).json({ error: 'Failed to fetch server status' });
  }
});

// Get domain controllers
router.get('/domain-controllers', verifyApiKey, async (req, res) => {
  try {
    const { executePowerShellScript } = require('../powershell');
    const path = require('path');
    
    const scriptPath = process.pkg 
        ? path.join(process.cwd(), 'functions', 'getDomainInfo.ps1')
        : path.join(__dirname, '../functions/getDomainInfo.ps1');
    const result = await executePowerShellScript(scriptPath);
    
    logger.info('Remote API: Fetched domain controllers');
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Remote API: Failed to fetch domain controllers:', error);
    res.status(500).json({ error: 'Failed to fetch domain controllers' });
  }
});

// Get logs
router.get('/logs', verifyApiKey, async (req, res) => {
  try {
    const { executePowerShellScript } = require('../powershell');
    const path = require('path');
    
    const scriptPath = process.pkg 
        ? path.join(process.cwd(), 'functions', 'Get-Logs.ps1')
        : path.join(__dirname, '../functions/Get-Logs.ps1');
    const result = await executePowerShellScript(scriptPath);
    
    logger.info('Remote API: Fetched logs');
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Remote API: Failed to fetch logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

module.exports = router;