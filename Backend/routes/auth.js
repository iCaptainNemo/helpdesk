const express = require('express');
const router = express.Router();
const { fetchAdminUser } = require('../db/queries');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../utils/ldapUtils'); // LDAP authentication function
require('dotenv').config(); // Load environment variables from .env file

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to sanitize inputs
const sanitizeInput = [
  body('AdminID').trim().escape(),
  body('password').trim().escape(),
  body('computerName').trim().escape(),
  body('tempPassword').optional().trim().escape(),
  body('logFile').optional().trim().escape(),
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
    console.error('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.error('Malformed token');
    return res.status(401).json({ message: 'Malformed token' });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      console.error('Failed to authenticate token:', err);
      return res.status(401).json({ message: 'Failed to authenticate token' });
    }
    req.AdminID = decoded.AdminID;
    console.log('Token verified, AdminID:', req.AdminID); // Debug log
    next();
  });
}

// Windows NTLM login route
router.get('/windows-login', (req, res) => {
  console.log('Received request for /windows-login');
  
  if (req.ntlm) {
    const AdminID = req.ntlm.UserName; // Extract the NTLM user
    console.log('NTLM User:', AdminID); // Log the extracted AdminID

    // Check if user exists in the database
    fetchAdminUser(AdminID)
      .then((adminUser) => {
        if (!adminUser) {
          console.log(`No account found for AdminID: ${AdminID}`);
          return res.status(404).json({ error: 'No account found' });
        }

        // Generate JWT token
        const token = jwt.sign({ AdminID }, SECRET_KEY, { expiresIn: '1h' });
        console.log(`JWT token generated for AdminID: ${AdminID}`);
        return res.json({ token, AdminID });
      })
      .catch((error) => {
        console.error('Error fetching admin user:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
      });
  } else {
    console.error('NTLM authentication failed:', req.ntlm);
    res.status(401).json({ error: 'NTLM authentication failed' });
  }
});

// Login route using LDAP
router.post('/login', sanitizeInput, async (req, res) => {
  const { AdminID, password } = req.body;
  console.log('Received login request for AdminID:', AdminID); // Log the login request

  try {
    // Verify user via LDAP only
    const isAuthenticated = await authenticateUser(AdminID, password);
    if (!isAuthenticated) {
      console.log('Invalid ID or password for AdminID:', AdminID); // Log invalid credentials
      return res.status(401).json({ error: 'Invalid ID or password' });
    }

    // Check if user exists in the database
    const adminUser = await fetchAdminUser(AdminID);
    if (!adminUser) {
      console.log(`No account found for AdminID: ${AdminID}`);
      return res.status(404).json({ error: 'No account found' });
    }

    // Generate JWT token
    const token = jwt.sign({ AdminID }, SECRET_KEY, { expiresIn: '1h' });
    console.log(`JWT token generated for AdminID: ${AdminID}`);

    res.json({ token, AdminID });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Token verification route
router.post('/verify-token', verifyToken, (req, res) => {
  res.json({ AdminID: req.AdminID });
});

module.exports = router;
