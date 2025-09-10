const express = require('express');
const router = express.Router();
const db = require('../db/init');

router.get('/status', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM Servers');
        const rows = stmt.all();
        res.json(rows);
    } catch (err) {
        console.error('Failed to fetch server statuses:', err);
        return res.status(500).send('Failed to fetch server statuses.');
    }
});

module.exports = router;