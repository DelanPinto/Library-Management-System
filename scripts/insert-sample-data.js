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

        const userId = 1; // Replace with the actual user ID
        const bookId = 1; // Replace with the actual book ID

        await connection.query(
            `INSERT INTO book_records (user_id, book_id, action_type, request_id, status, request_date, issue_date, return_due_date) 
             VALUES (?, ?, 'borrow', 1, 'approved', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY))`,
            [userId, bookId]
        );

        console.log('Sample data inserted into book_records');

    } catch (error) {
        console.error('Error inserting sample data:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
})();
