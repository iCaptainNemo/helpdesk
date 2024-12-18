const express = require('express');
const router = express.Router();
const { fetchDomainControllers, fetchPDC } = require('../db/queries'); // Import the fetchPDC function

router.get('/', (req, res) => {
  fetchDomainControllers((err, result) => {
    if (err) {
      console.error('Failed to fetch domain controllers:', err);
      return res.status(500).send('Failed to fetch domain controllers.');
    }
    res.json(result);
  });
});

router.get('/pdc', (req, res) => {
    fetchPDC((err, result) => {
      if (err) {
        console.error('Failed to fetch PDC:', err);
        return res.status(500).send('Failed to fetch PDC.');
      }
      if (!result) {
        return res.status(404).send('PDC not found.');
      }
      res.send(result.PDC); // Send the PDC as plain text
    });
  });

module.exports = router;