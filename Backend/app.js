const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const db = require('./db/init');
const attachUserInfo = require('./middleware/attachUserInfo');
const verifyToken = require('./middleware/verifyToken'); // Ensure JWT middleware is used
const { updateLockedOutUsers } = require('./utils/lockedOutUsersUtils'); // Import the module
const logger = require('./utils/logger'); // Import the logger

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: [
            process.env.FRONTEND_URL_1, 
            process.env.FRONTEND_URL_2
        ], // Allow both frontend addresses
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Define allowed origins once to avoid repetition
const allowedOrigins = [
    process.env.FRONTEND_URL_1, 
    process.env.FRONTEND_URL_2, 
    process.env.BACKEND_URL // Add backend address
];

// Function to check if the origin is allowed
const isOriginAllowed = (origin) => {
    if (!origin) return true; // Allow requests without origin (e.g., Postman)
    const subnetPattern = new RegExp(process.env.SUBNET_PATTERN);
    return allowedOrigins.includes(origin) || subnetPattern.test(origin);
};

// CORS middleware with better error handling
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || isOriginAllowed(origin)) {
            callback(null, true);
        } else {
            logger.error(`Not allowed by CORS: ${origin}`); // Use logger
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Middleware to parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to attach the database to requests
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Attach user information middleware
app.use(attachUserInfo);

// Import routes
const fetchADObjectRoute = require('./routes/fetchADObject');
const fetchUserRoute = require('./routes/fetchUser');
const helloWorldRoute = require('./routes/hello-world');
const helloWorldMiddleware = require('./middleware/helloWorldMiddleware');
const forbidden = require('./middleware/forbidden');
const notFound = require('./middleware/notfound');
const authRoutes = require('./routes/auth');
const getLockedOutUsersRoute = require('./routes/getLockedOutUsers'); // New route for fetching locked out users

// Use routes and pass db to them
app.use('/api/fetch-adobject', verifyToken, fetchADObjectRoute); 
app.use('/api/fetch-user', verifyToken, fetchUserRoute); 
app.use('/api/hello-world', helloWorldRoute);
app.use('/api', helloWorldMiddleware);

// Authentication routes (no token required for login)
app.use('/api/auth', authRoutes); // Includes /windows-login

// Route to fetch locked out users
app.use('/api/get-locked-out-users', getLockedOutUsersRoute); // New route

// Middleware to handle 403 Forbidden errors
app.use(forbidden);

// Middleware to handle 404 Not Found errors
app.use(notFound);

// Error handling middleware (improved)
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);

    const errorResponse = {
        error: 'Internal Server Error'
    };

    if (process.env.NODE_ENV !== 'production') {
        errorResponse.details = err.message;
        errorResponse.stack = err.stack;
    }

    res.status(500).json(errorResponse);
});

// Function to handle Socket.IO connection and disconnection events
const handleSocketConnection = (socket) => {
    logger.info('New client connected');
    socket.on('disconnect', () => {
        logger.info('Client disconnected');
    });
};

// Socket.IO setup
io.on('connection', handleSocketConnection);

// Start the server
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Listen on all network interfaces

server.listen(PORT, HOST, () => {
    logger.info(`Server is running on http://${HOST}:${PORT}`);
    updateLockedOutUsers(); // Initial call to populate the table

    // Function to parse interval string and convert to milliseconds
    const parseInterval = (interval) => {
        if (!interval) return 120000; // Default to 120 seconds

        const unit = interval.slice(-1);
        const value = parseInt(interval.slice(0, -1), 10);

        if (isNaN(value)) {
            logger.warn(`Invalid interval format: ${interval}`);
            return 120000; // Default to 120 seconds
        }

        switch (unit) {
            case 'M':
                return value * 60 * 1000; // Minutes to milliseconds
            case 'H':
                return value * 60 * 60 * 1000; // Hours to milliseconds
            case 'D':
                return value * 24 * 60 * 60 * 1000; // Days to milliseconds
            default:
                return value; // Default to milliseconds if no unit
        }
    };

    // Set up the refresh interval for locked out users
    const refreshInterval = parseInterval(process.env.LOCKED_OUT_USERS_REFRESH_INTERVAL);
    setInterval(updateLockedOutUsers, refreshInterval);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    server.close(() => {
        logger.info('Process terminated, server closed');
    });
});