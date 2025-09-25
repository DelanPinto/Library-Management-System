const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
    let connection;
    try {
        // Create connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'LibraryDB',
            multipleStatements: true // Enable running multiple SQL statements
        });

        console.log('Connected to database');

        // Read and execute migration file
        const sqlPath = path.join(__dirname, '..', 'migrations', 'optimize_book_storage.sql');
        const sql = await fs.readFile(sqlPath, 'utf8');
        
        console.log('Executing migration...');
        await connection.query(sql);
        console.log('Migration completed successfully');

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the migration
runMigration()
    .then(() => {
        console.log('Migration script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });
