const path = require('path');

const forbiddenMiddleware = (req, res, next) => {
    if (!req.path.startsWith('/api')) {
        res.status(403).sendFile(path.join(__dirname, '../public', '403.html'));
    } else {
        next();
    }
};

module.exports = forbiddenMiddleware;