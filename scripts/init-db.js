const mysql = require('mysql2/promise');
require('dotenv').config();

async function initializeDatabase() {
    let connection;
    try {
        // Create connection without database first
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
        });

        console.log('Connected to MySQL server');

        // Create database if it doesn't exist
        await connection.query('CREATE DATABASE IF NOT EXISTS LibraryDB');
        console.log('Database created or already exists');

        // Use the database
        await connection.query('USE LibraryDB');

        // Create users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('user', 'admin') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Users table created or already exists');

        // Create books table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS books (
                id INT PRIMARY KEY AUTO_INCREMENT,
                google_books_id VARCHAR(255) NOT NULL UNIQUE,
                title VARCHAR(255) NOT NULL,
                authors JSON,
                publisher VARCHAR(255),
                published_date VARCHAR(50),
                description TEXT,
                thumbnail VARCHAR(255),
                total_copies INT NOT NULL DEFAULT 1,
                available_copies INT NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Books table created or already exists');

        // Create borrow_records table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS borrow_records (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                book_id INT NOT NULL,
                issue_date DATE NOT NULL,
                return_date DATE,
                status ENUM('pending', 'approved', 'rejected', 'returned') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (book_id) REFERENCES books(id)
            )
        `);
        console.log('Borrow records table created or already exists');

        // Insert default admin user if not exists
        const [existingAdmin] = await connection.query(
            'SELECT * FROM users WHERE email = ?',
            ['admin@library.com']
        );

        if (existingAdmin.length === 0) {
            await connection.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                ['Admin', 'admin@library.com', '$2a$10$X7UrH5YxX5YxX5YxX5YxX.5YxX5YxX5YxX5YxX5YxX5YxX5YxX5Yx', 'admin']
            );
            console.log('Default admin user created');
        }

        console.log('Database initialization completed successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the initialization
initializeDatabase()
    .then(() => {
        console.log('Database setup completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Database setup failed:', error);
        process.exit(1);
    });