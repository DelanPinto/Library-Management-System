const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
    let connection;
    try {
        // Create connection without database
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        console.log('Connected to MySQL server');

        // Create database if it doesn't exist
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'LibraryDB'}`);
        console.log(`Database ${process.env.DB_NAME || 'LibraryDB'} created or already exists`);

        // Use the database
        await connection.query(`USE ${process.env.DB_NAME || 'LibraryDB'}`);

        // Read and execute SQL file
        const sqlFile = await fs.readFile(path.join(__dirname, 'database.sql'), 'utf8');
        const statements = sqlFile.split(';').filter(stmt => stmt.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                await connection.query(statement);
            }
        }

        console.log('Database tables created successfully');

        // Create an admin user if it doesn't exist
        const [users] = await connection.query('SELECT * FROM users WHERE role = "admin" LIMIT 1');
        if (users.length === 0) {
            const hashedPassword = 'admin123';

            await connection.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                ['Admin', 'admin@library.com', hashedPassword, 'admin']
            );
            console.log('Admin user created successfully');
            console.log('Email: admin@library.com');
            console.log('Password: admin123');
        }

    } catch (error) {
        console.error('Error setting up database:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

setupDatabase();