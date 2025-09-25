const mysql = require('mysql2/promise');
require('dotenv').config();

const newAdminEmail = 'admin@library.com';
const newAdminPassword = 'admin123';
const newAdminName = 'Admin';

async function createNewAdmin() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'LibraryDB'
        });

        console.log('Connected to the database.');

        // Delete existing admin user if exists
        await connection.query(
            'DELETE FROM users WHERE email = ?',
            [newAdminEmail]
        );
        console.log('Deleted existing admin user if any.');

        // Insert new admin user
        const [result] = await connection.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [newAdminName, newAdminEmail, newAdminPassword, 'admin']
        );

        console.log(`New admin user created with ID: ${result.insertId}`);
        console.log(`Email: ${newAdminEmail}`);
        console.log(`Password: ${newAdminPassword}`);

    } catch (error) {
        console.error('Error creating new admin user:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

createNewAdmin();