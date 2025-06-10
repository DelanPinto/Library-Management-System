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

// Basic Auth API endpoints (mock for now)
app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  const { email, password } = req.body;
  
  // Mock authentication - replace with real logic later
  if (email && password) {
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: 1,
        email: email,
        role: 'user' // or 'admin'
      },
      token: 'mock-jwt-token'
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }
});

app.post('/api/auth/register', (req, res) => {
  console.log('Register attempt:', req.body);
  const { email, password, name } = req.body;
  
  // Mock registration - replace with real logic later
  if (email && password && name) {
    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: 2,
        email: email,
        name: name,
        role: 'user'
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Basic books API endpoints (mock)
app.get('/api/books/search', (req, res) => {
  const { q } = req.query;
  res.json({
    books: [],
    message: `Search for "${q}" - API not yet connected`,
    totalItems: 0
  });
});

// User API endpoints (mock)
app.get('/api/users/profile', (req, res) => {
  res.json({
    success: true,
    user: {
      id: 1,
      email: 'user@example.com',
      name: 'Test User',
      role: 'user'
    }
  });
});

// Catch all other API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Catch all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Page not found');
    }
  });
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
