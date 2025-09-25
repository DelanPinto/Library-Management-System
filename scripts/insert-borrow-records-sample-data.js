const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'LibraryDB',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    const borrowRecords = [
        { book_id: 1, user_id: 1, status: 'approved', borrow_date: '2025-06-01', return_date: null },
        { book_id: 2, user_id: 2, status: 'approved', borrow_date: '2025-06-02', return_date: null },
        { book_id: 3, user_id: 3, status: 'approved', borrow_date: '2025-06-03', return_date: null }
    ];

    let connection;
    try {
        connection = await pool.getConnection();

        for (const record of borrowRecords) {
            await connection.query(
                `INSERT INTO borrow_records (book_id, user_id, status, borrow_date, return_date) VALUES (?, ?, ?, ?, ?)`,
                [record.book_id, record.user_id, record.status, record.borrow_date, record.return_date]
            );
        }

        console.log('Sample borrow records data inserted successfully');
    } catch (error) {
        console.error('Error inserting sample borrow records data:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
})();
