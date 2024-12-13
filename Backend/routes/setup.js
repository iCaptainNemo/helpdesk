const express = require('express');
const fs = require('fs');
const path = require('path');
const { insertOrUpdateAdminUser } = require('../db/queries'); // Import the function
const { hashPassword } = require('../utils/hashUtils'); // Import the hashPassword function
const router = express.Router();

router.post('/', async (req, res) => {
  const envFilePath = path.join(__dirname, '../.env');
  const { SUPER_ADMIN_ID, SUPER_ADMIN_PASSWORD, ...envVars } = req.body;

  const envData = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  try {
    // Write environment variables to .env file
    fs.writeFileSync(envFilePath, envData);

    // Hash the super admin password
    const hashedPassword = await hashPassword(SUPER_ADMIN_PASSWORD);

    // Create the super admin user
    await insertOrUpdateAdminUser({
      AdminID: SUPER_ADMIN_ID,
      password: hashedPassword,
      temppassword: SUPER_ADMIN_PASSWORD
    });

    res.json({ message: 'Environment variables and super admin created successfully' });
  } catch (err) {
    console.error('Error setting up environment and super admin:', err);
    res.status(500).json({ error: 'Failed to set up environment and super admin' });
  }
});

module.exports = router;