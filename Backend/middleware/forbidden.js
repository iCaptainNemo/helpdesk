const path = require('path');

const forbiddenMiddleware = (req, res, next) => {
    // Allow requests for static files from the public directory
    if (req.path.startsWith('/api') || req.path.startsWith('/css') || req.path.startsWith('/static')) {
        next();
    } else {
        res.status(403).sendFile(path.join(__dirname, '../public', '403.html'));
    }
};

module.exports = forbiddenMiddleware;