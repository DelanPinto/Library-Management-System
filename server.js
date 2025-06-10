// minimal-server.js - Test version for Railway
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Starting minimal server...');
console.log('PORT:', PORT);

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Essential routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Library Management System is running!',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content - prevents 404 for favicon
});

// Serve HTML files if they exist
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'), (err) => {
    if (err) {
      res.status(404).send('Login page not found');
    }
  });
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'), (err) => {
    if (err) {
      res.status(404).send('Register page not found');
    }
  });
});

// Catch all other routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
      if (err) {
        res.status(404).send('Page not found');
      }
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📍 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('📍 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📍 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('📍 Server closed');
    process.exit(0);
  });
});

// Error handlers
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

console.log('✅ Server setup complete');

module.exports = app;
