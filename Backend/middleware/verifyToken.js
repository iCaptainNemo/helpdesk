const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    logger.error('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token.split(' ')[1], process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
    if (err) {
      logger.error('Failed to authenticate token:', err);
      return res.status(401).json({ message: 'Failed to authenticate token' });
    }
    req.AdminID = decoded.AdminID;
    logger.info('Token verified, AdminID:', req.AdminID);
    next();
  });
};

module.exports = verifyToken;