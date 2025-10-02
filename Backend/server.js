console.log('Starting Helpdesk Jarvis server...');
console.log('Node version:', process.version);
console.log('Is pkg executable:', !!process.pkg);
console.log('Current working directory:', process.cwd());

// Add global error handlers to catch any unhandled errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
    console.error('Stack trace:', error.stack);
    console.error('Exiting due to uncaught exception');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    console.error('Exiting due to unhandled rejection');
    process.exit(1);
});

const express = require('express');
console.log('Express loaded');
const bodyParser = require('body-parser');
console.log('Body parser loaded');
const path = require('path');
console.log('Path loaded');
const http = require('http');
console.log('HTTP loaded');
const socketIo = require('socket.io');
console.log('Socket.IO loaded');
const cors = require('cors');
console.log('CORS loaded');
const session = require('express-session'); // Import express-session
console.log('Express session loaded');
const { exec } = require('child_process'); // Import for browser auto-launch
console.log('Child process loaded');
const fs = require('fs');
console.log('FS loaded');

// Handle .env file loading for standalone executable
console.log('Loading environment variables...');
if (process.pkg) {
    // Load .env from current working directory for pkg
    const envPath = path.join(process.cwd(), '.env');
    console.log('Looking for .env at:', envPath);
    console.log('.env file exists:', fs.existsSync(envPath));
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}
console.log('Environment variables loaded');

console.log('Loading database module...');
const db = require('./db/init');
console.log('Database module loaded');

console.log('Loading migrations module...');
const { runMigrations } = require('./db/migrations');
console.log('Migrations module loaded');

console.log('Loading middleware modules...');
const verifyToken = require('./middleware/verifyToken');
const verifyPermissions = require('./middleware/verifyPermissions');
console.log('Middleware modules loaded');

console.log('Extracting PowerShell scripts for pkg compatibility...');
const { extractPowerShellScripts } = require('./utils/scriptExtractor');
extractPowerShellScripts();

console.log('Loading utility modules...');
const { updateLockedOutUsers } = require('./utils/lockedOutUsersUtils');
const { getServerStatuses, getFrequentServerHealth } = require('./utils/ServerManageUtil');
const { updateDomainControllers, DomainControllerStatus  } = require('./utils/domainManager');
const logger = require('./utils/logger');
const sessionStore = require('./utils/sessionStore');
const { getSystemInfo } = require('./config/modes');
const RegistrySetup = require('./utils/registrySetup');
const ToolsManager = require('./utils/toolsManager');
console.log('All utility modules loaded');

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
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Serve React build files  
const frontendBuildPath = path.join(__dirname, '../frontend/build');

// In pkg mode, manually serve critical static files since express.static may not work with bundled assets
if (process.pkg) {
    const fs = require('fs');
    let assetManifest = null;
    
    // Load asset manifest to get dynamic filenames
    try {
        const manifestPath = path.join(__dirname, '../frontend/build/asset-manifest.json');
        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
        assetManifest = JSON.parse(manifestContent);
        console.log('Asset manifest loaded successfully');
    } catch (err) {
        console.error('Failed to load asset manifest:', err.message);
    }
    
    // Dynamically serve JS and CSS files based on asset manifest
    if (assetManifest && assetManifest.files) {
        const mainJsFile = assetManifest.files['main.js'];
        const mainCssFile = assetManifest.files['main.css'];
        
        if (mainJsFile) {
            app.get(mainJsFile, (req, res) => {
                try {
                    const jsPath = path.join(__dirname, '../frontend/build', mainJsFile);
                    const content = fs.readFileSync(jsPath, 'utf8');
                    res.setHeader('Content-Type', 'application/javascript');
                    res.send(content);
                } catch (err) {
                    console.log(`[DEBUG] Failed to serve JS file: ${err.message}`);
                    res.status(404).send('JS file not found');
                }
            });
        }
        
        if (mainCssFile) {
            app.get(mainCssFile, (req, res) => {
                try {
                    const cssPath = path.join(__dirname, '../frontend/build', mainCssFile);
                    const content = fs.readFileSync(cssPath, 'utf8');
                    res.setHeader('Content-Type', 'text/css');
                    res.send(content);
                } catch (err) {
                    console.log(`[DEBUG] Failed to serve CSS file: ${err.message}`);
                    res.status(404).send('CSS file not found');
                }
            });
        }
        
        console.log(`[INFO] Dynamic routes created for: ${mainJsFile}, ${mainCssFile}`);
    } else {
        console.error('[ERROR] Asset manifest not available - static files may not load correctly');
    }
} else {
    // Development mode - use normal static middleware
    app.use(express.static(frontendBuildPath));
}

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
const updatesRoute = require('./routes/updates'); // Update checking route
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
const usersRoute = require('./routes/users'); // Import the new users route
const multiFetchRoute = require('./routes/multiFetch'); // Import the multiFetch route
const serverManagerRoute = require('./routes/serverManager'); // Import the serverManager route
const setupRoute = require('./routes/setup'); // Import the setup route
const domainControllersRouter = require('./routes/domainControllers'); // Import the domainControllers route
const remoteApiRoute = require('./routes/remoteApi'); // Import the remote API route
const testDataRoute = require('./routes/testData'); // Import test data routes
const ledgerRoute = require('./routes/ledger'); // Import ledger routes
const actionsRoute = require('./routes/actions'); // Import actions routes
const { startLedgerService } = require('./services/ledgerService'); // Import ledger service

// Use routes and pass db to them
app.use('/api/fetch-adobject', fetchADObjectRoute);
app.use('/api/fetch-user', fetchUserRoute); // Register the fetchUser route
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
app.use('/api/users', usersRoute); // Register the new users route
// app.use('/api/execute-command', verifyToken, verifyPermissions('execute_command'), executeCommandRoute); // Use the executeCommand route
app.use('/api/execute-command', executeCommandRoute); // Use the executeCommand route
app.use('/api/logging-settings', loggingSettingsRoute); // Use the loggingSettings route
app.use('/api/multi-fetch', multiFetchRoute);
app.use('/api/server-manager', serverManagerRoute);
app.use('/api/setup', setupRoute); // Register the setup route
app.use('/api/updates', updatesRoute); // Update checking routes
app.use('/api/domain-controllers', domainControllersRouter); // Use the domainControllers route
app.use('/api/remote', remoteApiRoute); // Register the remote API routes
app.use('/api/test-data', testDataRoute); // Register test data routes
app.use('/api/ledger', ledgerRoute); // Register ledger routes
app.use('/api/actions', actionsRoute); // Register actions routes
app.use('/api/cache', require('./routes/cacheInfo')); // Cache monitoring and management routes

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../frontend/build/index.html');
    res.sendFile(indexPath);
});

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
    
    // Handle terminal room joining
    socket.on('join-terminal', () => {
        socket.join('terminal');
        logger.info('Client joined terminal room');
        
        // Send welcome message to terminal
        socket.emit('system-event', {
            type: 'info',
            message: 'Terminal connection established'
        });
    });
    
    socket.on('disconnect', () => {
        logger.info('Client disconnected');
        socket.leave('terminal');
    });
};

// Socket.IO setup
io.on('connection', handleSocketConnection);

// Make io available globally for terminal broadcasting
global.terminalIO = io;

// Start the server
console.log('Preparing to start server...');
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Listen on all network interfaces
console.log(`Starting server on ${HOST}:${PORT}`);

server.listen(PORT, HOST, async () => {
    console.log('Server listen callback called');
    const url = `http://localhost:${PORT}`;
    logger.info(`Server is running on ${url}`);
    
    // Auto-open browser for standalone exe usage
    if (process.pkg) {
        exec(`start ${url}`, (err) => {
            if (err) logger.warn('Browser auto-open failed:', err);
            else logger.info('Browser opened automatically');
        });
    }
    
    // Run database migrations
    try {
        logger.info('Running database migrations...');
        await runMigrations();
        logger.info('Database migrations completed successfully');
        
        // Start ledger service after database is ready
        startLedgerService();
        logger.info('Ledger service started');
    } catch (error) {
        logger.error('Database migration failed:', error);
        // Continue startup even if migrations fail to maintain compatibility
    }
    
    // Setup deep linking for external tool integration
    try {
        logger.info('Setting up deep linking integration...');
        const registrySetup = new RegistrySetup();
        
        // Check if we have admin privileges for registry operations
        const hasAdminPrivs = await registrySetup.checkAdminPrivileges();
        if (!hasAdminPrivs) {
            registrySetup.displayAdminWarning();
        } else {
            await registrySetup.setupDeepLinking();
        }
    } catch (error) {
        logger.warn('Deep linking setup failed (non-critical):', error);
        logger.info('External tool integration may not work without manual setup');
    }
    
    // Setup Tools folder and download missing tools
    try {
        logger.info('Setting up Tools folder and utilities...');
        const toolsManager = new ToolsManager();
        
        const success = await toolsManager.setupTools();
        if (!success) {
            toolsManager.displayManualInstructions();
        }
    } catch (error) {
        logger.warn('Tools setup failed (non-critical):', error);
        logger.info('Some system monitoring features may not work without tools');
    }
    
    // Log system configuration information
    const systemInfo = getSystemInfo();
    logger.info(`Deployment Mode: ${systemInfo.mode}`);
    logger.info(`Mode Configuration:`, systemInfo.modeConfig);
    if (systemInfo.validationErrors.length > 0) {
        logger.warn(`Configuration validation errors:`, systemInfo.validationErrors);
    }
    logger.info(`System features:`, systemInfo.features);
    
    updateLockedOutUsers(); // Initial call to populate the table
    getServerStatuses(); // Initial call to populate the server statuses
    getFrequentServerHealth(); // Initial call to check servers with issues
    updateDomainControllers(); // Initial call to update domain controllers
    DomainControllerStatus(); // Initial call to update domain controller statuses

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

    // Set up the frequent health check interval for servers with issues (2 minutes)
    const frequentHealthCheckInterval = 2 * 60 * 1000; // 2 minutes in milliseconds
    setInterval(getFrequentServerHealth, frequentHealthCheckInterval);

    // Set up the refresh interval for domain controller statuses
    const domainControllerStatusRefreshInterval = 600000; // Default to 10 minutes
    setInterval(DomainControllerStatus, domainControllerStatusRefreshInterval);

    // Set up daily cleanup for recent actions at startup and then daily at midnight
    const performDailyActionsCleanup = async () => {
        try {
            const response = await fetch(`http://localhost:${process.env.PORT || 3001}/api/actions/cleanup-daily`, {
                method: 'DELETE'
            });
            const result = await response.json();
            console.log('[Daily Cleanup] Actions cleanup completed:', result);
        } catch (error) {
            console.error('[Daily Cleanup] Failed to cleanup actions:', error);
        }
    };

    // Don't run cleanup on startup - only at scheduled midnight time
    // performDailyActionsCleanup(); // Commented out to preserve actions during development

    // Schedule daily cleanup at midnight
    const scheduleNextCleanup = () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0); // Set to midnight
        
        const msUntilMidnight = tomorrow.getTime() - now.getTime();
        
        setTimeout(() => {
            performDailyActionsCleanup();
            // After first cleanup, schedule it to run every 24 hours
            setInterval(performDailyActionsCleanup, 24 * 60 * 60 * 1000);
        }, msUntilMidnight);
        
        console.log(`[Daily Cleanup] Next cleanup scheduled for: ${tomorrow.toLocaleString()}`);
    };

    scheduleNextCleanup();
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    server.close(() => {
        logger.info('Process terminated, server closed');
    });
});