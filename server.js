// Fixed server.js for Railway deployment
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const path = require('path');
require('dotenv').config();

const app = express();

// Railway-specific configuration
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Important: bind to all interfaces for Railway

console.log('🚂 Railway Deployment Starting...');
console.log('PORT:', PORT);
console.log('HOST:', HOST);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Initialize cache with 1 hour TTL
const cache = new NodeCache({ stdTTL: 3600 });

// Middleware
app.use(cors({
  origin: true, // Allow all origins for now
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting - more lenient for Railway
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Increased limit
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// CRITICAL: Health check must be first and simple
app.get('/', (req, res) => {
  console.log('✅ Root endpoint accessed from:', req.ip);
  res.status(200).json({ 
    status: 'OK',
    message: 'Library Management System is running',
    timestamp: new Date().toISOString(),
    port: PORT,
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'production'
  });
});

app.get('/health', (req, res) => {
  console.log('✅ Health check accessed from:', req.ip);
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Debug middleware - only for API routes
app.use('/api/', (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Google Books API search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { q, page = 0 } = req.query;
    
    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    let pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 0) {
      pageNum = 0;
    }
    
    const startIndex = pageNum * 10;
    const maxResults = 10;
    const cacheKey = `search_${q}_${startIndex}`;
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json({
        ...cachedResult,
        fromCache: true
      });
    }

    // Call Google Books API
    const googleResponse = await axios.get('https://www.googleapis.com/books/v1/volumes', {
      params: {
        q: q,
        startIndex: startIndex,
        maxResults: maxResults
      },
      timeout: 8000 // Reduced timeout for Railway
    });

    const books = (googleResponse.data.items || []).map(item => {
      const volumeInfo = item.volumeInfo;
      return {
        id: item.id,
        title: volumeInfo?.title || 'Unknown Title',
        authors: volumeInfo?.authors || ['Unknown Author'],
        publishedDate: volumeInfo?.publishedDate || null,
        description: volumeInfo?.description || null,
        thumbnail: volumeInfo?.imageLinks?.thumbnail || null,
        categories: volumeInfo?.categories || [],
        pageCount: volumeInfo?.pageCount || null,
        language: volumeInfo?.language || null,
        isbn: volumeInfo?.industryIdentifiers ? 
          volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_13' || id.type === 'ISBN_10')?.identifier : null,
        publisher: volumeInfo?.publisher || null,
        source: 'googlebooks'
      };
    });

    const result = {
      books: books,
      totalPages: Math.ceil((googleResponse.data.totalItems || 0) / maxResults),
      currentPage: pageNum,
      totalItems: googleResponse.data.totalItems || 0,
      source: 'googlebooks'
    };

    // Cache the result
    cache.set(cacheKey, result);
    res.json(result);

  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ 
      error: 'Search service temporarily unavailable',
      books: [],
      totalPages: 0,
      currentPage: 0,
      totalItems: 0
    });
  }
});

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  console.log('🔐 Login attempt from:', req.ip);
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }
  
  // Mock authentication
  console.log('✅ Login successful for:', email);
  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: 1,
      email: email,
      name: email.split('@')[0],
      role: email.includes('admin') ? 'admin' : 'user'
    },
    token: 'mock-jwt-token-' + Date.now()
  });
});

app.post('/api/auth/register', (req, res) => {
  console.log('📝 Register attempt from:', req.ip);
  
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }
  
  res.json({
    success: true,
    message: 'Registration successful',
    user: {
      id: Date.now(),
      email: email,
      name: name,
      role: 'user'
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// User endpoints
app.get('/api/users/profile', (req, res) => {
  res.json({
    success: true,
    user: {
      id: 1,
      email: 'user@example.com',
      name: 'Test User',
      role: 'user',
      joinDate: new Date().toISOString()
    }
  });
});

// Books endpoints
app.get('/api/books', (req, res) => {
  res.json({
    success: true,
    books: [],
    totalBooks: 0
  });
});

app.post('/api/books', (req, res) => {
  const { title, authors, isbn } = req.body;
  
  if (!title) {
    return res.status(400).json({
      success: false,
      message: 'Title is required'
    });
  }
  
  res.json({
    success: true,
    message: 'Book added successfully',
    book: {
      id: Date.now(),
      title,
      authors: authors || [],
      isbn: isbn || null,
      addedDate: new Date().toISOString()
    }
  });
});

// Serve static HTML files
const staticRoutes = ['/login', '/register', '/user', '/admin'];
staticRoutes.forEach(route => {
  app.get(route, (req, res) => {
    const fileName = route.substring(1) + '.html';
    res.sendFile(path.join(__dirname, 'public', fileName), (err) => {
      if (err) {
        res.status(404).send(`
          <h1>Page not found</h1>
          <p>${fileName} not found in public folder</p>
          <a href="/">Back to home</a>
        `);
      }
    });
  });
});

// API 404 handler
app.all('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      res.status(404).send(`
        <h1>Page not found</h1>
        <p>index.html not found in public folder</p>
        <a href="/">Back to home</a>
      `);
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server - CRITICAL: Must bind to 0.0.0.0 for Railway
const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on ${HOST}:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`✅ Ready to accept connections`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown for Railway
const gracefulShutdown = (signal) => {
  console.log(`📍 ${signal} received, shutting down gracefully`);
  server.close(() => {
    console.log('📍 Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.log('📍 Forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors without crashing
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

console.log('✅ Server setup complete - Railway ready');

module.exports = app;
