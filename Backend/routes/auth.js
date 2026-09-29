const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { fetchAdminUser, insertOrUpdateAdminUser, verifyAdminCredentials, fetchRolesForUser, fetchPermissionsForRoles } = require('../db/queries');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger'); // Import the logger
const sessionStore = require('../utils/sessionStore'); // Import sessionStore
const { hashPassword, verifyPassword } = require('../utils/hashUtils'); // Import password hashing and verification functions
const { writeEnvVars } = require('../utils/envFile');
require('dotenv').config(); // Load environment variables from .env file
const SECRET_KEY = process.env.JWT_SECRET; // Guaranteed set by the secrets bootstrap in server.js
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1d'; // Default to 1 day if not set

// Middleware to sanitize inputs
const sanitizeInput = [
  body('AdminID').trim().escape(),
  body('password').trim().escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Middleware to verify token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    logger.error('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    logger.error('Malformed token');
    return res.status(401).json({ message: 'Malformed token' });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      logger.error('Failed to authenticate token:', err);
      return res.status(401).json({ message: 'Failed to authenticate token' });
    }
    req.AdminID = decoded.AdminID;
    req.adminComputer = decoded.adminComputer; // Extract adminComputer from the token
    // logger.info('Token verified for AdminID:', req.AdminID);
    next();
  });
}

// Login route with support for both local .env and database authentication
router.post('/login', sanitizeInput, async (req, res) => {
  const { AdminID, password } = req.body;
  const normalizedAdminID = AdminID.toLowerCase();
  logger.info('Received login request for AdminID:', AdminID);

  try {
    const deploymentMode = process.env.DEPLOYMENT_MODE;
    let verifiedAdminID = null;

    if (deploymentMode === 'remote') {
      // Remote instances hold no local credentials - the hub is the source of
      // truth. Proxy the credential check over the existing API-key channel;
      // each instance still mints and verifies its own JWT locally (JWT_SECRET
      // is per-instance, so a hub-issued token wouldn't validate here anyway).
      const serverUrl = process.env.REMOTE_SERVER_URL;
      const apiKey = process.env.API_KEY;
      if (!serverUrl || !apiKey) {
        logger.error('Remote mode misconfigured: REMOTE_SERVER_URL/API_KEY missing');
        return res.status(500).json({ error: 'Remote server not configured' });
      }

      let hubRes;
      try {
        hubRes = await fetch(`${serverUrl.replace(/\/$/, '')}/api/remote/verify-credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
          body: JSON.stringify({ AdminID: normalizedAdminID, password })
        });
      } catch (networkErr) {
        logger.error('Failed to reach hub server for login:', networkErr.message);
        return res.status(502).json({ error: 'Unable to reach the hub server' });
      }

      if (hubRes.status === 401) {
        logger.warn(`Hub rejected credentials for AdminID: ${normalizedAdminID}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (!hubRes.ok) {
        logger.error(`Hub verify-credentials failed: ${hubRes.status} ${hubRes.statusText}`);
        return res.status(502).json({ error: 'Unable to reach the hub server' });
      }

      const hubData = await hubRes.json();
      if (!hubData.valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      verifiedAdminID = hubData.AdminID;
    } else {
      // local (hub) mode: check this instance's own AdminUsers table
      const user = await verifyAdminCredentials(normalizedAdminID, password);
      if (!user) {
        logger.warn('Invalid credentials for AdminID:', normalizedAdminID);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      verifiedAdminID = user.AdminID;
    }

    // Generate JWT token
    const token = jwt.sign({ AdminID: verifiedAdminID, sessionID: req.sessionID }, SECRET_KEY, { expiresIn: JWT_EXPIRATION });
    logger.info(`JWT token generated for AdminID: ${verifiedAdminID}, SessionID: ${req.sessionID}`);

    // Store session information
    req.session.AdminID = verifiedAdminID;
    req.session.adminComputer = process.env.COMPUTERNAME || 'localhost';
    logger.info(`Session created for AdminID: ${verifiedAdminID}`);

    // Return response
    res.json({
      token,
      AdminID: verifiedAdminID,
      adminComputer: process.env.COMPUTERNAME || 'localhost',
      sessionID: req.sessionID
    });
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to update password
router.post('/update-password', verifyToken, sanitizeInput, async (req, res) => {
  const { newPassword } = req.body;
  const normalizedAdminID = req.AdminID.toLowerCase(); // Get AdminID from JWT token
  logger.info('Received password update request for AdminID:', normalizedAdminID);

  try {
    if (process.env.DEPLOYMENT_MODE === 'remote') {
      logger.warn(`Password update rejected on remote instance for AdminID: ${normalizedAdminID}`);
      return res.status(403).json({ error: 'Password changes are managed by your administrator on the hub' });
    }

    // Self-service: update this token's own AdminUsers row
    await insertOrUpdateAdminUser({ AdminID: normalizedAdminID, password: newPassword });

    logger.info(`Password updated for AdminID: ${normalizedAdminID}`);
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Password update failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to update temporary password
router.post('/update-temp-password', verifyToken, sanitizeInput, async (req, res) => {
  const { tempPassword } = req.body;
  const normalizedAdminID = req.AdminID.toLowerCase(); // Get AdminID from JWT token
  logger.info('Received temporary password update request for AdminID:', normalizedAdminID);

  try {
    const envUsername = process.env.ADMIN_USERNAME;
    
    if (normalizedAdminID !== envUsername.toLowerCase()) {
      logger.warn(`Unauthorized temp password update attempt for AdminID: ${normalizedAdminID}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    writeEnvVars({ TEMP_PASSWORD: tempPassword });

    logger.info(`Temporary password updated for AdminID: ${normalizedAdminID}`);
    res.status(200).json({ message: 'Temporary password updated successfully' });
  } catch (error) {
    logger.error('Temporary password update failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Profile route
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const adminID = req.AdminID;
    const deploymentMode = process.env.DEPLOYMENT_MODE;
    
    if (deploymentMode === 'local') {
      // Local mode: Return basic profile information from .env with full permissions
      const localPermissions = ['read', 'write', 'execute', 'access_configure_page', 'manage_deployment', 'execute_script', 'unlock_user', 'reset_password', 'manage_users', 'manage_tickets', 'view_reports', 'execute_command'];
      res.json({
        profile: {
          AdminID: adminID,
          AdminComputer: process.env.COMPUTERNAME || 'localhost',
          mode: 'local',
          temppassword: process.env.TEMP_PASSWORD || ''
        },
        roles: [{ RoleID: 'local-admin', RoleName: 'Local Administrator' }],
        permissions: localPermissions
      });
    } else if (deploymentMode === 'remote') {
      // Remote mode: Return limited permissions (no configuration access)
      const remotePermissions = ['read', 'write', 'execute', 'manage_deployment', 'execute_script', 'unlock_user', 'reset_password', 'manage_tickets', 'view_reports', 'execute_command'];
      res.json({
        profile: {
          AdminID: adminID,
          AdminComputer: process.env.COMPUTERNAME || 'localhost',
          mode: 'remote',
          temppassword: process.env.TEMP_PASSWORD || ''
        },
        roles: [{ RoleID: 'remote-agent', RoleName: 'Remote Agent' }],
        permissions: remotePermissions
      });
    } else {
      // Database/legacy mode: Use existing database logic
      const adminUser = await fetchAdminUser(adminID);
      const roles = await fetchRolesForUser(adminID);
      const permissions = await fetchPermissionsForRoles(roles.map(role => role.RoleID));

      res.json({
        profile: adminUser,
        roles: roles,
        permissions: permissions
      });
    }
  } catch (error) {
    logger.error('Failed to fetch profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Token verification route
router.post('/verify-token', verifyToken, (req, res) => {
  res.json({ AdminID: req.AdminID, adminComputer: req.adminComputer });
});

// Endpoint to get the number of active sessions
router.get('/session-count', (req, res) => {
  sessionStore.count((err, count) => {
    if (err) {
      logger.error('Failed to get session count:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.json({ sessionCount: count });
  });
});

module.exports = router;