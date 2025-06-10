// server.js - Express backend with Google Books API
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const path = require('path');
require('dotenv').config();

const app = express();

// Debug: Log all environment variables related to ports
console.log('Environment PORT:', process.env.PORT);
console.log('All environment variables:', Object.keys(process.env).filter(key => key.includes('PORT')));

const PORT = process.env.PORT || 3000;
const DB_PORT = process.env.DB_PORT || 12760;

console.log('Using PORT:', PORT);

// Initialize cache with 1 hour TTL
const cache = new NodeCache({ stdTTL: 3600 });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Add this for form data
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

app.use('/api/', limiter);

// Debug middleware to log requests
app.use('/api/', (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, 
    req.method === 'POST' ? { body: req.body } : { query: req.query });
  next();
});

// Open Library API configuration
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
const OPEN_LIBRARY_COVERS_URL = 'https://covers.openlibrary.org/b';

// Open Library utility functions
function formatOpenLibraryResponse(works) {
  return works.map(work => ({
    id: work.key,
    title: work.title || 'Unknown Title',
    authors: work.author_name || ['Unknown Author'],
    publishedDate: work.first_publish_year || null,
    description: work.description || null,
    thumbnail: work.cover_i ? `${OPEN_LIBRARY_COVERS_URL}/id/${work.cover_i}-M.jpg` : null,
    categories: work.subject || [],
    pageCount: work.number_of_pages_median || null,
    language: work.language || null,
    isbn: work.isbn ? work.isbn[0] : null,
    publisher: work.publisher ? work.publisher[0] : null,
    source: 'openlibrary'
  }));
}

function formatOpenLibraryBookDetails(book) {
  return {
    id: book.key,
    title: book.title || 'Unknown Title',
    authors: book.authors ? book.authors.map(a => a.name) : ['Unknown Author'],
    publishedDate: book.first_publish_date || null,
    description: book.description || null,
    thumbnail: book.covers ? `${OPEN_LIBRARY_COVERS_URL}/id/${book.covers[0]}-M.jpg` : null,
    smallThumbnail: book.covers ? `${OPEN_LIBRARY_COVERS_URL}/id/${book.covers[0]}-S.jpg` : null,
    categories: book.subjects || [],
    pageCount: book.number_of_pages || null,
    language: book.languages ? book.languages[0].key : null,
    isbn: book.isbn_13 ? book.isbn_13[0] : (book.isbn_10 ? book.isbn_10[0] : null),
    publisher: book.publishers ? book.publishers[0].name : null,
    previewLink: book.preview_url || null,
    infoLink: `${OPEN_LIBRARY_BASE_URL}${book.key}`,
    source: 'openlibrary'
  };
}

// Health check endpoint - MOVED TO TOP for Railway
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'Library Management System is running',
    timestamp: new Date().toISOString(),
    port: PORT,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/search',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'POST /api/auth/logout',
      'GET /api/users/profile',
      'GET /api/books',
      'POST /api/books',
      'GET /login',
      'GET /register',
      'GET /user',
      'GET /admin'
    ]
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Main search endpoint - with better error handling
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
    const cacheKey = `search_google_${q}_${startIndex}_${maxResults}`;
    
    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json({
        books: cachedResult.books,
        totalPages: Math.ceil((cachedResult.totalItems || 0) / maxResults),
        currentPage: pageNum,
        totalItems: cachedResult.totalItems,
        source: 'googlebooks',
        fromCache: true
      });
    }

    let books = [];
    let totalItems = 0;

    try {
      const googleResponse = await axios.get('https://www.googleapis.com/books/v1/volumes', {
        params: {
          q: q,
          startIndex: startIndex,
          maxResults: maxResults
        },
        timeout: 10000
      });

      console.log('Google Books API response status:', googleResponse.status);
      console.log('Google Books API response items count:', googleResponse.data.items?.length || 0);

      books = (googleResponse.data.items || []).map(item => {
        const volumeInfo = item.volumeInfo;
        return {
          id: item.id,
          title: volumeInfo?.title || 'Unknown Title',
          authors: volumeInfo?.authors || ['Unknown Author'],
          publishedDate: volumeInfo?.publishedDate || null,
          description: volumeInfo?.description || null,
          thumbnail: volumeInfo?.imageLinks?.thumbnail || volumeInfo?.imageLinks?.smallThumbnail || null,
          categories: volumeInfo?.categories || [],
          pageCount: volumeInfo?.pageCount || null,
          language: volumeInfo?.language || null,
          isbn: volumeInfo?.industryIdentifiers ? volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_13' || id.type === 'ISBN_10')?.identifier : null,
          publisher: volumeInfo?.publisher || null,
          source: 'googlebooks'
        };
      });

      totalItems = googleResponse.data.totalItems || 0;

    } catch (apiError) {
      console.error('Google Books API error:', apiError.response?.data || apiError.message);
      // Return empty results instead of throwing error
      return res.json({
        books: [],
        totalPages: 0,
        currentPage: pageNum,
        totalItems: 0,
        source: 'googlebooks',
        error: 'Google Books API temporarily unavailable'
      });
    }

    const result = {
      books: books,
      totalItems: totalItems,
      source: 'googlebooks',
      query: q.trim(),
      startIndex: startIndex,
      maxResults: maxResults
    };

    // Cache the result
    cache.set(cacheKey, result);

    res.json({
      books: result.books,
      totalPages: Math.ceil((result.totalItems || 0) / maxResults),
      currentPage: pageNum,
      totalItems: result.totalItems,
      source: result.source
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      books: [],
      totalPages: 0,
      currentPage: 0,
      totalItems: 0
    });
  }
});

// Authentication API endpoints (built-in fallbacks)
app.post('/api/auth/login', (req, res) => {
  console.log('=== LOGIN ATTEMPT ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Content-Type:', req.get('Content-Type'));
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    console.log('Missing email or password');
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
      received: { email: !!email, password: !!password }
    });
  }
  
  // Mock authentication - replace with real logic later
  console.log('Login successful for:', email);
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
  console.log('=== REGISTER ATTEMPT ===');
  console.log('Body:', req.body);
  
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      message: 'All fields (email, password, name) are required',
      received: { email: !!email, password: !!password, name: !!name }
    });
  }
  
  // Mock registration - replace with real logic later
  console.log('Registration successful for:', email);
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
  console.log('=== LOGOUT ATTEMPT ===');
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// User API endpoints (built-in fallbacks)
app.get('/api/users/profile', (req, res) => {
  console.log('=== PROFILE REQUEST ===');
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

// Books API endpoints (built-in fallbacks)
app.get('/api/books', (req, res) => {
  console.log('=== BOOKS LIST REQUEST ===');
  res.json({
    success: true,
    books: [],
    message: 'No books in library yet',
    totalBooks: 0
  });
});

app.post('/api/books', (req, res) => {
  console.log('=== ADD BOOK REQUEST ===');
  console.log('Body:', req.body);
  
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

// Try to load external routes (if they exist)
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ External auth routes loaded');
} catch (routeError) {
  console.log('ℹ️  External auth routes not found, using built-in endpoints');
}

try {
  const bookRoutes = require('./routes/books');
  app.use('/api/books', bookRoutes);
  console.log('✅ External book routes loaded');
} catch (routeError) {
  console.log('ℹ️  External book routes not found, using built-in endpoints');
}

try {
  const userRoutes = require('./routes/users');
  app.use('/api/users', userRoutes);
  console.log('✅ External user routes loaded');
} catch (routeError) {
  console.log('ℹ️  External user routes not found, using built-in endpoints');
}

// Serve static HTML files
app.get('/login', (req, res) => {
  console.log('Login page requested');
  res.sendFile(path.join(__dirname, 'public', 'login.html'), (err) => {
    if (err) {
      console.error('Error serving login.html:', err);
      res.status(404).send(`
        <h1>Login page not found</h1>
        <p>Please make sure login.html exists in the public folder</p>
        <a href="/">Back to home</a>
      `);
    }
  });
});

app.get('/register', (req, res) => {
  console.log('Register page requested');
  res.sendFile(path.join(__dirname, 'public', 'register.html'), (err) => {
    if (err) {
      console.error('Error serving register.html:', err);
      res.status(404).send(`
        <h1>Register page not found</h1>
        <p>Please make sure register.html exists in the public folder</p>
        <a href="/">Back to home</a>
      `);
    }
  });
});

app.get('/user', (req, res) => {
  console.log('User page requested');
  res.sendFile(path.join(__dirname, 'public', 'user.html'), (err) => {
    if (err) {
      console.error('Error serving user.html:', err);
      res.status(404).send(`
        <h1>User page not found</h1>
        <p>Please make sure user.html exists in the public folder</p>
        <a href="/">Back to home</a>
      `);
    }
  });
});

app.get('/admin', (req, res) => {
  console.log('Admin page requested');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'), (err) => {
    if (err) {
      console.error('Error serving admin.html:', err);
      res.status(404).send(`
        <h1>Admin page not found</h1>
        <p>Please make sure admin.html exists in the public folder</p>
        <a href="/">Back to home</a>
      `);
    }
  });
});

// Catch-all for API routes that don't exist
app.all('/api/*', (req, res) => {
  console.log('API route not found:', req.method, req.path);
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /api/search',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'POST /api/auth/logout',
      'GET /api/users/profile',
      'GET /api/books',
      'POST /api/books'
    ]
  });
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
  console.log('Serving index.html for:', req.path);
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(404).send(`
        <h1>Page not found</h1>
        <p>Please make sure index.html exists in the public folder</p>
        <a href="/">Back to home</a>
      `);
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start the server with better error handling
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  
  // Test database connection on startup (with error handling)
  try {
    // Only test if database config exists
    const { testConnection } = require('./config/database');
    await testConnection();
    console.log('✅ Database connection test completed');
  } catch (dbError) {
    console.log('ℹ️  Database connection not configured or failed - continuing without DB');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
  }
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

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('✅ Server setup complete');

module.exports = app;
