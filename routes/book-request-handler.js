const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { verifyToken, checkAdmin } = require('../middleware/auth');

// Handle request approval/rejection (Admin only)
router.post('/request/:requestId', verifyToken, checkAdmin, async (req, res) => {
    let connection;
    const { requestId } = req.params;
    const { action } = req.body;
    const adminId = req.user.id;

    if (!['approved', 'rejected'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action specified' });
    }

    try {
        // Get database connection
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Fetch the request details
        const [requests] = await connection.query(
            'SELECT * FROM book_records WHERE id = ?',
            [requestId]
        );

        if (requests.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Request not found' });
        }

        const request = requests[0];

        // Check if request is already processed
        if (request.status !== 'pending') {
            await connection.rollback();
            return res.status(400).json({ error: `Request already ${request.status}` });
        }

        const currentDate = new Date();

        // Handle based on request type and action
        if (action === 'approved') {
            if (request.request_type === 'borrow') {
                // Handle borrow approval
                const dueDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 14-day loan period
                await connection.query(
                    'UPDATE book_records SET status = ?, approved_at = ?, issue_date = ?, return_due_date = ? WHERE id = ?',
                    ['approved', currentDate, currentDate, dueDate, requestId]
                );

                // Decrement available copies
                await connection.query(
                    'UPDATE books SET available_copies = available_copies - 1 WHERE id = ?',
                    [request.book_id]
                );
            } else if (request.request_type === 'return') {
                // Handle return approval
                // 1. Update return request status
                await connection.query(
                    'UPDATE book_records SET status = ?, approved_at = ?, return_date = ? WHERE id = ?',
                    ['approved', currentDate, currentDate, requestId]
                );

                // 2. Update original borrow record
                await connection.query(
                    'UPDATE book_records SET status = ?, return_date = ? WHERE id = ?',
                    ['returned', currentDate, request.original_record_id]
                );

                // 3. Reject any other pending return requests
                await connection.query(
                    'UPDATE book_records SET status = ? WHERE original_record_id = ? AND request_type = ? AND status = ? AND id != ?',
                    ['rejected', request.original_record_id, 'return', 'pending', requestId]
                );

                // 4. Increment available copies
                await connection.query(
                    'UPDATE books SET available_copies = available_copies + 1 WHERE id = ?',
                    [request.book_id]
                );

                // 5. Verify the update
                const [afterCopies] = await connection.query(
                    'SELECT available_copies FROM books WHERE id = ?',
                    [request.book_id]
                );
                console.log(`Book ${request.book_id} now has ${afterCopies[0].available_copies} copies after return`);
            }
        } else {
            // Handle rejection
            await connection.query(
                'UPDATE book_records SET status = ?, approved_at = ? WHERE id = ?',
                ['rejected', currentDate, requestId]
            );
        }

        await connection.commit();
        res.status(200).json({ 
            message: `Request ${action} successfully`,
            requestType: request.request_type
        });

    } catch (error) {
        console.error('Request processing error:', error);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
        }
        res.status(500).json({ 
            error: 'Failed to process request',
            details: error.message
        });
    } finally {
        if (connection) {
            try {
                connection.release();
            } catch (releaseError) {
                console.error('Error releasing connection:', releaseError);
            }
        }
    }
});

module.exports = router;
