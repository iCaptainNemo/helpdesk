const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors'); // Import the cors middleware
const session = require('express-session'); // Import express-session for session management
const ntlm = require('express-ntlm'); // Import express-ntlm for Windows Authentication
require('dotenv').config(); // Load environment variables from .env file

const db = require('./db/init');
const { insertOrUpdateUser, fetchUser, insertOrUpdateAdminUser, fetchAdminUser } = require('./db/queries');
const { getDomainInfo } = require('./utils/ldapUtils'); // Import the LDAP utility functions

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000", // Allow requests from this origin
        methods: ["GET", "POST"],
        credentials: true // Allow credentials (cookies, authorization headers, etc.)
    }
});

app.use(cors({
    origin: "http://localhost:3000", // Allow requests from this origin
    credentials: true // Allow credentials (cookies, authorization headers, etc.)
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key', // Use environment variable for secret
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// Middleware to dynamically set NTLM configuration
app.use(async (req, res, next) => {
    try {
        const domainInfo = await getDomainInfo();
        const domainControllers = domainInfo.domainControllers;

        app.use(ntlm({
            domain: domainInfo.domainRoot,
            domaincontroller: domainControllers
        }));

        next();
    } catch (error) {
        console.error('Failed to get domain info:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Middleware to attach the authenticated username to the request
app.use((req, res, next) => {
    if (req.ntlm) {
        req.username = req.ntlm.UserName;
        req.computerName = req.ntlm.Workstation;
    }
    next();
});

// Import routes
const fetchADObjectRoute = require('./routes/fetchADObject');
const fetchUserRoute = require('./routes/fetchUser');
const helloWorldRoute = require('./routes/hello-world');
const helloWorldMiddleware = require('./middleware/helloWorldMiddleware');
const forbidden = require('./middleware/forbidden');
const notFound = require('./middleware/notfound');
const authRoutes = require('./routes/auth'); // Import auth routes

// Use routes and pass db
app.use((req, res, next) => {
    req.db = db;
    next();
});

app.use('/api/fetch-adobject', fetchADObjectRoute);
app.use('/api/fetch-user', fetchUserRoute);
app.use('/api/hello-world', helloWorldRoute); // Use the new hello-world route
app.use('/api', helloWorldMiddleware);
app.use('/api/auth', authRoutes); // Use auth routes

// Middleware to handle 403 Forbidden errors
app.use(forbidden);

// Middleware to handle 404 Not Found errors
app.use(notFound);

// Socket.IO setup
io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3001; // Backend server port
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});