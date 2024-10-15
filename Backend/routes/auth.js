const express = require('express');
const router = express.Router();
const { fetchAdminUser } = require('../db/queries');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../utils/ldapUtils'); // LDAP authentication function
const logger = require('../utils/logger'); // Import the logger
require('dotenv').config(); // Load environment variables from .env file

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1d'; // Default to 1 day if not set

// Middleware to sanitize inputs
const sanitizeInput = [
  body('AdminID').trim().escape(),
  body('password').trim().escape(),
  body('computerName').trim().escape(),
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
    logger.info('Token verified, AdminID:', req.AdminID);
    next();
  });
}

// Windows NTLM login route
router.get('/windows-login', (req, res) => {
  logger.log('Received request for /windows-login');
  
  if (req.ntlm) {
    const AdminID = req.ntlm.UserName; // Extract the NTLM user
    logger.log('NTLM User:', AdminID); // Log the extracted AdminID

    // Check if user exists in the database
    fetchAdminUser(AdminID)
      .then((adminUser) => {
        if (!adminUser) {
          logger.log(`No account found for AdminID: ${AdminID}`);
          return res.status(404).json({ error: 'No account found' });
        }

        // Generate JWT token
        const token = jwt.sign({ AdminID }, SECRET_KEY, { expiresIn: JWT_EXPIRATION });
        logger.log(`JWT token generated for AdminID: ${AdminID}`);
        return res.json({ token, AdminID });
      })
      .catch((error) => {
        logger.error('Error fetching admin user:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
      });
  } else {
    logger.error('NTLM authentication failed:', req.ntlm);
    res.status(401).json({ error: 'NTLM authentication failed' });
  }
});

// Login route using LDAP
router.post('/login', sanitizeInput, async (req, res) => {
  const { AdminID, password } = req.body;
  logger.info('Received login request for AdminID:', AdminID);

  try {
    // Verify user via LDAP only
    const isAuthenticated = await authenticateUser(AdminID, password);
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

    // Generate JWT token
    const token = jwt.sign({ AdminID }, SECRET_KEY, { expiresIn: JWT_EXPIRATION });
    logger.info(`JWT token generated for AdminID: ${AdminID}`);

    res.json({ token, AdminID });
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Token verification route
router.post('/verify-token', verifyToken, (req, res) => {
  res.json({ AdminID: req.AdminID });
});

module.exports = router;