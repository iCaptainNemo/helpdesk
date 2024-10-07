const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { fetchAdminUser, insertOrUpdateAdminUser } = require('../db/queries');

const dbPath = path.resolve(__dirname, '../db/your-database-file.db'); // Adjust the path to your SQLite database file
const db = new sqlite3.Database(dbPath);

router.post('/admin/login', async (req, res) => {
  const { username, computerName } = req.body;
  try {
    let user = await fetchAdminUser(username);
    if (!user) {
      await insertOrUpdateAdminUser({ userID: username, temppassword: null, logfile: null, computername: computerName });
      user = await fetchAdminUser(username);
      res.json({ newUser: true, username });
    } else {
      // Update the computer name for existing users
      await insertOrUpdateAdminUser({ userID: username, computername: computerName });
      res.json({ newUser: false, username: user.userID });
    }
  } catch (error) {
    console.error('Admin login failed:', error);
    res.status(500).json({ error: 'Admin login failed' });
  }
});

router.post('/admin/updateUser', async (req, res) => {
  const { username, tempPassword, logFile } = req.body;
  try {
    await insertOrUpdateAdminUser({ userID: username, temppassword: tempPassword, logfile: logFile });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin update user failed:', error);
    res.status(500).json({ error: 'Admin update user failed' });
  }
});

module.exports = router;