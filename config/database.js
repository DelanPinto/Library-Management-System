const mysql = require('mysql2/promise');
require('dotenv').config();

// Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'yamabiko.proxy.rlwy.net',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 56484,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'CFTKWWUzXBsUzfYudxWyyqRIPYLRdXOd',
    database: process.env.DB_NAME || 'railway',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test DB connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connection successful');
        connection.release();
    } catch (error) {
        console.error('❌ Database connection error:', error);
        process.exit(1);
    }
};

module.exports = {
    pool,
    testConnection
};
