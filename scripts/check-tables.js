const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'LibraryDB'
        });

        console.log('Connected to MySQL server');

        const [tables] = await connection.query('SHOW TABLES');
        console.log('Available tables:', tables.map(table => Object.values(table)[0]));

    } catch (error) {
        console.error('Error checking tables:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
})();
