const express = require('express');
const router = express.Router();
const db = require('../db/init');

router.get('/', (req, res) => {
    db.all('SELECT * FROM LockedOutUsers', (err, rows) => {
        if (err) {
            console.error('Failed to fetch locked out users:', err);
            return res.status(500).send('Failed to fetch locked out users.');
        }
        res.json(rows);
    });
});

module.exports = router;