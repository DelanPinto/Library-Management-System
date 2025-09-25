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

        const query = `INSERT INTO book_records (user_id, book_id, action_type, status, request_date, return_due_date)
                       VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY))`;

        const values = [2, 3, 'borrow', 'approved'];

        const [result] = await connection.execute(query, values);

        console.log('Sample data inserted successfully:', result);

        await connection.end();
    } catch (error) {
        console.error('Error inserting sample data:', error);
    }
})();
