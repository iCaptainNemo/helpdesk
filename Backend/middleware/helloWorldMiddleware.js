const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/hello-world', async (req, res) => {
  try {
    const response = await axios.post('http://localhost:3001/hello-world');
    res.send(response.data);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

module.exports = router;