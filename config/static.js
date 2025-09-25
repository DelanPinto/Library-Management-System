// Serve static files from the public directory
const express = require('express');
const path = require('path');

module.exports = function(app) {
  app.use(express.static(path.join(__dirname, '../public')));
};
