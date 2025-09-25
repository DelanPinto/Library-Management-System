// ...existing code...

console.log('books2 loaded');
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../config/database');
const { verifyToken, checkAdmin } = require('../middleware/auth');
const NodeCache = require('node-cache');
const bookCache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

// Search endpoint for books (Google Books and OpenLibrary)
router.get('/search', async (req, res) => {
  const { q, page = 0, limit = 10, source = 'google' } = req.query;
  if (!q || q.trim() === '') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    if (source === 'google') {
      // Google Books API
      const startIndex = page * limit;
      try {
        const googleResponse = await axios.get('https://www.googleapis.com/books/v1/volumes', {
          params: {
            q,
            startIndex,
            maxResults: limit
          },
          timeout: 10000
        });

        // Base books from Google API
        let books = (googleResponse.data.items || []).map(item => {
          const volumeInfo = item.volumeInfo || {};
          const thumbnail = volumeInfo?.imageLinks?.thumbnail || volumeInfo?.imageLinks?.smallThumbnail || null;
          const isbn = volumeInfo?.industryIdentifiers ? volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_13' || id.type === 'ISBN_10')?.identifier : null;
          return {
            id: item.id,
            title: volumeInfo.title || 'Unknown Title',
            authors: volumeInfo.authors || ['Unknown Author'],
            publishedDate: volumeInfo.publishedDate || null,
            description: volumeInfo.description || null,
            thumbnail,
            categories: volumeInfo.categories || [],
            pageCount: volumeInfo.pageCount || null,
            language: volumeInfo.language || null,
            isbn,
            publisher: volumeInfo.publisher || null,
            source: 'googlebooks',
            // Provide a volumeInfo object for frontend compatibility
            volumeInfo: {
              title: volumeInfo.title || 'Unknown Title',
              authors: volumeInfo.authors || ['Unknown Author'],
              publishedDate: volumeInfo.publishedDate || null,
              description: volumeInfo.description || null,
              imageLinks: thumbnail ? { thumbnail, smallThumbnail: thumbnail } : undefined,
              categories: volumeInfo.categories || [],
              pageCount: volumeInfo.pageCount || null,
              language: volumeInfo.language || null,
              publisher: volumeInfo.publisher || null,
              industryIdentifiers: volumeInfo.industryIdentifiers || []
            },
            // Will be enriched from local DB below
            localDbId: null,
            total_copies: 0,
            available_copies: 0
          };
        });

        // Enrich with local library availability by matching google_books_id
        if (books.length > 0) {
          const googleIds = books.map(b => b.id);
          let connection;
          try {
            connection = await pool.getConnection();
            // Use IN (?) parameter with array expansion supported by mysql2
            const [rows] = await connection.query(
              'SELECT id, google_books_id, total_copies, available_copies FROM books WHERE google_books_id IN (?)',
              [googleIds]
            );
            const byGoogleId = new Map(rows.map(r => [r.google_books_id, r]));
            books = books.map(b => {
              const match = byGoogleId.get(b.id);
              if (match) {
                return {
                  ...b,
                  localDbId: match.id,
                  total_copies: match.total_copies,
                  available_copies: match.available_copies
                };
              }
              return b;
            });
          } catch (dbErr) {
            console.error('Error enriching search results with local availability:', dbErr);
          } finally {
            if (connection) connection.release();
          }
        }

        return res.json({ success: true, books, totalItems: googleResponse.data.totalItems || 0, source: 'googlebooks' });
      } catch (apiErr) {
        console.error('Google Books API error:', apiErr?.response?.data || apiErr?.message);
        // Fallback to local DB search
        let connection;
        try {
          connection = await pool.getConnection();
          const like = `%${q}%`;
          const [rows] = await connection.query(
            `SELECT id, google_books_id, title, authors, publisher, thumbnail, total_copies, available_copies
             FROM books
             WHERE title LIKE ? OR authors LIKE ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [like, like, limit]
          );

          const books = rows.map(row => {
            let authors = row.authors;
            if (typeof authors === 'string') {
              try { authors = JSON.parse(authors); } catch { authors = [authors]; }
            }
            const thumbnail = row.thumbnail || null;
            return {
              id: row.google_books_id,
              title: row.title,
              authors: Array.isArray(authors) ? authors : [authors],
              publishedDate: null,
              description: null,
              thumbnail,
              categories: [],
              pageCount: null,
              language: null,
              isbn: null,
              publisher: row.publisher || null,
              source: 'local',
              volumeInfo: {
                title: row.title,
                authors: Array.isArray(authors) ? authors : [authors],
                imageLinks: thumbnail ? { thumbnail, smallThumbnail: thumbnail } : undefined,
                publisher: row.publisher || null
              },
              localDbId: row.id,
              total_copies: row.total_copies,
              available_copies: row.available_copies
            };
          });

          return res.json({ success: true, books, totalItems: rows.length, source: 'local' });
        } catch (dbErr) {
          console.error('Local DB search fallback error:', dbErr);
          return res.status(500).json({ error: 'Failed to fetch books', details: apiErr.message });
        } finally {
          if (connection) connection.release();
        }
      }
    } else if (source === 'openlibrary') {
      // OpenLibrary API
      try {
        const openLibResponse = await axios.get('https://openlibrary.org/search.json', {
          params: {
            q,
            page: parseInt(page) + 1
          },
          timeout: 10000
        });
        const works = openLibResponse.data.docs || [];
        const books = works.map(work => ({
          id: work.key,
          title: work.title || 'Unknown Title',
          authors: work.author_name || ['Unknown Author'],
          publishedDate: work.first_publish_year || null,
          description: work.description || null,
          thumbnail: work.cover_i ? `https://covers.openlibrary.org/b/id/${work.cover_i}-M.jpg` : null,
          categories: work.subject || [],
          pageCount: work.number_of_pages_median || null,
          language: work.language || null,
          isbn: work.isbn ? work.isbn[0] : null,
          publisher: work.publisher ? work.publisher[0] : null,
          source: 'openlibrary'
        }));
        return res.json({ success: true, books, totalItems: openLibResponse.data.numFound || 0, source: 'openlibrary' });
      } catch (apiErr) {
        console.error('OpenLibrary API error:', apiErr?.response?.data || apiErr?.message);
        // Fallback to local DB search
        let connection;
        try {
          connection = await pool.getConnection();
          const like = `%${q}%`;
          const [rows] = await connection.query(
            `SELECT id, google_books_id, title, authors, publisher, thumbnail, total_copies, available_copies
             FROM books
             WHERE title LIKE ? OR authors LIKE ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [like, like, limit]
          );

          const books = rows.map(row => {
            let authors = row.authors;
            if (typeof authors === 'string') {
              try { authors = JSON.parse(authors); } catch { authors = [authors]; }
            }
            const thumbnail = row.thumbnail || null;
            return {
              id: row.google_books_id,
              title: row.title,
              authors: Array.isArray(authors) ? authors : [authors],
              publishedDate: null,
              description: null,
              thumbnail,
              categories: [],
              pageCount: null,
              language: null,
              isbn: null,
              publisher: row.publisher || null,
              source: 'local',
              volumeInfo: {
                title: row.title,
                authors: Array.isArray(authors) ? authors : [authors],
                imageLinks: thumbnail ? { thumbnail, smallThumbnail: thumbnail } : undefined,
                publisher: row.publisher || null
              },
              localDbId: row.id,
              total_copies: row.total_copies,
              available_copies: row.available_copies
            };
          });

          return res.json({ success: true, books, totalItems: rows.length, source: 'local' });
        } catch (dbErr) {
          console.error('Local DB search fallback error (openlibrary path):', dbErr);
          return res.status(500).json({ error: 'Failed to fetch books', details: apiErr.message });
        } finally {
          if (connection) connection.release();
        }
      }
    } else {
      return res.status(400).json({ error: 'Invalid source parameter' });
    }
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to fetch books', details: error.message });
  }
});

// Get currently borrowed books for the authenticated user
router.get('/borrowed', verifyToken, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const page = Number.parseInt(req.query.page, 10) || 0;
  const limit = Number.parseInt(req.query.limit, 10) || 9;
  const offset = page * limit;

  let connection;
  try {
    connection = await pool.getConnection();

    // Count total matching rows for pagination
    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM book_records br
       WHERE br.user_id = ?
         AND (
           (br.request_type = 'borrow' AND br.status IN ('approved', 'borrowed'))
           OR (br.request_type = 'return' AND br.status = 'pending')
         )`,
      [userId]
    );
    const totalItems = countRows?.[0]?.count || 0;

    // Fetch paginated rows with book details
    const [rows] = await connection.query(
      `SELECT 
         br.*,
         b.title,
         b.authors,
         b.thumbnail,
         b.google_books_id
       FROM book_records br
       JOIN books b ON br.book_id = b.id
       WHERE br.user_id = ?
         AND (
           (br.request_type = 'borrow' AND br.status IN ('approved', 'borrowed'))
           OR (br.request_type = 'return' AND br.status = 'pending')
         )
       ORDER BY br.request_date DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    // Normalize authors to array
    const books = rows.map(record => {
      const normalized = { ...record };
      if (typeof normalized.authors === 'string') {
        try {
          normalized.authors = JSON.parse(normalized.authors);
        } catch (_) {
          normalized.authors = [normalized.authors];
        }
      }
      return normalized;
    });

    return res.status(200).json({ books, totalItems, page, limit });
  } catch (error) {
    console.error('Error fetching borrowed books:', error);
    return res.status(500).json({ error: 'Error fetching borrowed books' });
  } finally {
    if (connection) connection.release();
  }
});

// Endpoint to fetch all borrow records
router.get('/all-borrow-records', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [records] = await connection.query(`
      SELECT 
        br.*, 
        b.title AS book_title, 
        b.authors, 
        u.name as user_name,
        br_orig.issue_date AS original_issue_date,
        br_orig.return_due_date AS original_return_due_date
      FROM book_records br
      JOIN books b ON br.book_id = b.id
      JOIN users u ON br.user_id = u.id
      LEFT JOIN book_records br_orig 
        ON br.request_type = 'return' AND br.original_record_id = br_orig.id
      ORDER BY br.request_date DESC
    `);
    res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.error('Error fetching all borrow records:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch borrow records' });
  } finally {
    if (connection) connection.release();
  }
});

// Endpoint to fetch all books
router.get('/all', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [books] = await connection.query('SELECT * FROM books');
    res.status(200).json({ success: true, data: books });
  } catch (error) {
    console.error('Error fetching all books:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch books' });
  } finally {
    if (connection) connection.release();
  }
});

// Add the new endpoint for getting user's borrowed books
router.get('/user/:userId/borrowed', verifyToken, checkAdmin, async (req, res) => {
  const { userId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();
    // Query to get all borrow records for a specific user
    const query = `
      SELECT 
        br.id,
        br.user_id,
        u.name as user_name,
        br.book_id,
        b.title as book_title,
        b.authors,
        br.request_type,
        br.request_date,
        br.issue_date,
        br.return_due_date,
        br.return_date AS actual_return_date,
        br.status,
        br.approved_at
      FROM book_records br
      JOIN users u ON br.user_id = u.id
      JOIN books b ON br.book_id = b.id
      WHERE br.user_id = ?
      ORDER BY br.request_date DESC
    `;

    const [records] = await connection.query(query, [userId]);

    // Process records to include proper status labels
    const processedRecords = records.map(record => {
      // Parse authors if it's stored as a JSON string
      if (typeof record.authors === 'string') {
        try {
          record.authors = JSON.parse(record.authors);
        } catch (e) {
          record.authors = [record.authors];
        }
      }
      return record;
    });

    res.status(200).json({
      success: true,
      data: processedRecords
    });

  } catch (error) {
    console.error('Error fetching user borrowed books:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user borrowed books',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Add other book routes here as needed
// Add a new book to the library (admin only)
router.post('/add', verifyToken, checkAdmin, async (req, res) => {
  const { title, authors, publisher, thumbnail, googleBookId, total_copies } = req.body;
  console.log('Add Book Request Body:', req.body);
  let authorsArr = authors;
  if (typeof authors === 'string') {
    authorsArr = authors.split(',').map(a => a.trim()).filter(a => a);
  }
  if (!title || !authorsArr || !Array.isArray(authorsArr) || authorsArr.length === 0 || typeof total_copies !== 'number') {
    return res.status(400).json({ error: 'Missing required fields: title, authors, total_copies' });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    // Calculate available copies: total_copies - books lent out
    const [lentRows] = await connection.query(
      'SELECT COUNT(*) AS lent_count FROM book_records WHERE book_id = (SELECT id FROM books WHERE google_books_id = ?) AND status IN ("approved", "borrowed")',
      [googleBookId]
    );
    const lentCount = lentRows[0]?.lent_count || 0;
  const available_copies = total_copies - lentCount;
    await connection.query(
      'INSERT INTO books (title, authors, publisher, thumbnail, google_books_id, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?, ?)',
  [title, JSON.stringify(authors), publisher || null, thumbnail || null, googleBookId || null, total_copies, available_copies]
    );
    return res.status(201).json({ success: true, message: 'Book added successfully' });
  } catch (error) {
    console.error('Error adding book:', error);
    return res.status(500).json({ error: 'Failed to add book' });
  } finally {
    if (connection) connection.release();
  }
});
// Update total and available copies for a book (admin only)
router.put('/update-copies/:id', verifyToken, checkAdmin, async (req, res) => {
  const bookId = req.params.id;
  const { total_copies, available_copies } = req.body;
  if (typeof total_copies !== 'number' || typeof available_copies !== 'number') {
    return res.status(400).json({ error: 'total_copies and available_copies must be numbers' });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    // Check if book exists
    const [rows] = await connection.query('SELECT id FROM books WHERE id = ?', [bookId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    // Update book copies
    await connection.query(
      'UPDATE books SET total_copies = ?, available_copies = ? WHERE id = ?',
  [total_copies, available_copies, bookId]
    );
    return res.status(200).json({ message: 'Book copies updated successfully' });
  } catch (error) {
    console.error('Error updating book copies:', error);
    return res.status(500).json({ error: 'Failed to update book copies' });
  } finally {
    if (connection) connection.release();
  }
});

// Create a borrow request for a book
router.post('/borrow/:bookId', verifyToken, async (req, res) => {
  const userId = req.user?.id;
  const bookParam = req.params.bookId;
  let connection;
  try {
    connection = await pool.getConnection();

    // Resolve book ID: numeric local ID or a Google Books ID
    let bookId = Number.isNaN(Number.parseInt(bookParam, 10)) ? null : Number.parseInt(bookParam, 10);
    if (!bookId) {
      const [byGoogle] = await connection.query(
        'SELECT id FROM books WHERE google_books_id = ? LIMIT 1',
        [bookParam]
      );
      if (!byGoogle || byGoogle.length === 0) {
        return res.status(404).json({ error: 'Book not found in library' });
      }
      bookId = byGoogle[0].id;
    }

    // Ensure book exists and has available copies > 0
    const [bookRows] = await connection.query(
      'SELECT id, available_copies FROM books WHERE id = ? LIMIT 1',
      [bookId]
    );
    if (!bookRows || bookRows.length === 0) {
      return res.status(404).json({ error: 'Book not found in library' });
    }
    if ((bookRows[0].available_copies || 0) <= 0) {
      return res.status(400).json({ error: 'No copies available to borrow' });
    }

    // Enforce per-user borrow limit (max 3 active/pending borrows)
    const activeCountQuery = `SELECT COUNT(*) AS cnt FROM book_records WHERE user_id = ? AND request_type = 'borrow' AND status IN ('pending', 'approved')`;
    const [activeCountRows] = await connection.query(activeCountQuery, [userId]);
    if ((activeCountRows?.[0]?.cnt || 0) >= 3) {
      return res.status(400).json({ error: 'Borrow limit reached. You can have at most 3 active borrows or pending requests.' });
    }

    // Prevent duplicate pending/active borrow requests
    const dupeQuery = `SELECT COUNT(*) AS cnt FROM book_records WHERE user_id = ? AND book_id = ? AND request_type = 'borrow' AND status IN ('pending', 'approved')`;
    const [dupeRows] = await connection.query(dupeQuery, [userId, bookId]);
    if ((dupeRows?.[0]?.cnt || 0) > 0) {
      return res.status(400).json({ error: 'You already have a pending or active request for this book' });
    }

    // Create borrow request (admin will approve and decrement copies)
    const insertBorrowQuery = `INSERT INTO book_records (user_id, book_id, request_type, status, request_date) VALUES (?, ?, 'borrow', 'pending', NOW())`;
    await connection.query(insertBorrowQuery, [userId, bookId]);

    return res.status(200).json({ message: 'Borrow request submitted for approval' });
  } catch (error) {
    console.error('Error submitting borrow request:', error);
    return res.status(500).json({ error: 'Failed to submit borrow request' });
  } finally {
    if (connection) connection.release();
  }
});

// Create a return request for a borrowed book
router.post('/return/:bookId', verifyToken, async (req, res) => {
  const userId = req.user?.id;
  const bookParam = req.params.bookId;
  let connection;
  try {
    connection = await pool.getConnection();

    // Resolve book ID: numeric local ID or a Google Books ID
    let bookId = Number.isNaN(Number.parseInt(bookParam, 10)) ? null : Number.parseInt(bookParam, 10);
    if (!bookId) {
      const [byGoogle] = await connection.query(
        'SELECT id FROM books WHERE google_books_id = ? LIMIT 1',
        [bookParam]
      );
      if (!byGoogle || byGoogle.length === 0) {
        return res.status(404).json({ error: 'Book not found in library' });
      }
      bookId = byGoogle[0].id;
    }

    // Find the most recent active borrow record for this user/book
    const approvedQuery = `SELECT id FROM book_records WHERE user_id = ? AND book_id = ? AND request_type = 'borrow' AND status IN ('approved')`;
    const [activeBorrows] = await connection.query(approvedQuery, [userId, bookId]);
    if (!activeBorrows || activeBorrows.length === 0) {
      return res.status(400).json({ error: 'No active borrow found to return' });
    }
    const originalRecordId = activeBorrows[0].id;

    // Prevent duplicate pending return request for the same borrow
    const [dupeReturns] = await connection.query(
      `SELECT COUNT(*) AS cnt
       FROM book_records
       WHERE original_record_id = ? AND request_type = 'return' AND status = 'pending'`,
      [originalRecordId]
    );
    if ((dupeReturns?.[0]?.cnt || 0) > 0) {
      return res.status(400).json({ error: 'A return request is already pending for this borrow' });
    }

    // Create return request
    await connection.query(
      `INSERT INTO book_records (user_id, book_id, request_type, status, request_date, original_record_id)
       VALUES (?, ?, 'return', 'pending', NOW(), ?)`,
      [userId, bookId, originalRecordId]
    );

    return res.status(200).json({ message: 'Return request submitted for approval' });
  } catch (error) {
    console.error('Error submitting return request:', error);
    return res.status(500).json({ error: 'Failed to submit return request' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
