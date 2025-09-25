const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { verifyToken, checkAdmin } = require('../middleware/auth');

// Endpoint to fetch all users
router.get('/all', verifyToken, checkAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Fetching all users...');
        
        const [users] = await connection.query('SELECT id, name, email, role FROM users ORDER BY role = "admin" DESC, name ASC');
        console.log(`Found ${users.length} users`);
        
        res.status(200).json({
            success: true,
            data: users.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }))
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;