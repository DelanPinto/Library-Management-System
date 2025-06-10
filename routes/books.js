const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../config/database');
const { verifyToken, checkAdmin } = require('../middleware/auth');
const NodeCache = require('node-cache');
const bookCache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

// Test database connection and tables
router.get('/test-db', async (req, res) => {
    console.log('Received request for /api/books/test-db');
    try {
        if (!pool) {
            return res.status(503).json({ error: 'Database not available' });
        }

        // Test connection
        const connection = await pool.getConnection();
        console.log('Database connection successful');
        
        // Check if books table exists
        const [tables] = await connection.query('SHOW TABLES');
        console.log('Available tables:', tables);
        const tableNames = tables.map(table => Object.values(table)[0]);
        
        // Check books table structure if it exists
        let booksTableInfo = null;
        if (tableNames.includes('books')) {
            const [columns] = await connection.query('DESCRIBE books');
            booksTableInfo = columns;
            console.log('Books table structure:', columns);
        }
        
        connection.release();
        
        res.json({
            connection: 'successful',
            tables: tableNames,
            booksTableStructure: booksTableInfo
        });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({ 
            error: 'Database test failed',
            details: error.message
        });
    }
});

// Search books using Google Books API
router.get('/search', async (req, res) => {
    let connection;
    try {
        const { q, startIndex = 0, maxResults = 10 } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Check if the user is an admin
        let isAdmin = false;
        if (req.headers.authorization) {
            try {
                // Decode JWT to check role
                const token = req.headers.authorization.split(' ')[1];
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || '066c258afe577bccc01510284247bcdabb5f846b589b28c7544dc67f9d1f5c6669b2723c0cecbafea18d15a1464344d99cf638de52632f01c2b525660240e0d0';
                const decoded = jwt.verify(token, JWT_SECRET);
                isAdmin = decoded.role === 'admin';
            } catch (e) {
                // If token is invalid, treat as non-admin
                isAdmin = false;
            }
        }

        console.log('Starting search for:', q, 'isAdmin:', isAdmin);
        const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&startIndex=${startIndex}&maxResults=${maxResults}`;
        
        // First, get the Google Books API response
        let googleResponse;
        try {
            googleResponse = await axios.get(apiUrl, {
                timeout: 10000,
                headers: { 'Accept': 'application/json' }
            });
            console.log('Google Books API response received successfully');
        } catch (apiError) {
            console.error('Google Books API error:', apiError.message);
            return res.status(503).json({ 
                error: 'Google Books API unavailable',
                details: apiError.message
            });
        }

        if (!googleResponse.data.items) {
            console.log('No books found in Google Books API response');
            return res.json({
                books: [],
                totalItems: 0,
                currentPage: 0,
                maxResults: parseInt(maxResults),
                totalPages: 0
            });
        }

        // Get database connection
        try {
            connection = await pool.getConnection();
            console.log('Database connection established');
        } catch (dbError) {
            console.error('Database connection error:', dbError.message);
            return res.status(503).json({ 
                error: 'Database unavailable',
                details: dbError.message
            });
        }

        // Process each book
        let books = await Promise.all(
            googleResponse.data.items.map(async (item) => {
                const volumeInfo = item.volumeInfo;
                const bookId = item.id;

                let isAvailable = false;
                let totalCopies = 0;
                let availableCopies = 0;
                let existingBooks = [];
                let localDbId = null;

                try {
                    // Log the Google Books ID we're searching for
                    console.log(`Checking availability for book ID: ${bookId}`);
                    
                    // Check local database for book availability
                    [existingBooks] = await connection.query(
                        'SELECT id, total_copies, available_copies FROM books WHERE google_books_id = ?',
                        [bookId]
                    );

                    console.log(`Database query result for book ${bookId}:`, existingBooks);

                    if (existingBooks.length > 0) {
                        const localBook = existingBooks[0];
                        isAvailable = localBook.available_copies > 0;
                        totalCopies = localBook.total_copies;
                        availableCopies = localBook.available_copies;
                        localDbId = localBook.id;
                        console.log(`Book ${bookId} found in database:`, {
                            id: localDbId,
                            totalCopies,
                            availableCopies,
                            isAvailable
                        });
                    } else {
                        console.log(`Book ${bookId} not found in database`);
                    }
                } catch (dbError) {
                    console.error(`Database error for book ${bookId}:`, dbError.message);
                    // Continue processing other books even if one fails
                }

                // Log the availability details right before returning the book object
                console.log(`Book ${bookId} availability details before response:`, {
                    isAvailable,
                    totalCopies,
                    availableCopies,
                    isInLocalLibrary: existingBooks.length > 0,
                    localDbId
                });

                return {
                    id: bookId,
                    localDbId: localDbId || null,
                    title: volumeInfo?.title || 'Unknown Title',
                    authors: volumeInfo?.authors || ['Unknown Author'],
                    publishedDate: volumeInfo?.publishedDate || null,
                    description: volumeInfo?.description || null,
                    thumbnail: volumeInfo?.imageLinks?.thumbnail || volumeInfo?.imageLinks?.smallThumbnail || null,
                    publisher: volumeInfo?.publisher || null,
                    isAvailable,
                    totalCopies,
                    availableCopies,
                    isInLocalLibrary: existingBooks.length > 0
                };
            })
        );

        // For users, only return available books. For admin, return all books in local DB (available and unavailable)
        if (!isAdmin) {
            books = books.filter(book => book.isAvailable);
        }

        // Send response
        res.json({
            books,
            totalItems: books.length,
            currentPage: Math.floor(parseInt(startIndex) / parseInt(maxResults)),
            maxResults: parseInt(maxResults),
            totalPages: Math.ceil(books.length / parseInt(maxResults))
        });

    } catch (error) {
        console.error('Unexpected search error:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            error: 'Internal server error during search',
            details: error.message
        });
    } finally {
        if (connection) {
            try {
                connection.release();
                console.log('Database connection released');
            } catch (releaseError) {
                console.error('Error releasing database connection:', releaseError.message);
            }
        }
    }
});

async function getBookDetails(bookId) {
    // This function is primarily used by the borrow endpoint.
    // It should now only fetch from the local database's 'books' table using the local book ID.
    // If not found locally, it won't fetch from Google Books API here.
    
    const cached = bookCache.get(`book_local_${bookId}`); // Use a different cache key
    if (cached) return cached;

    let [details] = [[]];

    try {
         // Search local database by the primary key 'id'
         [details] = await pool.query(
             `SELECT id, title, authors, total_copies, available_copies FROM books WHERE id = ?`,
             [bookId] // Assuming bookId passed here is the local database ID
         );

    } catch (dbError) {
        console.error(`Error fetching book details from DB for ID ${bookId}:`, dbError);
        return null; // Return null if DB lookup fails
    }

    if (details.length === 0) {
        return null; // Return null if book not found in local database
    }

    const result = details[0];
    // Format the result to match expected structure (e.g., for borrow endpoint)
    result.isAvailable = result.available_copies > 0;

    // Cache and return
    bookCache.set(`book_local_${bookId}`, result);
    return result;
}

// Add book to library (Admin only)
router.post('/add', verifyToken, checkAdmin, async (req, res) => {
    try {
        // The frontend sends google_book_id, which we'll now store in the 'books' table.
        const { google_book_id, total_copies = 1 } = req.body; 

        if (!google_book_id) {
            return res.status(400).json({ error: 'Book ID is required' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Fetch book details from Google Books API using the provided ID
            const googleResponse = await axios.get(`https://www.googleapis.com/books/v1/volumes/${google_book_id}`);
            const apiData = googleResponse.data;
            const volumeInfo = apiData.volumeInfo;
            
            if (!volumeInfo) {
                await connection.rollback();
                return res.status(404).json({ error: 'Book not found in Google Books' });
            }

            // Extract core book data from Google Books API response
            const title = volumeInfo?.title || 'Unknown Title';
            const authors = volumeInfo?.authors || ['Unknown Author'];
            
            // Check if the book (by Google Books ID) already exists in our database
            const [existingBooks] = await connection.query(
                'SELECT id FROM books WHERE google_books_id = ?',
                [google_book_id]
            );

            if (existingBooks.length > 0) {
                 await connection.rollback();
                 return res.status(409).json({ error: 'This book is already in the library' });
            }

            // Insert the new book into the books table
            const [result] = await connection.query(
                `INSERT INTO books (
                    google_books_id,
                    title,
                    authors,
                    total_copies,
                    available_copies,
                    thumbnail
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    google_book_id,
                    title,
                    JSON.stringify(authors),
                    total_copies,
                    total_copies, // Initially all copies are available
                    `http://books.google.com/books/content?id=${google_book_id}&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs-api`
                ]
            );

            await connection.commit();
            res.json({ message: 'Book added successfully', bookId: result.insertId });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Add book error:', error);
        if (error.response?.status === 404) {
            res.status(404).json({ error: 'Book not found in Google Books' });
        } else {
            res.status(500).json({ error: 'Error adding book to library' });
        }
    }
});

// Temporary endpoint to describe the book_requests table
router.get('/describe-book-requests', verifyToken, checkAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [columns] = await connection.query('DESCRIBE book_requests');
        console.log('Description of book_requests table:', columns);
        res.json(columns);
    } catch (error) {
        console.error('Error describing book_requests table:', error);
        res.status(500).json({ error: 'Error describing table', details: error.message });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Request to borrow a book
router.post('/borrow/:bookId', verifyToken, async (req, res) => {
    let connection;
    try {
        const { bookId } = req.params;
        const userId = req.user.id;

        console.log(`Processing borrow request - Book ID: ${bookId}, User ID: ${userId}`);

        // Get database connection
        try {
            connection = await pool.getConnection();
            console.log('Database connection established');
        } catch (dbError) {
            console.error('Database connection error:', dbError);
            return res.status(503).json({ error: 'Database unavailable' });
        }

        await connection.beginTransaction();
        console.log('Transaction started');

        try {
            // Check if book exists and is available using the local ID
            const [books] = await connection.query(
                'SELECT id, available_copies FROM books WHERE id = ?',
                [bookId]
            );

            console.log('Book query result:', books);

            if (books.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: 'Book not found in local library' });
            }

            const book = books[0];
            if (book.available_copies <= 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'Book is not available for borrowing' });
            }

            // Check if user already has an active borrow record for this book
            const [existingRecords] = await connection.query(
                `SELECT id FROM book_records 
                 WHERE user_id = ? AND book_id = ? 
                 AND request_type = 'borrow'
                 AND status IN ('borrowed')`,
                [userId, book.id]
            );

            if (existingRecords.length > 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'You have already borrowed this book' });
            }

            // Insert new borrow record as pending (requires admin approval)
            const [recordResult] = await connection.query(
                `INSERT INTO book_records (
                    user_id,
                    book_id,
                    request_type,
                    status,
                    request_date,
                    issue_date
                ) VALUES (?, ?, 'borrow', 'pending', NOW(), NULL)`,
                [userId, book.id]
            );

            // Do NOT decrement available copies here. Only do so on admin approval.

            await connection.commit();
            console.log('Transaction committed');

            res.status(201).json({
                message: 'Borrow request submitted and pending admin approval',
                recordId: recordResult.insertId
            });
        } catch (error) {
            console.error('Transaction error:', error);
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Borrow request error:', error);
        res.status(500).json({ 
            error: 'Error submitting borrow request',
            details: error.message
        });
    } finally {
        if (connection) {
            try {
                connection.release();
                console.log('Database connection released');
            } catch (releaseError) {
                console.error('Error releasing database connection:', releaseError);
            }
        }
    }
});

// Request to return a book
router.post('/return/:bookId', verifyToken, async (req, res) => {
    let connection;
    try {
        const { bookId } = req.params;
        const userId = req.user.id;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Find the active borrow record
        const [borrowRecords] = await connection.query(
            `SELECT id FROM book_records 
             WHERE user_id = ? AND book_id = ? 
             AND request_type = 'borrow' 
             AND status IN ('approved', 'borrowed') 
             ORDER BY issue_date DESC LIMIT 1`,
            [userId, bookId]
        );
        if (borrowRecords.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'You have not borrowed this book or it is already returned' });
        }
        const recordId = borrowRecords[0].id;

        // 2. Insert new return request as pending
        await connection.query(
            `INSERT INTO book_records (
                user_id,
                book_id,
                request_type,
                status,
                request_date,
                return_due_date
            ) VALUES (?, ?, 'return', 'pending', NOW(), NULL)`,
            [userId, bookId]
        );

        await connection.commit();
        res.status(201).json({
            message: 'Return request submitted successfully',
            recordId
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Return request error:', error);
        res.status(500).json({ error: 'Error submitting return request', details: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Handle request approval/rejection (Admin only)
// This route now handles both borrow and return request approvals/rejections
router.post('/request/:requestId', verifyToken, checkAdmin, async (req, res) => {
    let connection;
    try {
        const { requestId } = req.params;
        const { status: action } = req.body;
        const adminId = req.user.id; 

        console.log(`Handling request ID: ${requestId}, action: ${action} by admin ${adminId}`);

        if (!['approved', 'rejected'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action specified' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Fetch the request from book_records
        const [requests] = await connection.query(
            'SELECT * FROM book_records WHERE id = ? FOR UPDATE',
            [requestId]
        );
        
        if (requests.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Request not found' });
        }

        const request = requests[0];
        if (request.status !== 'pending') {
            await connection.rollback();
            return res.status(400).json({ error: `Request is not pending (current status: ${request.status})` });
        }

        const now = new Date(); // Define now once

        if (action === 'approved') {
            if (request.request_type === 'borrow') {
                const dueDate = new Date(now);
                dueDate.setDate(now.getDate() + 15); // 15 days as per user's request

                await connection.query(
                    'UPDATE book_records SET status = ?, issue_date = ?, return_due_date = ?, action = ?, approved_at = ? WHERE id = ?',
                    ['borrowed', now, dueDate, action, now, requestId]
                );
                await connection.query(
                    'UPDATE books SET available_copies = available_copies - 1 WHERE id = ?',
                    [request.book_id]
                );
            } else if (request.request_type === 'return') {
                // Set the return request status to 'returned' and add return_date
                await connection.query(
                    'UPDATE book_records SET status = ?, return_date = ?, action = ?, approved_at = ? WHERE id = ?',
                    ['returned', now, action, now, requestId]
                );

                // Find the original borrow record for this book and user
                const [originalBorrowRecords] = await connection.query(
                    `SELECT id FROM book_records
                     WHERE user_id = ? AND book_id = ? AND request_type = 'borrow'
                     AND status IN ('borrowed', 'approved')
                     ORDER BY issue_date DESC LIMIT 1`,
                    [request.user_id, request.book_id]
                );

                if (originalBorrowRecords.length > 0) {
                    // Update the status of the original borrow record to 'returned'
                    await connection.query(
                        'UPDATE book_records SET status = ?, return_date = ? WHERE id = ?',
                        ['returned', now, originalBorrowRecords[0].id]
                    );
                }

                // Increment available copies for the book
                await connection.query(
                    'UPDATE books SET available_copies = available_copies + 1 WHERE id = ?',
                    [request.book_id]
                );
            }
        } else if (action === 'rejected') {
            await connection.query(
                'UPDATE book_records SET status = ? WHERE id = ?',
                ['rejected', requestId]
            );
        }

        await connection.commit();
        res.status(200).json({ message: `Request ${requestId} ${action.toLowerCase()} successfully` }); // Keep this general for simplicity
    } catch (error) {
        console.error('Request handling error:', error);
        console.error('Error stack:', error.stack);
        await connection.rollback();
        res.status(500).json({ error: 'Error handling request', details: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Get borrowed books for the authenticated user
router.get('/borrowed', verifyToken, async (req, res) => {
    let connection;
    try {
        const userId = req.user.id;
        const { page = 0, limit = 12 } = req.query;

        connection = await pool.getConnection();

        // Count total borrowed books
        const [countResult] = await connection.query(
            'SELECT COUNT(*) AS total FROM book_records WHERE user_id = ? AND request_type = "borrow"',
            [userId]
        );
        const totalBorrowedBooks = countResult[0]?.total || 0;

        // Fetch borrowed books with pagination and join with books table for details
        const [borrowedBooks] = await connection.query(
            `SELECT br.*, b.title, b.authors, b.thumbnail FROM book_records br 
             JOIN books b ON br.book_id = b.id 
             WHERE br.user_id = ? AND br.request_type = 'borrow'
             AND br.status IN ('approved', 'borrowed', 'returned')
             ORDER BY br.issue_date DESC LIMIT ? OFFSET ?`,
            [userId, Number(limit), Number(page) * Number(limit)]
        );

        // Format and parse authors, always provide id for frontend
        const borrowedBooksWithExtras = borrowedBooks.map(book => ({
            ...book,
            id: book.book_id,
            authors: typeof book.authors === 'string' ? JSON.parse(book.authors) : book.authors
        }));

        res.json({
            borrowedBooks: borrowedBooksWithExtras,
            totalBorrowedBooks,
            currentPage: Number(page),
            totalPages: Math.ceil(totalBorrowedBooks / Number(limit))
        });
    } catch (error) {
        console.error('Error fetching borrowed books:', error);
        res.status(500).json({ error: 'Failed to fetch borrowed books.', details: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Get all books (Admin only)
router.get('/all', verifyToken, checkAdmin, async (req, res) => {
    try {
        const [books] = await pool.query('SELECT * FROM books');
        res.json(books);
    } catch (error) {
        console.error('Error fetching all books:', error);
        res.status(500).json({ error: 'Error fetching all books' });
    }
});

// Get all borrow/return records (Admin only)
router.get('/all-borrow-records', verifyToken, checkAdmin, async (req, res) => {
    try {
        const [records] = await pool.query(`
            SELECT br.*, u.name as user_name, b.title as book_title, b.authors,
                (SELECT issue_date FROM book_records WHERE book_id = br.book_id AND user_id = br.user_id AND request_type = 'borrow' AND status IN ('borrowed', 'returned', 'approved') ORDER BY issue_date DESC LIMIT 1) AS original_issue_date,
                (SELECT return_due_date FROM book_records WHERE book_id = br.book_id AND user_id = br.user_id AND request_type = 'borrow' AND status IN ('borrowed', 'returned', 'approved') ORDER BY issue_date DESC LIMIT 1) AS original_return_due_date,
                (SELECT approved_at FROM book_records WHERE book_id = br.book_id AND user_id = br.user_id AND request_type = 'borrow' AND status IN ('borrowed', 'returned', 'approved') ORDER BY issue_date DESC LIMIT 1) AS original_borrow_approved_at
            FROM book_records br
            JOIN users u ON br.user_id = u.id
            JOIN books b ON br.book_id = b.id
            ORDER BY br.created_at DESC
        `);
        res.json(records);
    } catch (error) {
        console.error('Error fetching all borrow records:', error);
        res.status(500).json({ error: 'Error fetching all borrow records' });
    }
});

// Get borrowed books for a specific user (Admin only)
router.get('/borrowed/:userId', verifyToken, checkAdmin, async (req, res) => {
    const userId = req.params.userId;
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query(
            `SELECT br.*, b.title AS book_title, b.authors,
                    (SELECT issue_date FROM book_records WHERE book_id = br.book_id AND user_id = br.user_id AND request_type = 'borrow' AND status IN ('borrowed', 'returned', 'approved') ORDER BY issue_date DESC LIMIT 1) AS original_issue_date,
                    (SELECT return_due_date FROM book_records WHERE book_id = br.book_id AND user_id = br.user_id AND request_type = 'borrow' AND status IN ('borrowed', 'returned', 'approved') ORDER BY issue_date DESC LIMIT 1) AS original_return_due_date,
                    (SELECT approved_at FROM book_records WHERE book_id = br.book_id AND user_id = br.user_id AND request_type = 'borrow' AND status IN ('borrowed', 'returned', 'approved') ORDER BY issue_date DESC LIMIT 1) AS original_borrow_approved_at
             FROM book_records br
             JOIN users u ON br.user_id = u.id
             JOIN books b ON br.book_id = b.id
             WHERE br.user_id = ?
             ORDER BY br.id DESC`,
            [userId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching borrowed books for user:', error);
        res.status(500).json({ error: 'Failed to fetch borrowed books for user.' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;