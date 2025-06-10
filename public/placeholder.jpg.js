/* Simple placeholder image for missing book covers */
const express = require('express');
const app = express();
app.get('/placeholder.jpg', (req, res) => {
  // 1x1 transparent GIF
  const img = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'
  );
  res.set('Content-Type', 'image/gif');
  res.send(img);
});
module.exports = app;
