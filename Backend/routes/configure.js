const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const verifyPermissions = require('../middleware/verifyPermissions');

// Token verification middleware
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

    const SECRET_KEY = process.env.JWT_SECRET; // Guaranteed set by the secrets bootstrap in server.js
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            logger.error('Failed to authenticate token:', err);
            return res.status(401).json({ message: 'Failed to authenticate token' });
        }
        req.AdminID = decoded.AdminID;
        req.adminComputer = decoded.adminComputer;
        next();
    });
}

// Apply authentication and permission middleware
router.use(verifyToken);
router.use(verifyPermissions('access_configure_page'));

router.get('/', (req, res) => {
    const deploymentMode = process.env.DEPLOYMENT_MODE;
    const adminID = req.AdminID || 'local_admin';
    
    logger.info(`Admin ${adminID} accessed the configure page in ${deploymentMode} mode`);
    
    res.json({ 
        message: 'Welcome to the configure page!',
        mode: deploymentMode,
        adminID: adminID
    });
});

module.exports = router;