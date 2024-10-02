const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Import routes
const fetchUserRoute = require('./routes/fetchUser');
const helloWorldRoute = require('./routes/hello-world');

// Use routes and pass db
app.use((req, res, next) => {
    req.db = db;
    next();
});

app.use('/api', fetchUserRoute);
app.use('/api', helloWorldRoute);

// Catch-all handler to serve the React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Socket.IO setup
io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});