const express = require('express');
const router = express.Router();
const { fetchDomainControllers } = require('../db/queries'); // Import the fetchDomainControllers function

router.get('/', (req, res) => {
    fetchDomainControllers((err, result) => {
        if (err) {
            console.error('Failed to fetch domain controllers:', err);
            return res.status(500).send('Failed to fetch domain controllers.');
        }
        res.json(result);
    });
});

module.exports = router;