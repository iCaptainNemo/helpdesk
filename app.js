const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

const dbPath = './db/database.db'; // Define dbPath here

// Import routes
const fetchUserRoute = require('./routes/fetchUser');
const helloWorldRoute = require('./routes/hello-world');

// Use routes and pass dbPath
app.use((req, res, next) => {
    req.dbPath = dbPath;
    next();
});

app.use('/', fetchUserRoute);
app.use('/', helloWorldRoute);

app.get('/', (req, res) => {
    res.render('index');
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});