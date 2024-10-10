const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        console.error('No token provided');
        return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token.split(' ')[1], process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
        if (err) {
            console.error('Failed to authenticate token:', err);
            return res.status(401).json({ message: 'Failed to authenticate token' });
        }
        req.AdminID = decoded.AdminID;
        console.log('Token verified, AdminID:', req.AdminID); // Debug log
        next();
    });
};

module.exports = verifyToken;