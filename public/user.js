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

// Setup pagination controls
function setupPagination(containerId, currentPage, totalItems, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    const ITEMS_PER_PAGE = 9; // Match the constant from the search function
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    
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
        console.log('Initiating search with query:', query, 'page:', page);
        const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}&page=${page}&limit=${ITEMS_PER_PAGE}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Search response:', data);
        
        document.getElementById('loadingSpinner').style.display = 'none';
        
        if (data && data.books && data.books.length > 0) {
            console.log('Books found:', data.books.length);
            displaySearchResults(data.books);
            setupPagination('searchPagination', page, data.totalItems || data.books.length, 'performSearch');
        } else {
            document.getElementById('searchResults').innerHTML = '<div class="no-results">📭 No books found. Try different keywords!</div>';
        }
    } catch (error) {
        console.error('Search error:', error);
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('searchResults').innerHTML = '<div class="no-results">🚫 Error searching books. Please try again later.</div>';
    }
}

// Display search results
function displaySearchResults(books) {
    console.log('displaySearchResults called with books:', books);
    const container = document.getElementById('searchResults');
    
    if (!Array.isArray(books) || books.length === 0) {
        console.log('No books array or empty books array.');
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon"><i class="fas fa-book-open"></i></div>
                <div class="no-results-text">No books found</div>
                <div class="no-results-suggestion">Try different keywords or check the spelling</div>
            </div>`;
        return;
    }
    
    // Filter to show only books with available copies > 0
    const availableBooks = books.filter(book => 
        book.localDbId !== null && // Book is in the library
    book.available_copies > 0 // Has available copies
    );
    
    console.log('Available books:', availableBooks.length);
    
    if (availableBooks.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon"><i class="fas fa-book-open"></i></div>
                <div class="no-results-text">No Available Books Found</div>
                <div class="no-results-suggestion">All matching books are currently borrowed or not in our library</div>
            </div>`;
        return;
    }
    
    console.log('Rendering available books:', availableBooks.length);
    container.innerHTML = availableBooks.map(book => {
        const volumeInfo = book.volumeInfo || book;
        const thumbnail = (volumeInfo.imageLinks && (volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail)) || 
                        book.thumbnail || 
                        '/images/no-cover.png';
        
        const authorText = Array.isArray(volumeInfo.authors) 
            ? volumeInfo.authors.join(', ') 
            : (volumeInfo.authors || book.authors || 'Unknown Author');
        
        const titleText = volumeInfo.title || book.title || 'Unknown Title';
        const publisherText = volumeInfo.publisher || book.publisher || 'Unknown Publisher';
        
        // Determine the book's status
        let statusText, statusClass, badgeText, buttonText, isDisabled, buttonIcon;
        
        if (book.localDbId === null) {
            statusText = 'Not in Library';
            statusClass = 'status-unavailable';
            badgeText = 'Not Available';
            buttonText = 'Not in Library';
            isDisabled = true;
            buttonIcon = 'fa-times-circle';
    } else if (book.available_copies > 0) {
            statusText = `Available (${book.available_copies} of ${book.total_copies})`;
            statusClass = 'status-available';
            badgeText = `${book.available_copies} Available`;
            buttonText = 'Request to Borrow';
            isDisabled = false;
            buttonIcon = 'fa-book-reader';
        } else {
            statusText = `All Copies Borrowed (${book.total_copies})`;
            statusClass = 'status-borrowed';
            badgeText = 'None Available';
            buttonText = 'Currently Unavailable';
            isDisabled = true;
            buttonIcon = 'fa-clock';
        }
        
        return `
            <div class="book-card">
                <div class="book-image-container">
                    <img src="${thumbnail}" 
                        alt="${titleText}" 
                        class="book-image"
                        onerror="this.onerror=null; this.src='/images/no-cover.png';">
                    ${badgeText ? `<div class="${statusClass}-badge">${badgeText}</div>` : ''}
                </div>
                <div class="book-info">
                    <h3 class="book-title" title="${titleText}">${titleText}</h3>
                    <p class="book-author">
                        <i class="fas fa-user-edit"></i> ${authorText}
                    </p>
                    <p class="book-publisher">
                        <i class="fas fa-building"></i> ${publisherText}
                    </p>
                    <div class="book-status-container">
                        <span class="book-status ${statusClass}">
                            <i class="fas ${!book.inLibrary ? 'fa-times-circle' : 
                                          !book.isAvailable ? 'fa-clock' : 
                                          'fa-check-circle'}"></i>
                            ${statusText}
                        </span>
                    </div>
                    <div class="book-action">
                        <button class="borrow-btn ${isDisabled ? 'disabled' : ''}" 
                                onclick="${!isDisabled ? `borrowBook('${book.localDbId}')` : ''}"
                                ${isDisabled ? 'disabled' : ''}>
                            <i class="fas ${buttonIcon}"></i>
                            ${buttonText}
                        </button>
                    </div>
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
        alert('Your request to borrow this book has been sent to the administrator for approval.');
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
async function displayBorrowedBooks(page = 0, retry = false) {
    try {
        const container = document.getElementById('borrowedBooks');
        container.innerHTML = '<div class="loading">Loading borrowed books...</div>';

        // Add cache-busting parameter and page info
        const response = await apiRequest(`/api/books/borrowed?page=${page}&limit=9&t=${Date.now()}`);
        console.log('Borrowed books response:', response);

        if (!response || !response.books) {
            throw new Error('Unable to fetch borrowed books');
        }

        let books = response.books;
        // Keep only active borrow rows; attach pending returns to their borrow and dedupe
        const byBookId = new Map();
        const pendingReturns = [];
        for (const row of books) {
            if (row.action_type === 'return' && row.status === 'pending') {
                pendingReturns.push(row);
                continue;
            }
            if (row.action_type === 'borrow' && (row.status === 'approved' || row.status === 'borrowed')) {
                // keep most recent per book_id
                const existing = byBookId.get(row.book_id);
                if (!existing || new Date(row.request_date) > new Date(existing.request_date)) {
                    byBookId.set(row.book_id, row);
                }
            }
        }
        // Attach pending return to its borrow
        for (const rr of pendingReturns) {
            const rec = byBookId.get(rr.book_id);
            if (rec) rec.return_request = rr;
        }
        books = Array.from(byBookId.values());
        if (!Array.isArray(books) || books.length === 0) {
            container.innerHTML = '<div class="no-results">📚 You have not borrowed any books yet.</div>';
            return;
        }

        // Handle pagination
        const totalPages = Math.ceil(response.totalItems / 9);
        currentBorrowedPage = page;

        // Display books
        container.innerHTML = books.map(book => {
            // Parse authors
            const authors = typeof book.authors === 'string' ? 
                JSON.parse(book.authors) : 
                Array.isArray(book.authors) ? 
                    book.authors : ['Unknown Author'];

            // Parse dates
            const borrowDate = book.issue_date ? new Date(book.issue_date) : null;
            const dueDate = book.return_due_date ? new Date(book.return_due_date) : null;
            const today = new Date();
            const daysRemaining = dueDate ? Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)) : null;
            const isOverdue = dueDate && dueDate < today;

            // Get return request status
            const returnRequest = book.return_request ? 
                (typeof book.return_request === 'string' ? 
                    JSON.parse(book.return_request) : 
                    book.return_request) : 
                null;

            // Determine status and actions
            let statusHtml, actionHtml;

            if (returnRequest && returnRequest.status === 'pending') {
                statusHtml = `
                    <span class="book-status status-pending">
                        <i class="fas fa-clock"></i> Return Requested
                        <div class="status-details">
                            Request sent on ${new Date(returnRequest.request_date).toLocaleDateString()}
                        </div>
                    </span>`;
                actionHtml = `
                    <div class="pending-message">
                        <i class="fas fa-info-circle"></i> 
                        Return request is awaiting administrator approval
                    </div>`;
            } else {
                statusHtml = `
                    <span class="book-status ${isOverdue ? 'status-overdue' : 'status-borrowed'}">
                        <i class="fas ${isOverdue ? 'fa-exclamation-circle' : 'fa-book-reader'}"></i>
                        ${isOverdue ? 'Overdue' : 'Currently Borrowed'}
                    </span>`;
                actionHtml = `
                    <button class="btn return-btn" onclick="requestReturn('${book.book_id}')">
                        <i class="fas fa-undo"></i> Return Book
                    </button>`;
            }

            return `
                <div class="book-card ${isOverdue ? 'overdue' : ''}">
                    <div class="book-image-container">
                        <img src="${book.thumbnail || '/images/no-cover.png'}" 
                             alt="${book.title}" 
                             class="book-image"
                             onerror="this.onerror=null; this.src='/images/no-cover.png';">
                        ${isOverdue ? '<div class="overdue-badge">OVERDUE</div>' : ''}
                    </div>
                    <div class="book-info">
                        <h3 class="book-title">${book.title}</h3>
                        <p class="book-author">
                            <i class="fas fa-user-edit"></i> 
                            ${authors.join(', ')}
                        </p>
                        
                        ${statusHtml}

                        <div class="book-dates">
                            ${borrowDate ? `
                                <div class="date-item">
                                    <i class="fas fa-calendar-check"></i>
                                    <div class="date-details">
                                        <span class="date-label">Borrowed on</span>
                                        <span class="date-value">${borrowDate.toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${dueDate ? `
                                <div class="date-item ${isOverdue ? 'overdue' : daysRemaining <= 3 ? 'due-soon' : ''}">
                                    <i class="fas ${isOverdue ? 'fa-exclamation-circle' : 'fa-calendar-times'}"></i>
                                    <div class="date-details">
                                        <span class="date-label">Due date</span>
                                        <span class="date-value">${dueDate.toLocaleDateString()}</span>
                                        ${daysRemaining !== null ? `
                                            <span class="days-remaining ${
                                                isOverdue ? 'overdue' : 
                                                daysRemaining <= 3 ? 'due-soon' : ''
                                            }">
                                                ${isOverdue ? 
                                                    `(${Math.abs(daysRemaining)}d overdue)` : 
                                                    daysRemaining === 0 ? 
                                                        '(Due today)' : 
                                                        `(${daysRemaining}d remaining)`
                                                }
                                            </span>
                                        ` : ''}
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        <div class="book-action">
                            ${actionHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Setup pagination
        if (response.totalItems > 9) {
            setupPagination('borrowedPagination', page, response.totalItems, 'displayBorrowedBooks');
        } else {
            document.getElementById('borrowedPagination').innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading borrowed books:', error);
        container.innerHTML = `
            <div class="no-results">
                <p>😕 Unable to load your borrowed books.</p>
                <button class="btn" onclick="displayBorrowedBooks()">Try Again</button>
            </div>
        `;
    }
}

// Tab switching functionality
function switchTab(tab, event) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');

    const searchTab = document.getElementById('searchTab');
    const borrowedTab = document.getElementById('borrowedTab');

    if (searchTab) searchTab.style.display = tab === 'search' ? 'block' : 'none';
    if (borrowedTab) borrowedTab.style.display = tab === 'borrowed' ? 'block' : 'none';

    if (tab === 'borrowed') window.displayBorrowedBooks();
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    switchTab('search');
});

async function requestReturn(bookId) {
    if (!confirm('Would you like to request to return this book? An administrator will need to approve your request.')) return;
    
    try {
        const response = await apiRequest(`/api/books/return/${bookId}`, 'POST');
        alert('Return request submitted successfully! An administrator will review your request.');
        
        // Immediately refresh the borrowed books display
        await displayBorrowedBooks(0); // Reset to first page
    } catch (error) {
        console.error('Error submitting return request:', error);
        if (error.message.includes('pending request')) {
            alert('A return request for this book is already pending. Please wait for administrator approval.');
        } else {
            alert(error.message || 'An unexpected error occurred while submitting the return request.');
        }
    }
}

// Move these functions from user.html to user.js
function getStatusClass(status) {
    switch(status) {
        case 'pending': return 'status-pending';
        case 'approved': return 'status-borrowed';
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
            const borrowDate = record.issue_date ? new Date(record.issue_date).toLocaleDateString() : 'N/A';
            const dueDate = record.return_due_date ? new Date(record.return_due_date).toLocaleDateString() : 'N/A';
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
