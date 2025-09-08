const express = require('express');
const router = express.Router();
const { fetchAdminUser, insertOrUpdateAdminUser, fetchRolesForUser, fetchPermissionsForRoles } = require('../db/queries');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger'); // Import the logger
const sessionStore = require('../utils/sessionStore'); // Import sessionStore
const { hashPassword, verifyPassword } = require('../utils/hashUtils'); // Import password hashing and verification functions
require('dotenv').config(); // Load environment variables from .env file
const SECRET_KEY = process.env.JWT_SECRET || '-secret-key';
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
  logger.info('Received login request for AdminID:', AdminID);

  try {
    const deploymentMode = process.env.DEPLOYMENT_MODE;
    
    if (deploymentMode === 'local') {
      // Local mode: Use .env authentication
      const envUsername = process.env.ADMIN_USERNAME;
      const envPasswordHash = process.env.ADMIN_PASSWORD;
      
      if (!envUsername || !envPasswordHash) {
        logger.error('Local mode credentials not configured in .env');
        return res.status(500).json({ error: 'Authentication not configured' });
      }
      
      if (AdminID !== envUsername) {
        logger.warn(`Invalid username for local mode: ${AdminID}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const bcrypt = require('bcrypt');
      const isPasswordValid = await bcrypt.compare(password, envPasswordHash);
      logger.info(`Local auth password verification result for AdminID ${AdminID}: ${isPasswordValid}`);
      
      if (!isPasswordValid) {
        logger.warn('Invalid password for local mode:', AdminID);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Generate JWT token for local mode
      const token = jwt.sign({ AdminID, sessionID: req.sessionID }, SECRET_KEY, { expiresIn: JWT_EXPIRATION });
      logger.info(`JWT token generated for local mode AdminID: ${AdminID}, SessionID: ${req.sessionID}`);

      // Store session information for local mode
      req.session.AdminID = AdminID;
      req.session.adminComputer = process.env.COMPUTERNAME || 'localhost';
      logger.info(`Local mode session created for AdminID: ${AdminID}`);

      // Return response for local mode
      res.json({ 
        token, 
        AdminID, 
        adminComputer: process.env.COMPUTERNAME || 'localhost', 
        sessionID: req.sessionID,
        mode: 'local'
      });
    } else {
      // Database authentication for remote mode or legacy systems
      const adminUser = await fetchAdminUser(AdminID);
      logger.info(`Fetched admin user for AdminID ${AdminID}:`, adminUser);
      if (!adminUser) {
        logger.warn(`No account found for AdminID: ${AdminID}`);
        return res.status(404).json({ error: 'No account found' });
      }

      // Check if password is null and prompt for an update
      if (!adminUser.password) {
        logger.warn(`Password is null for AdminID: ${AdminID}`);
        return res.status(403).json({ error: 'Password needs to be updated' });
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, adminUser.password);
      logger.info(`Password verification result for AdminID ${AdminID}: ${isPasswordValid}`);

      if (!isPasswordValid) {
        logger.warn('Invalid password for AdminID:', AdminID);
        return res.status(401).json({ error: 'Invalid password' });
      }

      // Generate JWT token
      const token = jwt.sign({ AdminID, sessionID: req.sessionID }, SECRET_KEY, { expiresIn: JWT_EXPIRATION });
      logger.info(`JWT token generated for AdminID: ${AdminID}, SessionID: ${req.sessionID}`);

      // Store session information
      req.session.AdminID = AdminID;
      req.session.adminComputer = adminUser.AdminComputer;
      logger.info(`Session created for AdminID: ${AdminID}, AdminComputer: ${adminUser.AdminComputer}`);

      // Include session ID and adminComputer in the response
      res.json({ 
        token, 
        AdminID, 
        adminComputer: adminUser.AdminComputer, 
        sessionID: req.sessionID,
        mode: 'database'
      });
    }
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to update password
router.post('/update-password', sanitizeInput, async (req, res) => {
  const { AdminID, newPassword } = req.body;
  logger.info('Received password update request for AdminID:', AdminID);

  try {
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the password in the database
    await insertOrUpdateAdminUser({ AdminID, password: hashedPassword });
    logger.info(`Password updated for AdminID: ${AdminID}`);

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Password update failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to update temporary password
router.post('/update-temp-password', sanitizeInput, async (req, res) => {
  const { AdminID, tempPassword } = req.body;
  logger.info('Received temporary password update request for AdminID:', AdminID);

  try {
    // Update the temporary password in the database
    await insertOrUpdateAdminUser({ AdminID, temppassword: tempPassword });
    logger.info(`Temporary password updated for AdminID: ${AdminID}`);

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
      const localPermissions = ['read', 'write', 'execute', 'access_configure_page', 'execute_script', 'unlock_user', 'reset_password', 'manage_users', 'manage_tickets', 'view_reports', 'execute_command'];
      res.json({
        profile: {
          AdminID: adminID,
          AdminComputer: process.env.COMPUTERNAME || 'localhost',
          mode: 'local'
        },
        roles: [{ RoleID: 'local-admin', RoleName: 'Local Administrator' }],
        permissions: localPermissions
      });
    } else if (deploymentMode === 'remote') {
      // Remote mode: Return limited permissions (no configuration access)
      const remotePermissions = ['read', 'write', 'execute', 'execute_script', 'unlock_user', 'reset_password', 'manage_tickets', 'view_reports', 'execute_command'];
      res.json({
        profile: {
          AdminID: adminID,
          AdminComputer: process.env.COMPUTERNAME || 'localhost',
          mode: 'remote'
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