const express = require('express');
const router = express.Router();
const { fetchAdminUser, insertOrUpdateAdminUser, fetchRolesForUser, fetchPermissionsForRoles } = require('../db/queries');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger'); // Import the logger
const sessionStore = require('../utils/sessionStore'); // Import sessionStore
const { hashPassword, verifyPassword } = require('../utils/hashUtils'); // Import password hashing and verification functions
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
    // Always use .env authentication since Admin table no longer exists
    const envUsername = process.env.ADMIN_USERNAME;
    const envPasswordHash = process.env.ADMIN_PASSWORD;
    
    if (!envUsername || !envPasswordHash) {
      logger.error('Admin credentials not configured in .env');
      return res.status(500).json({ error: 'Authentication not configured' });
    }
    
    if (normalizedAdminID !== envUsername.toLowerCase()) {
      logger.warn(`Invalid username: ${AdminID}, expected: ${envUsername}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, envPasswordHash);
    logger.info(`Password verification result for AdminID ${normalizedAdminID}: ${isPasswordValid}`);
    
    if (!isPasswordValid) {
      logger.warn('Invalid password for AdminID:', normalizedAdminID);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign({ AdminID: normalizedAdminID, sessionID: req.sessionID }, SECRET_KEY, { expiresIn: JWT_EXPIRATION });
    logger.info(`JWT token generated for AdminID: ${normalizedAdminID}, SessionID: ${req.sessionID}`);

    // Store session information
    req.session.AdminID = normalizedAdminID;
    req.session.adminComputer = process.env.COMPUTERNAME || 'localhost';
    logger.info(`Session created for AdminID: ${normalizedAdminID}`);

    // Return response
    res.json({ 
      token, 
      AdminID: normalizedAdminID, 
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
    const envUsername = process.env.ADMIN_USERNAME;
    
    if (normalizedAdminID !== envUsername.toLowerCase()) {
      logger.warn(`Unauthorized password update attempt for AdminID: ${normalizedAdminID}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Hash the new password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the .env file
    const fs = require('fs');
    const path = require('path');
    const envPath = process.pkg 
      ? path.join(process.cwd(), '.env')
      : path.join(__dirname, '..', '.env');
    
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${hashedPassword}`);
    fs.writeFileSync(envPath, envContent);
    
    // Update the environment variable in memory
    process.env.ADMIN_PASSWORD = hashedPassword;
    
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

    // Update the .env file
    const fs = require('fs');
    const path = require('path');
    const envPath = process.pkg 
      ? path.join(process.cwd(), '.env')
      : path.join(__dirname, '..', '.env');
    
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/^TEMP_PASSWORD=.*$/m, `TEMP_PASSWORD=${tempPassword}`);
    fs.writeFileSync(envPath, envContent);
    
    // Update the environment variable in memory
    process.env.TEMP_PASSWORD = tempPassword;
    
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
      const localPermissions = ['read', 'write', 'execute', 'access_configure_page', 'execute_script', 'unlock_user', 'reset_password', 'manage_users', 'manage_tickets', 'view_reports', 'execute_command'];
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
      const remotePermissions = ['read', 'write', 'execute', 'execute_script', 'unlock_user', 'reset_password', 'manage_tickets', 'view_reports', 'execute_command'];
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