const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const db = require('./db/init');
const ntlmConfig = require('./middleware/ntlmConfig');
const attachUserInfo = require('./middleware/attachUserInfo');
const verifyToken = require('./middleware/verifyToken'); // Ensure JWT middleware is used

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:3000", "http://172.25.129.95:3000"], // Allow both localhost and your frontend address
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Function to check if the origin is allowed
const isOriginAllowed = (origin) => {
    const allowedOrigins = [
        'http://localhost:3000', 
        'http://172.25.129.95:3000', 
        'http://172.25.129.95:3001' // Add backend address
    ];
    const subnetPattern = /^http:\/\/172\.25\.129\.\d{1,3}:3000$/;
    return allowedOrigins.includes(origin) || subnetPattern.test(origin);
};

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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Use middleware
app.use(ntlmConfig(app)); // Pass the app instance to ntlmConfig
app.use(attachUserInfo);

// Import routes
const fetchADObjectRoute = require('./routes/fetchADObject');
const fetchUserRoute = require('./routes/fetchUser');
const helloWorldRoute = require('./routes/hello-world');
const helloWorldMiddleware = require('./middleware/helloWorldMiddleware');
const forbidden = require('./middleware/forbidden');
const notFound = require('./middleware/notfound');
const authRoutes = require('./routes/auth');

// Use routes and pass db
app.use((req, res, next) => {
    req.db = db;
    next();
});

app.use('/api/fetch-adobject', verifyToken, fetchADObjectRoute); // Ensure JWT middleware is used
app.use('/api/fetch-user', verifyToken, fetchUserRoute); // Ensure JWT middleware is used
app.use('/api/hello-world', helloWorldRoute);
app.use('/api', helloWorldMiddleware);
app.use('/api/auth', authRoutes);

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

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Listen on all network interfaces

server.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});