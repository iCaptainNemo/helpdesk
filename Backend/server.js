const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const session = require('express-session'); // Import express-session
require('dotenv').config();

const db = require('./db/init');
const verifyToken = require('./middleware/verifyToken'); // Ensure JWT middleware is used
const verifyPermissions = require('./middleware/verifyPermissions'); // Import the permissions middleware
const { updateLockedOutUsers } = require('./utils/lockedOutUsersUtils'); // Import the module
const { getServerStatuses } = require('./utils/ServerManageUtil'); // Import the module
const logger = require('./utils/logger'); // Import the logger
const sessionStore = require('./utils/sessionStore'); // Import your session store

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

// Session management middleware
app.use(session({
    store: sessionStore, // Use your session store here
    secret: process.env.SESSION_SECRET || 'your-session-secret', // Secret for signing the session ID cookie
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Import routes
const fetchADObjectRoute = require('./routes/fetchADObject'); // Import the fetchADObject route
const fetchUserRoute = require('./routes/fetchUser'); // Import the fetchUser route
const helloWorldRoute = require('./routes/hello-world'); // Import the helloWorld route
const helloWorldMiddleware = require('./middleware/helloWorldMiddleware'); // Import the helloWorld middleware
const forbidden = require('./middleware/forbidden'); // Import the forbidden middleware
const notFound = require('./middleware/notfound'); // Import the notFound middleware
const authRoutes = require('./routes/auth'); // Authentication routes
const getLockedOutUsersRoute = require('./routes/getLockedOutUsers'); // Route for fetching locked out users
const executeScriptRoute = require('./routes/executeScript'); // Route for executing PowerShell scripts
const updateLockedOutUsersRoute = require('./routes/updateLockedOutUsers'); // Route for updating locked out users
const logoutRoute = require('./routes/logout'); // Route for logout
const checkSessionRoute = require('./routes/checkSession'); // Route for checking powershell sessions
const getLogsRoute = require('./routes/getLogs'); // Route for fetching logs
const rolesRoute = require('./routes/roles'); // Route for managing roles
const permissionsRoute = require('./routes/permissions'); // Route for managing permissions
const configureRoute = require('./routes/configure'); // Route for the configure page
const serverStatusRoute = require('./routes/serverStatus'); // Route for server statuses
const executeCommandRoute = require('./routes/executeCommand'); // Route for executing commands
const loggingSettingsRoute = require('./routes/loggingSettings'); // Import the loggingSettings route

// Use routes and pass db to them
app.use('/api/fetch-adobject', fetchADObjectRoute); 
app.use('/api/fetch-user', fetchUserRoute); 
app.use('/api/hello-world', helloWorldRoute);
app.use('/api', helloWorldMiddleware);
app.use('/api/auth', authRoutes); // Authentication routes
app.use('/api/get-locked-out-users', getLockedOutUsersRoute); // Route to fetch locked out users
app.use('/api/execute-script', verifyToken, verifyPermissions('execute_script'), executeScriptRoute); // Route to execute PowerShell scripts with permissions
app.use('/api/update-locked-out-users', updateLockedOutUsersRoute); // Route to update locked out users
app.use('/api/logout', logoutRoute); // Register the logout route
app.use('/api/check-session', checkSessionRoute); // Check powershell sessions on backend
app.use('/api/get-logs', getLogsRoute); // Route to fetch logs
app.use('/api/roles', rolesRoute); // Route to manage roles
app.use('/api/permissions', permissionsRoute); // Route to manage permissions
app.use('/api/configure', verifyToken, verifyPermissions('access_configure_page'), configureRoute); // Route to access the configure page
app.use('/api/servers', serverStatusRoute); // Use the serverStatus route
// app.use('/api/execute-command', verifyToken, verifyPermissions('execute_command'), executeCommandRoute); // Use the executeCommand route
app.use('/api/execute-command', executeCommandRoute); // Use the executeCommand route
app.use('/api/logging-settings', loggingSettingsRoute); // Use the loggingSettings route

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
    getServerStatuses(); // Initial call to populate the server statuses

    // Function to parse interval string and convert to milliseconds
    const parseInterval = (interval) => {
        if (!interval) return 600000; // Default to 10 minutes

        const unit = interval.slice(-1);
        const value = parseInt(interval.slice(0, -1), 10);

        if (isNaN(value)) {
            logger.warn(`Invalid interval format: ${interval}`);
            return 600000; // Default to 10 minutes
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
    const lockedOutUsersRefreshInterval = parseInterval(process.env.LOCKED_OUT_USERS_REFRESH_INTERVAL);
    setInterval(updateLockedOutUsers, lockedOutUsersRefreshInterval);

    // Set up the refresh interval for server statuses
    const serverStatusRefreshInterval = parseInterval(process.env.SERVER_STATUS_REFRESH_INTERVAL);
    setInterval(getServerStatuses, serverStatusRefreshInterval);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    server.close(() => {
        logger.info('Process terminated, server closed');
    });
});