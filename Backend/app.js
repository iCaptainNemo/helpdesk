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

// Function to check if the origin is allowed
const isOriginAllowed = (origin) => {
    if (!origin) return true; // Allow requests without origin (e.g., Postman)
    const allowedOrigins = [
        process.env.FRONTEND_URL_1, 
        process.env.FRONTEND_URL_2, 
        process.env.BACKEND_URL // Add backend address
    ];
    const subnetPattern = /^http:\/\/172\.25\.129\.\d{1,3}:3000$/;
    return allowedOrigins.includes(origin) || subnetPattern.test(origin);
};

// CORS middleware
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || isOriginAllowed(origin)) {
            callback(null, true);
        } else {
            console.error(`Not allowed by CORS: ${origin}`); // Add logging
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

// Use routes and pass db to them
app.use('/api/fetch-adobject', verifyToken, fetchADObjectRoute); 
app.use('/api/fetch-user', verifyToken, fetchUserRoute); 
app.use('/api/hello-world', helloWorldRoute);
app.use('/api', helloWorldMiddleware);

// Authentication routes (no token required for login)
app.use('/api/auth', authRoutes); // Includes /windows-login

// Middleware to handle 403 Forbidden errors
app.use(forbidden);

// Middleware to handle 404 Not Found errors
app.use(notFound);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);

    if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ error: 'Internal Server Error' });
    } else {
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: err.message,
            stack: err.stack // Include stack trace only in development
        });
    }
});

// Socket.IO setup
io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Listen on all network interfaces

server.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});
