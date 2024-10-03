const express = require('express');
const router = express.Router();

router.post('/hello-world', async (req, res) => {
  try {
    const response = await fetch('http://localhost:3001/hello-world', {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }

    const data = await response.json();
    res.send(data);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

module.exports = router;