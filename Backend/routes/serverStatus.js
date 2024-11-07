const express = require('express');
const router = express.Router();
const db = require('../db/init');

router.get('/status', (req, res) => {
    db.all('SELECT * FROM Servers', (err, rows) => {
        if (err) {
            console.error('Failed to fetch server statuses:', err);
            return res.status(500).send('Failed to fetch server statuses.');
        }
        res.json(rows);
    });
});

module.exports = router;