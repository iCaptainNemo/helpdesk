const express = require('express');
const router = express.Router();
const { fetchAdminUser, insertOrUpdateAdminUser } = require('../db/queries');
const { body, validationResult } = require('express-validator');

require('dotenv').config(); // Load environment variables from .env file

const db = require('../db/init'); // Use the database initialization from init.js

// Middleware to sanitize inputs
const sanitizeInput = [
  body('username').trim().escape(),
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

router.post('/admin/login', sanitizeInput, async (req, res) => {
  const { username, computerName } = req.body;
  try {
    let user = await fetchAdminUser(username);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found in Admin table' });
    } else {
      // Update the computer name for existing users
      await insertOrUpdateAdminUser({ userID: username, temppassword: user.temppassword, logfile: user.logfile, computername: computerName });
      req.session.user = { username: user.userID }; // Store user info in session
      res.json({ newUser: false, username: user.userID });
    }
  } catch (error) {
    console.error('Admin login failed:', error);
    res.status(500).json({ error: 'Admin login failed' });
  }
});

router.post('/admin/updateUser', sanitizeInput, async (req, res) => {
  const { username, tempPassword, logFile } = req.body;
  try {
    await insertOrUpdateAdminUser({ userID: username, temppassword: tempPassword, logfile: logFile, computername: null });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin update user failed:', error);
    res.status(500).json({ error: 'Admin update user failed' });
  }
});

router.post('/verifySession', (req, res) => {
  if (req.session.user) {
    res.json({ username: req.session.user.username });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

module.exports = router;