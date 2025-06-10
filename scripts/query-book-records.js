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

        const [records] = await connection.query(
            `SELECT * FROM book_records`
        );

        console.log('All records in book_records table:', records);

    } catch (error) {
        console.error('Error querying book_records:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
})();
