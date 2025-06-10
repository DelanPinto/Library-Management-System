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
const HOST = '0.0.0.0';

console.log('🚂 Railway Deployment Starting...');
console.log('PORT:', PORT);
console.log('HOST:', HOST);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Initialize cache with 1 hour TTL
const cache = new NodeCache({ stdTTL: 3600 });

// Trust proxy - IMPORTANT for Railway
app.set('trust proxy', true);

// Middleware - Order matters!
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting - applied only to API routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CRITICAL: Health check endpoints FIRST - no middleware interference
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    port: PORT,
    env: process.env.NODE_ENV || 'production'
  });
});

app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    message: 'Library Management System is running on Railway',
    timestamp: new Date().toISOString(),
    port: PORT,
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Apply rate limiting only to API routes
app.use('/api/', limiter);

// Request logging for API routes only
app.use('/api/', (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.ip}`);
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

    // Call Google Books API with shorter timeout for Railway
    const googleResponse = await axios.get('https://www.googleapis.com/books/v1/volumes', {
      params: {
        q: q,
        startIndex: startIndex,
        maxResults: maxResults
      },
      timeout: 5000 // Shorter timeout for Railway
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
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }
  
  // Mock authentication
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
    const filePath = path.join(__dirname, 'public', fileName);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error(`File not found: ${fileName}`);
        res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Page Not Found</title></head>
          <body>
            <h1>Page not found</h1>
            <p>${fileName} not found in public folder</p>
            <a href="/">Back to home</a>
          </body>
          </html>
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

// SPA fallback - catch all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('index.html not found');
      res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Library Management System</title></head>
        <body>
          <h1>Library Management System</h1>
          <p>Welcome to the Library Management System</p>
          <p>API is running on Railway</p>
        </body>
        </html>
      `);
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  console.error('Stack:', err.stack);
  
  if (!res.headersSent) {
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  }
});

// Start server - MUST bind to 0.0.0.0 for Railway
const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on ${HOST}:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`✅ Health check available at: /health`);
  console.log(`✅ Ready to accept connections`);
});

// Server error handling
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Enhanced graceful shutdown for Railway
const gracefulShutdown = (signal) => {
  console.log(`📍 ${signal} received, shutting down gracefully`);
  
  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      console.error('❌ Error during server close:', err);
      process.exit(1);
    }
    
    console.log('📍 Server closed successfully');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.log('📍 Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle Railway signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors gracefully
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('✅ Server setup complete - Railway ready');

module.exports = app;
