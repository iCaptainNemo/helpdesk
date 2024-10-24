const express = require('express');
const router = express.Router();
const { fetchAdminUser, insertOrUpdateAdminUser } = require('../db/queries');
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
    logger.info('Token verified, AdminID:', req.AdminID, 'AdminComputer:', req.adminComputer);
    next();
  });
}

// Login route using database authentication
router.post('/login', sanitizeInput, async (req, res) => {
  const { AdminID, password } = req.body;
  logger.info('Received login request for AdminID:', AdminID);

  try {
    // Check if user exists in the database
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

    // Check if adminComputer is present in the adminUser object
    if (!adminUser.AdminComputer) {
      logger.warn(`AdminComputer not found for AdminID: ${AdminID}`);
      return res.status(404).json({ error: 'AdminComputer not found' });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, adminUser.password);
    logger.info(`Password verification result for AdminID ${AdminID}: ${isPasswordValid}`); // Add logging

    if (!isPasswordValid) {
      logger.warn('Invalid password for AdminID:', AdminID);
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate JWT token with adminComputer
    const token = jwt.sign({ AdminID, adminComputer: adminUser.AdminComputer }, SECRET_KEY, { expiresIn: JWT_EXPIRATION });
    logger.info(`JWT token generated for AdminID: ${AdminID}, AdminComputer: ${adminUser.AdminComputer}`);

    // Store session information
    req.session.AdminID = AdminID; // Store AdminID in the session
    req.session.adminComputer = adminUser.AdminComputer; // Store adminComputer in the session
    logger.info(`Session created for AdminID: ${AdminID}, AdminComputer: ${adminUser.AdminComputer}`);

    // Include session ID and adminComputer in the response
    res.json({ token, AdminID, adminComputer: adminUser.AdminComputer, sessionID: req.sessionID });
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to update password
router.post('/update-password', sanitizeInput, async (req, res) => {
  const { AdminID, password } = req.body;
  logger.info('Received password update request for AdminID:', AdminID);

  try {
    // Hash the new password
    const hashedPassword = await hashPassword(password);

    // Update the password in the database
    await insertOrUpdateAdminUser({ AdminID, password: hashedPassword });
    logger.info(`Password updated for AdminID: ${AdminID}`);

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Password update failed:', error);
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