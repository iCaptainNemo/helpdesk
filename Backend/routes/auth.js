const express = require('express');
const router = express.Router();
const { fetchAdminUser } = require('../db/queries');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../utils/ldapUtils'); // LDAP authentication function
const logger = require('../utils/logger'); // Import the logger
const sessionStore = require('../utils/sessionStore'); // Import sessionStore
require('dotenv').config(); // Load environment variables from .env file

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1d'; // Default to 1 day if not set

// Middleware to sanitize inputs
const sanitizeInput = [
  body('AdminID').trim().escape(),
  body('password').trim().escape(),
  body('adminComputer').trim().escape(), // Changed to adminComputer
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
    logger.info('Token verified, AdminID:', req.AdminID, 'AdminComputer:', req.adminComputer);
    next();
  });
}

// Login route using LDAP
router.post('/login', sanitizeInput, async (req, res) => {
  const { AdminID, password, adminComputer } = req.body; // Changed to adminComputer
  logger.info('Received login request for AdminID:', AdminID);

  try {
    // Verify user via LDAP only
    const isAuthenticated = await authenticateUser(AdminID, password, req); // Pass req to authenticateUser
    if (!isAuthenticated) {
      logger.warn('Invalid ID or password for AdminID:', AdminID);
      return res.status(401).json({ error: 'Invalid ID or password' });
    }

    // Check if user exists in the database
    const adminUser = await fetchAdminUser(AdminID);
    if (!adminUser) {
      logger.warn(`No account found for AdminID: ${AdminID}`);
      return res.status(404).json({ error: 'No account found' });
    }

    // Generate JWT token with adminComputer
    const token = jwt.sign({ AdminID, adminComputer }, SECRET_KEY, { expiresIn: JWT_EXPIRATION });
    logger.info(`JWT token generated for AdminID: ${AdminID}, AdminComputer: ${adminComputer}`);

    // Store session information
    req.session.AdminID = AdminID; // Store AdminID in the session
    req.session.adminComputer = adminComputer; // Store adminComputer in the session
    logger.info(`Session created for AdminID: ${AdminID}, AdminComputer: ${adminComputer}`);

    // Include session ID and adminComputer in the response
    res.json({ token, AdminID, adminComputer, sessionID: req.sessionID });
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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