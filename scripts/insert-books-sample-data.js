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

        const books = [
            { google_books_id: '1aT7AAAAQBAJ', title: 'A Game of Thrones', authors: JSON.stringify(['George R.R. Martin']), total_copies: 5, available_copies: 5 },
            { google_books_id: 'DqLPAAAAMAAJ', title: 'The Hobbit', authors: JSON.stringify(['J.R.R. Tolkien']), total_copies: 3, available_copies: 3 }
        ];

        for (const book of books) {
            await connection.query(
                `INSERT INTO books (google_books_id, title, authors, total_copies, available_copies) VALUES (?, ?, ?, ?, ?)`,
                [book.google_books_id, book.title, book.authors, book.total_copies, book.available_copies]
            );
        }

        console.log('Sample books data inserted successfully');
    } catch (error) {
        console.error('Error inserting sample books data:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
})();
