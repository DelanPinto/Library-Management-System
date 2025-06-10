const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '@DelanPinto0407',
    database: process.env.DB_NAME || 'LibraryDB',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Create a direct connection (non-pool) for specific use cases
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '@DelanPinto0407', // <-- update this
  database: 'LibraryDB' // <-- update this
});

// Test database connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Database connection successful');
        connection.release();
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

module.exports = {
    pool,
    testConnection
};