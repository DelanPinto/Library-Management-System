const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { verifyToken, checkAdmin } = require('../middleware/auth');

// Endpoint to fetch all users
router.get('/all', verifyToken, checkAdmin, async (req, res) => {
    try {
        const query = 'SELECT id, name, email, role FROM users';
        const [rows] = await pool.query(query);
        res.status(200).json({
            success: true,
            data: { users: rows }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users'
        });
    }
});

module.exports = router;