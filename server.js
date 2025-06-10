const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Configuration
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';

// Database configuration with Railway environment variables
const dbConfig = {
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'library_db',
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

let db;
let server;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (critical for Railway)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    env: NODE_ENV,
    port: PORT
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database connection function with retry logic
async function connectToDatabase() {
  const maxRetries = 5;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      console.log(`🔄 Attempting database connection (attempt ${retries + 1}/${maxRetries})...`);
      
      db = await mysql.createConnection(dbConfig);
      
      // Test the connection
      await db.execute('SELECT 1');
      
      console.log('✅ Database connected successfully');
      
      // Create tables if they don't exist
      await initializeDatabase();
      
      return true;
    } catch (error) {
      console.error(`❌ Database connection failed (attempt ${retries + 1}):`, error.message);
      retries++;
      
      if (retries < maxRetries) {
        console.log(`⏳ Retrying in 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  
  console.error('❌ Failed to connect to database after all retries');
  return false;
}

// Initialize database tables
async function initializeDatabase() {
  try {
    // Create books table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS books (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        isbn VARCHAR(20) UNIQUE,
        category VARCHAR(100),
        copies INT DEFAULT 1,
        available INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create members table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        membership_date DATE DEFAULT (CURRENT_DATE),
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create transactions table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT NOT NULL,
        member_id INT NOT NULL,
        type ENUM('issue', 'return') NOT NULL,
        issue_date DATE,
        due_date DATE,
        return_date DATE,
        fine DECIMAL(10,2) DEFAULT 0,
        status ENUM('issued', 'returned', 'overdue') DEFAULT 'issued',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  }
}

// API Routes

// Books endpoints
app.get('/api/books', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const [rows] = await db.execute('SELECT * FROM books ORDER BY title');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

app.post('/api/books', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const { title, author, isbn, category, copies } = req.body;
    
    if (!title || !author) {
      return res.status(400).json({ error: 'Title and author are required' });
    }
    
    const [result] = await db.execute(
      'INSERT INTO books (title, author, isbn, category, copies, available) VALUES (?, ?, ?, ?, ?, ?)',
      [title, author, isbn || null, category || null, copies || 1, copies || 1]
    );
    
    res.status(201).json({ 
      id: result.insertId,
      message: 'Book added successfully' 
    });
  } catch (error) {
    console.error('Error adding book:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Book with this ISBN already exists' });
    } else {
      res.status(500).json({ error: 'Failed to add book' });
    }
  }
});

// Members endpoints
app.get('/api/members', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const [rows] = await db.execute('SELECT * FROM members ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

app.post('/api/members', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const { name, email, phone, address } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const [result] = await db.execute(
      'INSERT INTO members (name, email, phone, address) VALUES (?, ?, ?, ?)',
      [name, email, phone || null, address || null]
    );
    
    res.status(201).json({ 
      id: result.insertId,
      message: 'Member added successfully' 
    });
  } catch (error) {
    console.error('Error adding member:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Member with this email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
});

// Authentication endpoints
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }
    
    // Simple authentication - you can replace this with your actual logic
    // For demo purposes, using hardcoded credentials
    const validCredentials = [
      { username: 'admin', password: 'admin123', role: 'admin' },
      { username: 'librarian', password: 'lib123', role: 'librarian' },
      { username: 'user', password: 'user123', role: 'user' }
    ];
    
    const user = validCredentials.find(
      cred => cred.username === username && cred.password === password
    );
    
    if (user) {
      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: Date.now(), // Simple ID generation
          username: user.username,
          role: user.role
        },
        token: `token_${Date.now()}` // Simple token generation
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed due to server error'
    });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email, role } = req.body;
    
    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, and email are required'
      });
    }
    
    // For demo purposes, just return success
    // In a real app, you'd save to a users table
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: Date.now(),
        username,
        email,
        role: role || 'user'
      }
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed due to server error'
    });
  }
});

app.post('/api/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Transaction endpoints
app.get('/api/transactions', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const [rows] = await db.execute(`
      SELECT t.*, b.title as book_title, b.author as book_author, 
             m.name as member_name, m.email as member_email
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      JOIN members m ON t.member_id = m.id
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/transactions/issue', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const { book_id, member_id, due_date } = req.body;
    
    if (!book_id || !member_id) {
      return res.status(400).json({ error: 'Book ID and Member ID are required' });
    }
    
    // Check if book is available
    const [bookCheck] = await db.execute(
      'SELECT available FROM books WHERE id = ?',
      [book_id]
    );
    
    if (bookCheck.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    if (bookCheck[0].available <= 0) {
      return res.status(400).json({ error: 'Book not available' });
    }
    
    // Start transaction
    await db.beginTransaction();
    
    try {
      // Issue the book
      const issueDate = new Date().toISOString().split('T')[0];
      const dueDateFormatted = due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const [result] = await db.execute(
        'INSERT INTO transactions (book_id, member_id, type, issue_date, due_date, status) VALUES (?, ?, ?, ?, ?, ?)',
        [book_id, member_id, 'issue', issueDate, dueDateFormatted, 'issued']
      );
      
      // Update book availability
      await db.execute(
        'UPDATE books SET available = available - 1 WHERE id = ?',
        [book_id]
      );
      
      await db.commit();
      
      res.status(201).json({ 
        id: result.insertId,
        message: 'Book issued successfully' 
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error issuing book:', error);
    res.status(500).json({ error: 'Failed to issue book' });
  }
});

app.post('/api/transactions/return', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const { transaction_id, fine } = req.body;
    
    if (!transaction_id) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }
    
    // Start transaction
    await db.beginTransaction();
    
    try {
      // Update transaction
      const returnDate = new Date().toISOString().split('T')[0];
      const [updateResult] = await db.execute(
        'UPDATE transactions SET return_date = ?, status = ?, fine = ? WHERE id = ? AND status = ?',
        [returnDate, 'returned', fine || 0, transaction_id, 'issued']
      );
      
      if (updateResult.affectedRows === 0) {
        await db.rollback();
        return res.status(404).json({ error: 'Transaction not found or already returned' });
      }
      
      // Get book_id to update availability
      const [transactionCheck] = await db.execute(
        'SELECT book_id FROM transactions WHERE id = ?',
        [transaction_id]
      );
      
      if (transactionCheck.length > 0) {
        // Update book availability
        await db.execute(
          'UPDATE books SET available = available + 1 WHERE id = ?',
          [transactionCheck[0].book_id]
        );
      }
      
      await db.commit();
      
      res.json({ 
        message: 'Book returned successfully',
        fine: fine || 0
      });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error returning book:', error);
    res.status(500).json({ error: 'Failed to return book' });
  }
});

// Additional helpful endpoints
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const [totalBooks] = await db.execute('SELECT COUNT(*) as count FROM books');
    const [totalMembers] = await db.execute('SELECT COUNT(*) as count FROM members WHERE status = "active"');
    const [issuedBooks] = await db.execute('SELECT COUNT(*) as count FROM transactions WHERE status = "issued"');
    const [overdueBooks] = await db.execute('SELECT COUNT(*) as count FROM transactions WHERE status = "issued" AND due_date < CURDATE()');
    
    res.json({
      totalBooks: totalBooks[0].count,
      totalMembers: totalMembers[0].count,
      issuedBooks: issuedBooks[0].count,
      overdueBooks: overdueBooks[0].count
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

app.get('/api/books/search', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const [rows] = await db.execute(
      'SELECT * FROM books WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ? ORDER BY title',
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error searching books:', error);
    res.status(500).json({ error: 'Failed to search books' });
  }
});

app.get('/api/members/search', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const [rows] = await db.execute(
      'SELECT * FROM members WHERE name LIKE ? OR email LIKE ? ORDER BY name',
      [`%${q}%`, `%${q}%`]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error searching members:', error);
    res.status(500).json({ error: 'Failed to search members' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    server.close(async () => {
      console.log('✅ HTTP server closed');
      
      if (db) {
        try {
          await db.end();
          console.log('✅ Database connection closed');
        } catch (error) {
          console.error('❌ Error closing database:', error);
        }
      }
      
      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
async function startServer() {
  console.log('🚂 Railway Deployment Starting...');
  console.log(`PORT: ${PORT}`);
  console.log(`HOST: ${HOST}`);
  console.log(`NODE_ENV: ${NODE_ENV}`);
  
  try {
    // Connect to database first
    const dbConnected = await connectToDatabase();
    
    if (!dbConnected) {
      console.log('⚠️  Starting server without database connection');
    }
    
    // Start HTTP server
    server = app.listen(PORT, HOST, () => {
      console.log('✅ Server setup complete - Railway ready');
      console.log(`✅ Server running on ${HOST}:${PORT}`);
      console.log(`✅ Environment: ${NODE_ENV}`);
      console.log('✅ Health check available at: /health');
      console.log('✅ Ready to accept connections');
    });
    
    // Keep the process alive
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();
