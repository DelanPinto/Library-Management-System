const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Verify JWT token
const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            console.error('No token provided');
            return res.status(401).json({ error: 'No token provided' });
        }

        console.log('Received Token:', token); // Debugging log

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded Token:', decoded); // Debugging log

        req.user = decoded;
        console.log('req.user set to:', req.user); // Debugging log

        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Check if user is admin
const checkAdmin = async (req, res, next) => {
    try {
        const [users] = await pool.query(
            'SELECT role FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0 || users[0].role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Error checking admin role' });
    }
};

module.exports = {
    verifyToken,
    checkAdmin
};