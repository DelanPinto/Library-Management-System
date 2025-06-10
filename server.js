// server.js - Express backend with Google Books API
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const { testConnection } = require('./config/database');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PORT = process.env.DB_PORT || 12760;

// Initialize cache with 1 hour TTL
const cache = new NodeCache({ stdTTL: 3600 });

// Middleware
app.use(cors());
app.use(bodyParser.json());
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
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, req.query);
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
    port: PORT
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

// Routes - with error handling
try {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/books', require('./routes/books'));
  app.use('/api/users', require('./routes/users'));
} catch (routeError) {
  console.error('Route loading error:', routeError);
  // Continue without these routes if they fail to load
}

// Serve static HTML files
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
  // For API routes that don't exist
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // For all other routes, serve index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server with better error handling
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Test database connection on startup (with error handling)
  try {
    await testConnection();
    console.log('Database connection test completed');
  } catch (dbError) {
    console.error('Database connection failed:', dbError);
    // Don't exit - let the app run without DB if needed
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 

module.exports = app;
