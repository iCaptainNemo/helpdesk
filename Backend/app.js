const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors'); // Import the cors middleware
const session = require('express-session'); // Import express-session for session management
require('dotenv').config(); // Load environment variables from .env file

const db = require('./db/init');
const { insertOrUpdateUser, fetchUser, insertOrUpdateAdminUser, fetchAdminUser } = require('./db/queries');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000", // Allow requests from this origin
        methods: ["GET", "POST"]
    }
});

app.use(cors()); // Enable CORS for all routes

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