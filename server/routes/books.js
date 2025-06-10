const { authenticate } = require('../../routes/auth');

router.get('/api/books/borrowed', authenticate, async (req, res) => {
    try {
        const userId = req.user?.id; // Ensure userId is properly set
        console.log('Decoded user ID:', userId); // Debugging log

        if (!userId) {
            console.error('User ID is missing');
            return res.status(400).json({ error: 'User ID is missing' });
        }

        console.log('User ID:', userId); // Debugging log

        const [borrowedBooks] = await pool.query(
            'SELECT br.*, b.title, b.authors FROM book_records br JOIN books b ON br.book_id = b.id WHERE br.user_id = ? AND br.action_type = ? AND br.status = ?', 
            [userId, 'borrow', 'approved']
        );

        console.log('Query executed successfully');
        console.log('Raw Query Result:', borrowedBooks); // Debugging log

        if (borrowedBooks.length === 0) {
            console.log('No borrowed books found');
            return res.status(200).json({ message: 'No borrowed books found', books: [] });
        }

        console.log('Borrowed books found:', borrowedBooks);
        res.json({ books: borrowedBooks });
    } catch (error) {
        console.error('Error fetching borrowed books:', error);
        res.status(500).json({ error: 'Error fetching borrowed books' });
    }
});

router.get('/api/books/records', async (req, res) => {
    try {
        const userId = req.user?.id; // Ensure userId is properly set
        if (!userId) {
            console.error('User ID is missing');
            return res.status(400).json({ error: 'User ID is missing' });
        }

        console.log('User ID:', userId); // Debugging log

        const [bookRecords] = await pool.query(
            'SELECT br.*, b.title, b.authors FROM book_records br JOIN books b ON br.book_id = b.id WHERE br.action_type = ? AND br.status IN (?, ?)', 
            ['borrow', 'approved', 'returned']
        );

        console.log('Raw Query Result:', bookRecords);

        if (bookRecords.length === 0) {
            return res.status(200).json({ message: 'No book records found', records: [] });
        }

        res.json({ records: bookRecords });
    } catch (error) {
        console.error('Error fetching book records:', error);
        res.status(500).json({ error: 'Error fetching book records' });
    }
});

function switchTab(tabId) {
    const tabContent = document.getElementById(tabId);
    if (!tabContent) {
        console.error(`Tab content with ID "${tabId}" not found.`);
        return;
    }
    tabContent.style.display = 'block'; // Example logic
}