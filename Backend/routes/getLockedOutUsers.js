const express = require('express');
const router = express.Router();
const db = require('../db/init');

router.get('/', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM LockedOutUsers');
        const rows = stmt.all();
        res.json(rows);
    } catch (err) {
        console.error('Failed to fetch locked out users:', err);
        return res.status(500).send('Failed to fetch locked out users.');
    }
});

module.exports = router;