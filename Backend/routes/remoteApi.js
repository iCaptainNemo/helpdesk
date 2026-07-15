const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET; // Guaranteed set by the secrets bootstrap in server.js
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1d';

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
    
    // Generate JWT token for the remote client
    const token = jwt.sign(
      { 
        clientId: clientIdentifier,
        type: 'remote',
        authenticated: true
      },
      SECRET_KEY,
      { expiresIn: JWT_EXPIRATION }
    );
    
    logger.info(`Remote client authenticated: ${clientIdentifier}`);
    
    res.json({
      success: true,
      token,
      clientId: clientIdentifier,
      expiresIn: JWT_EXPIRATION,
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
    const { serverPowerShellScript } = require('../powershell');
    const path = require('path');
    
    // Get server list from query parameters or use default
    const serverNames = req.query.servers ? req.query.servers.split(',') : [];
    
    if (serverNames.length === 0) {
      return res.status(400).json({ error: 'Server names required' });
    }
    
    const scriptPath = process.pkg 
        ? path.join(process.cwd(), 'functions', 'Get-ServerStatus.ps1')
        : path.join(__dirname, '../functions/Get-ServerStatus.ps1');
    const result = await serverPowerShellScript(scriptPath, serverNames);
    
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