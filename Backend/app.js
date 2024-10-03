const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors'); // Import the cors middleware

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

const dbPath = path.join(__dirname, 'db', 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Import routes
const fetchUserRoute = require('./routes/fetchUser');
const helloWorldRoute = require('./routes/hello-world');
const helloWorldMiddleware = require('./middleware/helloWorldMiddleware');
const forbidden = require('./middleware/forbidden');
const notFound = require('./middleware/notfound');

// Use routes and pass db
app.use((req, res, next) => {
    req.db = db;
    next();
});

app.use('/api', fetchUserRoute);
app.use('/api/hello-world', helloWorldRoute); // Use the new hello-world route
app.use('/api', helloWorldMiddleware);

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