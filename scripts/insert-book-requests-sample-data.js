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

        const bookRequests = [
            { user_id: 1, book_id: 1, request_type: 'borrow', status: 'approved', request_date: new Date() },
            { user_id: 1, book_id: 2, request_type: 'borrow', status: 'approved', request_date: new Date() }
        ];

        for (const request of bookRequests) {
            await connection.query(
                `INSERT INTO book_requests (user_id, book_id, request_type, status, request_date) VALUES (?, ?, ?, ?, ?)`,
                [request.user_id, request.book_id, request.request_type, request.status, request.request_date]
            );
        }

        console.log('Sample book requests data inserted successfully');
    } catch (error) {
        console.error('Error inserting sample book requests data:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
})();
