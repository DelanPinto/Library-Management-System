// Add helper functions at the top of the file
function getBookImageUrl(thumbnail) {
    return thumbnail || '/no-cover.png';
}

function getRecordStatusText(status, record) {
    // Use statusLabel from backend if present
    if (record && record.statusLabel) {
        // Custom user-friendly text for pending borrow/return
        if (record.status === 'pending') {
            if (record.action_type === 'borrow') return 'Borrow request sent';
            if (record.action_type === 'return') return 'Return request sent';
        }
        return record.statusLabel;
    }
    switch(status) {
        case 'pending':
            if (record && record.action_type === 'borrow') return 'Borrow request sent';
            if (record && record.action_type === 'return') return 'Return request sent';
            return 'Request Pending';
        case 'approved': return 'Borrowed';
        case 'rejected': return 'Request Rejected';
        case 'returned': return 'Returned';
        default: return 'Unknown';
    }
}

function getBorrowActionButton(record) {
    if (record.status === 'approved') {
        return `<button class="btn" onclick="returnBook('${record.id}')">Return Book</button>`;
    } else if (record.status === 'pending') {
        return `<span class="btn disabled">Request Pending</span>`;
    } else if (record.status === 'rejected') {
        return `<button class="btn" onclick="borrowBook('${record.book_id}')">Request Again</button>`;
    } else {
        return '';
    }
}

// Global variables for page state
let currentTab = 'search';
let currentSearchPage = 0;
let currentLibraryPage = 0;
let currentBorrowedPage = 0;
const itemsPerPage = 12;

// Setup pagination controls
function setupPagination(containerId, currentPage, totalItems, onPageChange) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Show only 3 pages at a time
    let startPage = Math.max(0, currentPage - 1);
    let endPage = Math.min(totalPages - 1, startPage + 2);
    
    if (endPage - startPage < 2) {
        startPage = Math.max(0, endPage - 2);
    }

    if (currentPage > 0) {
        container.innerHTML += `<button class="page-btn" onclick="${onPageChange}(${currentPage - 1})">←</button>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        container.innerHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i + 1}</button>`;
    }

    if (currentPage < totalPages - 1) {
        container.innerHTML += `<button class="page-btn" onclick="${onPageChange}(${currentPage + 1})">→</button>`;
    }
}

// Search functionality
async function performSearch(page = 0) {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        alert('⚠️ Please enter a search term');
        return;
    }
    currentSearchPage = page;
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('searchResults').innerHTML = '';
    
    try {
        const response = await apiRequest(`/api/books/search?q=${encodeURIComponent(query)}&page=${page}&limit=${itemsPerPage}`);
        const data = response.data;
        document.getElementById('loadingSpinner').style.display = 'none';
        
        if (data.books && data.books.length > 0) {
            displaySearchResults(data.books);
            setupPagination('searchPagination', page, data.totalItems, 'performSearch');
        } else {
            document.getElementById('searchResults').innerHTML = '<div class="no-results">📭 No books found. Try different keywords!</div>';
        }
    } catch (error) {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('searchResults').innerHTML = '<div class="no-results">🚫 Error searching books. Please try again later.</div>';
    }
}

// Display search results
function displaySearchResults(books) {
    // Only show available books
    const availableBooks = books.filter(book => book.isAvailable);
    const container = document.getElementById('searchResults');
    if (availableBooks.length === 0) {
        container.innerHTML = '<div class="no-results">📭 No books found. Try different keywords!</div>';
        return;
    }
    container.innerHTML = availableBooks.map(book => {
        const isAvailable = book.isAvailable;
        const statusText = isAvailable ? 'Available' : 'Unavailable';
        const statusClass = isAvailable ? 'status-available' : 'status-borrowed';
        const buttonText = isAvailable ? 'Request to Borrow' : 'Not Available';
        const buttonDisabled = !isAvailable ? 'disabled' : '';
        const buttonAction = isAvailable ? `borrowBook('${book.id}')` : '';

        return `
            <div class="book-card">
                <img src="${getBookImageUrl(book.thumbnail)}" alt="${book.title}" class="book-image">
                <div class="book-info">
                    <h3 class="book-title">${book.title}</h3>
                    <p class="book-author">${Array.isArray(book.authors) ? book.authors.join(', ') : book.authors}</p>
                    <span class="book-status ${statusClass}">${statusText}</span>
                    <button class="btn" onclick="${buttonAction}" ${buttonDisabled}>${buttonText}</button>
                </div>
            </div>
        `;
    }).join('');
}

// Borrow functionality
async function borrowBook(bookId) {
    if (!confirm('Would you like to request to borrow this book? An administrator will need to approve your request.')) return;

    try {
        await apiRequest(`/api/books/borrow/${bookId}`, 'POST');
        alert('Borrow request submitted successfully! An administrator will review your request.');
        performSearch(currentSearchPage); // Refresh the current page
    } catch (error) {
        console.error('Borrow book error:', error);
        if (error.message.includes('pending or active request')) {
            alert('You already have a pending or active request for this book. Please wait for the administrator to process your request.');
        } else {
            alert(error.message || 'Error submitting borrow request');
        }
    }
}

// Display library books
async function displayLibraryBooks(page = 0) {
    currentLibraryPage = page;
    try {
        const response = await apiRequest(`/api/books/library?page=${page}&limit=${itemsPerPage}`);
        const data = response.data;
        const container = document.getElementById('libraryBooks');
        
        if (data.books && data.books.length > 0) {
            container.innerHTML = data.books.map(book => `
                <div class="book-card">
                    <img src="${getBookImageUrl(book.thumbnail)}" alt="${book.title}" class="book-image">
                    <div class="book-info">
                        <h3 class="book-title">${book.title}</h3>
                        <p class="book-author">${Array.isArray(book.authors) ? book.authors.join(', ') : book.authors}</p>
                        <button class="btn" onclick="returnBook('${book.id}')">Return Book</button>
                    </div>
                </div>
            `).join('');
            setupPagination('libraryPagination', page, data.totalItems, 'displayLibraryBooks');
        } else {
            container.innerHTML = '<div class="no-results">📚 Your library is empty. Search and add some books!</div>';
        }
    } catch (error) {
        console.error('Load library books error:', error);
        document.getElementById('libraryBooks').innerHTML = '<div class="no-results">🚫 Error loading your library. Please try again later.</div>';
    }
}

// Display borrowed books
async function displayBorrowedBooks(page = 0) {
    const borrowedBooksContainer = document.getElementById('borrowedBooks');
    const paginationDiv = document.getElementById('borrowedPagination');

    borrowedBooksContainer.innerHTML = '<div class="loading">🔄 Loading borrowed books...</div>';
    paginationDiv.innerHTML = '';

    try {
        const response = await apiRequest(`/api/books/borrowed?page=${page}&limit=${itemsPerPage}`);
        const { borrowedBooks: records, totalBorrowedBooks, currentPage, totalPages } = response.data;

        borrowedBooksContainer.innerHTML = '';
        paginationDiv.innerHTML = '';

        // Filter out returned books
        const filteredRecords = records.filter(book => book.status !== 'returned');

        if (!filteredRecords || filteredRecords.length === 0) {
            borrowedBooksContainer.innerHTML = '<div class="no-results">📋 You have not borrowed any books.</div>';
            return;
        }

        borrowedBooksContainer.innerHTML = filteredRecords.map(book => {
            const bookTitle = book.title || 'No Title';
            const bookAuthors = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors || 'Unknown Author';
            let statusClass = 'status-' + book.status.toLowerCase();
            let statusText = '';
            let actionButtonHtml = '';

            if (book.hasPendingReturn) {
                statusText = 'Return Request Pending';
                actionButtonHtml = '<button class="btn mt-2 disabled">Return Request Pending</button>';
            } else if (book.status === 'borrowed' || book.status === 'approved') {
                statusText = 'Currently Borrowed';
                actionButtonHtml = `<button class="btn mt-2" onclick="requestReturn('${book.id}')">Request Return</button>`;
            } else if (book.status === 'returned') {
                statusText = 'Returned';
                actionButtonHtml = '';
            }

            const borrowDate = (book.status === 'rejected') ? 'N/A' : (book.issue_date ? new Date(book.issue_date).toLocaleDateString() : 'N/A');
            let dueDate = 'N/A';
            if (book.return_due_date) {
                dueDate = new Date(book.return_due_date).toLocaleDateString();
            } else if (book.original_return_due_date) {
                dueDate = new Date(book.original_return_due_date).toLocaleDateString();
            }
            const returnDate = book.return_date ? new Date(book.return_date).toLocaleDateString() : '-';

            return `
                <div class="book-card">
                    <img src="${book.thumbnail || '/images/no-cover.png'}" alt="${bookTitle}" class="book-image">
                    <div class="book-info">
                        <h3 class="book-title">${bookTitle}</h3>
                        <p class="book-author">${bookAuthors}</p>
                        <span class="book-status ${statusClass}">${statusText}</span>
                        <p class="book-dates">Borrowed on: ${borrowDate}</p>
                        <p class="book-dates">Due on: ${dueDate}</p>
                        ${book.status === 'returned' ? `<p class="book-dates">Returned on: ${returnDate}</p>` : ''}
                        ${actionButtonHtml}
                    </div>
                </div>
            `;
        }).join('');

        setupPagination('borrowedPagination', currentPage, totalBorrowedBooks, 'displayBorrowedBooks');
    } catch (error) {
        console.error('Error loading borrowed books:', error);
        borrowedBooksContainer.innerHTML = '<div class="error">❌ Error loading borrowed books. Please try again later.</div>';
    }
}

// Tab switching functionality
function switchTab(tab, event) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');

    const searchTab = document.getElementById('searchTab');
    const libraryBooks = document.getElementById('libraryBooks');
    const borrowedBooks = document.getElementById('borrowedBooks');

    if (searchTab) searchTab.style.display = tab === 'search' ? 'block' : 'none';
    if (libraryBooks) libraryBooks.style.display = tab === 'library' ? 'grid' : 'none';
    if (borrowedBooks) borrowedBooks.style.display = tab === 'borrowed' ? 'grid' : 'none';

    if (tab === 'library') displayLibraryBooks();
    if (tab === 'borrowed') displayBorrowedBooks();
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    switchTab('search');
});

async function requestReturn(bookId) {
    if (!confirm('Would you like to request to return this book? An administrator will need to approve your request.')) {
        return;
    }
    
    try {
        const response = await apiRequest(`/api/books/return/${bookId}`, 'POST');
        alert('Return request submitted successfully! An administrator will review your request.');
        // Refresh the borrowed books display
        await displayBorrowedBooks();
    } catch (error) {
        console.error('Error requesting return:', error);
        alert(error.response?.data?.error || 'An error occurred while requesting to return the book');
    }
}

// Move these functions from user.html to user.js
function getStatusClass(status) {
    switch(status) {
        case 'pending': return 'status-pending';
        case 'approved':
        case 'borrowed': return 'status-borrowed';
        case 'rejected': return 'status-rejected';
        case 'returned': return 'status-available';
        default: return '';
    }
}

function getStatusText(status) {
    switch(status) {
        case 'pending': return 'Pending Approval';
        case 'approved': return 'Currently Borrowed';
        case 'rejected': return 'Request Rejected';
        case 'returned': return 'Returned';
        default: return status;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('borrowed-books-tab')?.addEventListener('shown.bs.tab', loadBorrowedBooks);
});

async function loadBorrowedBooks() {
    try {
        console.log('Loading borrowed books...');
        const response = await apiRequest('/api/books/borrowed');
        const records = response.data;

        const tbody = document.getElementById('borrowedBooksList');
        if (!Array.isArray(records) || records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No borrowed books found.</td></tr>';
            return;
        }

        tbody.innerHTML = records.map(record => {
            const borrowDate = (record.status === 'rejected') ? 'N/A' : (record.issue_date ? new Date(record.issue_date).toLocaleDateString() : 'N/A');
            let dueDate = 'N/A';
            if (record.return_due_date) {
                dueDate = new Date(record.return_due_date).toLocaleDateString();
            } else if (record.original_return_due_date) {
                dueDate = new Date(record.original_return_due_date).toLocaleDateString();
            }
            const returnDate = record.actual_return_date ? new Date(record.actual_return_date).toLocaleDateString() : '-';

            let statusText = record.statusLabel || '';
            if (!statusText) {
                if (record.status === 'approved') statusText = 'Borrowed';
                else if (record.status === 'returned') statusText = 'Returned';
                else if (record.status === 'pending') statusText = 'Borrow Request Pending';
                else if (record.status === 'rejected') statusText = 'Borrow Request Rejected';
                else statusText = record.status;
            }

            return `
                <tr>
                    <td>${record.id}</td>
                    <td>${record.book_title || 'N/A'}</td>
                    <td>${Array.isArray(record.authors) ? record.authors.join(', ') : (record.authors || 'N/A')}</td>
                    <td>${borrowDate}</td>
                    <td>${dueDate}</td>
                    <td>${returnDate}</td>
                    <td>${statusText}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading borrowed books:', error);
        const tbody = document.getElementById('borrowedBooksList');
        tbody.innerHTML = '<tr><td colspan="7">Error loading borrowed books. Please try again later.</td></tr>';
    }
}
