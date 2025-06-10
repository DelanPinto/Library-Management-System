const mysql = require('mysql2/promise');
const config = require('../config/database');

(async () => {
    try {
        const connection = await mysql.createConnection({
            host: config.pool.config.connectionConfig.host,
            user: config.pool.config.connectionConfig.user,
            password: config.pool.config.connectionConfig.password,
            database: config.pool.config.connectionConfig.database
        });

        console.log('Inserting sample data into book_records table...');

        const query = `INSERT INTO book_records (user_id, book_id, request_type, action_type, status, issue_date, return_date)
                       VALUES (?, ?, 'borrow', 'approved', ?, ?, ?)`;

        const values = [2, 3, 'approved', '2023-10-01', '2023-10-15'];

        const [result] = await connection.execute(query, values);

        console.log('Sample data inserted successfully:', result);

        await connection.end();
    } catch (error) {
        console.error('Error inserting sample data:', error);
    }
})();
