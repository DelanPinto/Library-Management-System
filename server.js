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

// Initialize cache with 1 hour TTL
const cache = new NodeCache({ stdTTL: 3600 });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
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

// Remove Open Library API configuration
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
const OPEN_LIBRARY_COVERS_URL = 'https://covers.openlibrary.org/b';

// Library storage (in-memory)
// let libraryBooks = [];
// let borrowedBooks = [];

// Remove Open Library utility functions
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

// Main search endpoint (consolidated) - Now using Google Books API
app.get('/api/search', async (req, res) => {
  try {
    const { q, page = 0 } = req.query;
    
    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Parse page number and handle invalid values
    let pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 0) {
      pageNum = 0;
    }
    
    const startIndex = pageNum * 10; // Google Books API uses startIndex
    const maxResults = 10; // Or a different default/configurable value
    
    // Create cache key
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

      // Format Google Books API response to match expected structure
      books = (googleResponse.data.items || []).map(item => {
          const volumeInfo = item.volumeInfo;
          return {
              id: item.id, // Use Google Books Volume ID
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
              // Note: Availability check against local DB is done in the /api/books/search endpoint
              // This endpoint just returns raw Google Books data with basic formatting.
          };
      });

      totalItems = googleResponse.data.totalItems || 0;

    } catch (apiError) {
      console.error('Google Books API error:', apiError.response?.data || apiError.message);
      // Return a more informative error or an empty result set
       return res.status(503).json({ 
        error: 'Google Books API unavailable',
        details: apiError.response?.data?.error?.message || apiError.message
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

    // Return in format expected by frontend
    res.json({
      books: result.books,
      totalPages: Math.ceil((result.totalItems || 0) / maxResults),
      currentPage: pageNum,
      totalItems: result.totalItems,
      source: result.source
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Alternative book search endpoint (for compatibility) - This endpoint is already updated in routes/books.js
// Keep this route definition here, but the implementation is in routes/books.js
// app.get('/api/books/search', async (req, res) => { ... }); 

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/users', require('./routes/users'));

// Serve static HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

// Basic error handling for unsupported routes
app.use((req, res) => {
    res.status(404).send('Route not found');
});

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  // Test database connection on startup
  testConnection();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

module.exports = app;
