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
const PORT = process.env.PORT || 3306;

// Initialize cache
const cache = new NodeCache({ stdTTL: 3600 });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});
app.use('/api/', limiter);

// Debug logger
app.use('/api/', (req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, req.query);
    next();
});

// Google Books API Search
app.get('/api/search', async (req, res) => {
    try {
        const { q, page = 0 } = req.query;
        if (!q || q.trim() === '') return res.status(400).json({ error: 'Query parameter is required' });

        let pageNum = parseInt(page);
        if (isNaN(pageNum) || pageNum < 0) pageNum = 0;

        const startIndex = pageNum * 10;
        const maxResults = 10;
        const cacheKey = `search_google_${q}_${startIndex}_${maxResults}`;

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

        const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
            params: { q, startIndex, maxResults },
            timeout: 10000
        });

        const books = (response.data.items || []).map(item => {
            const info = item.volumeInfo;
            return {
                id: item.id,
                title: info?.title || 'Unknown Title',
                authors: info?.authors || ['Unknown Author'],
                publishedDate: info?.publishedDate || null,
                description: info?.description || null,
                thumbnail: info?.imageLinks?.thumbnail || info?.imageLinks?.smallThumbnail || null,
                categories: info?.categories || [],
                pageCount: info?.pageCount || null,
                language: info?.language || null,
                isbn: info?.industryIdentifiers?.find(id => id.type === 'ISBN_13' || id.type === 'ISBN_10')?.identifier || null,
                publisher: info?.publisher || null,
                source: 'googlebooks'
            };
        });

        const totalItems = response.data.totalItems || 0;

        const result = {
            books,
            totalItems,
            source: 'googlebooks',
            query: q.trim(),
            startIndex,
            maxResults
        };

        cache.set(cacheKey, result);

        res.json({
            books,
            totalPages: Math.ceil(totalItems / maxResults),
            currentPage: pageNum,
            totalItems,
            source: 'googlebooks'
        });
    } catch (error) {
        console.error('Search error:', error);
        return res.status(503).json({
            error: 'Google Books API unavailable',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Route Setup
app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/users', require('./routes/users'));

// Serve HTML pages
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (_, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (_, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/user', (_, res) => res.sendFile(path.join(__dirname, 'public', 'user.html')));
app.get('/admin', (_, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// 404 fallback
app.use((_, res) => res.status(404).send('Route not found'));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    testConnection();
});

module.exports = app;
