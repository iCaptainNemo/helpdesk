const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const verifyToken = (req, res, next) => {
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

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
    if (err) {
      logger.error('Failed to authenticate token:', err);
      return res.status(401).json({ message: 'Failed to authenticate token' });
    }
    req.AdminID = decoded.AdminID;
    req.adminComputer = decoded.adminComputer; // Extract adminComputer from the token
    logger.info('Token verified, AdminID:', req.AdminID, 'AdminComputer:', req.adminComputer);
    next();
  });
};

module.exports = verifyToken;