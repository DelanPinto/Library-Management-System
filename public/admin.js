let token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    // Set up navigation - using Bootstrap's data-bs-toggle="tab"
    // No need for custom click listeners here as Bootstrap handles tab switching

    // Add return requests tab to the tab list
    const tabList = document.querySelector('.nav-tabs');
    // Check if tabList exists before appending
    if (tabList) {
        const returnRequestsTab = document.createElement('li');
        returnRequestsTab.className = 'nav-item';
        returnRequestsTab.innerHTML = `
            <a class="nav-link" id="return-requests-tab" data-bs-toggle="tab" href="#return-requests" role="tab" aria-controls="return-requests" aria-selected="false">
                Return Requests
            </a>
        `;
        tabList.appendChild(returnRequestsTab);
    }

    // Load data when a tab is shown
    document.getElementById('search-tab')?.addEventListener('shown.bs.tab', () => loadSectionData('search'));
    document.getElementById('books-tab')?.addEventListener('shown.bs.tab', () => loadSectionData('books'));
    document.getElementById('users-tab')?.addEventListener('shown.bs.tab', () => loadSectionData('users'));
    document.getElementById('borrowed-tab')?.addEventListener('shown.bs.tab', () => loadSectionData('borrowed'));
    // Listener for the dynamically added tab
    document.getElementById('return-requests-tab')?.addEventListener('shown.bs.tab', loadReturnRequests);

    // Manually trigger the 'shown.bs.tab' event for the initially active tab (search) after listeners are set
    const searchTabElement = document.getElementById('search-tab');
    if (searchTabElement) {
        const tab = new bootstrap.Tab(searchTabElement);
        tab.show();
    }

    // Initial data loading
    // loadAllBooks(); // Removed
    // loadUsers(); // Removed
    // loadBorrowedBooks(); // Removed

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            loadSectionData(page);
        });
    });

    // Set initial section to 'books' and load data
    loadSectionData('books');
});

async function loadAllBooks() {
    try {
        const response = await apiRequest('/api/books/all');
        const tbody = document.getElementById('booksList');
        
        if (!tbody) {
            console.error('Books list tbody element not found');
            return;
        }

    const books = Array.isArray(response.data) ? response.data : [];

        if (books.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <div class="text-muted">
                            <i class="fas fa-books fa-2x mb-3"></i>
                            <p>No books found in the library</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = books.map(book => {
            const authors = Array.isArray(book.authors) 
                ? book.authors.join(', ') 
                : (typeof book.authors === 'string' ? book.authors : 'Unknown Author');

            return `
                <tr>
                    <td>${book.title || 'No Title'}</td>
                    <td>${authors}</td>
                    <td>${book.total_copies || 0}</td>
                    <td>${book.available_copies || 0}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deleteBook('${book.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="editBookCopies('${book.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading all books:', error);
        const tbody = document.getElementById('booksList');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle"></i>
                            Error loading books. Please try again later.
                        </div>
                    </td>
                </tr>`;
        }
    }
}

async function loadSectionData(section) {
    try {
        // First try to get section element
        const sectionElement = document.getElementById(`${section}Section`);
        if (!sectionElement) {
            throw new Error(`Section element not found: ${section}Section`);
        }

        // Show section
        document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
        sectionElement.classList.remove('d-none');

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === section) {
                link.classList.add('active');
            }
        });

        console.log('Loading data for section:', section);

        // Handle loading state based on section type
        const tbody = sectionElement.querySelector('tbody');
        if (tbody && section !== 'search') {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2">Loading ${section}...</p>
                    </td>
                </tr>`;
        }

        // Load section data
        switch (section) {
            case 'search':
                // Search functionality is handled by searchBooks(), which is called on button click
                // Just ensure the search input is clear and focused
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                }
                break;
            case 'books':
                await loadAllBooks();
                break;
            case 'users':
                await loadUsers();
                break;
            case 'borrowed':
                await loadBorrowedBooks();
                break;
            default:
                console.warn('Unknown section:', section);
        }
    } catch (error) {
        console.error('Error in loadSectionData:', error);
        showAlert('An unexpected error occurred. Please try again.', 'danger');
    }
}

async function loadBorrowedBooks() {
    try {
        console.log('Attempting to load all borrow records for admin...');
        // Fetch all borrow records for admin
        const res = await apiRequest('/api/books/all-borrow-records');
        console.log('API Response:', res); // Log the API response

        // Add Book to Library (called from Add Book modal)
        async function addBookToLibrary() {
            const googleBookId = document.getElementById('googleBookId').value;
            const title = document.getElementById('bookTitle').value;
            const authorsRaw = document.getElementById('bookAuthors').value;
            const total_copies = parseInt(document.getElementById('bookCopies').value);
            const available_copies = total_copies;
            const authorsArr = authorsRaw.split(',').map(a => a.trim()).filter(a => a);

            if (!title || !authorsArr.length || !total_copies || total_copies < 1) {
                showAlert('Please fill in all required fields.', 'danger');
                return;
            }

            const publisher = document.getElementById('bookPublisher')?.value || '';
            const thumbnail = document.getElementById('bookThumbnail')?.value || '';
            const bookData = {
                title: title.trim(),
                authors: authorsArr,
                total_copies: Number(total_copies),
                available_copies: Number(available_copies)
            };
            if (googleBookId) {
                bookData.google_books_id = googleBookId;
            }
            if (publisher) {
                bookData.publisher = publisher;
            }
            if (thumbnail) {
                bookData.thumbnail = thumbnail;
            }
            // Remove any camelCase fields accidentally set
            // No need to delete camelCase fields; all code uses snake_case
            console.log('Add Book Payload:', bookData);

            try {
                const response = await apiRequest('/api/books/add', 'POST', bookData);
                if (response && response.success) {
                    showAlert('Book added successfully!', 'success');
                    // Hide modal
                    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('addBookModal'));
                    modal.hide();
                    // Reload books list
                    await loadAllBooks();
                } else {
                    throw new Error(response?.error || 'Failed to add book');
                }
            } catch (error) {
                console.error('Error adding book:', error);
                showAlert(error.message || 'Error adding book', 'danger');
            }
        }
        const tbody = document.getElementById('borrowedList');
        // Handle both array response and data property response
        const records = Array.isArray(res) ? res : (Array.isArray(res.data) ? res.data : []);

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No borrow records found.</td></tr>'; // Increased colspan
            return;
        }

        // Show all records (borrow and return), not just non-returned
        tbody.innerHTML = records.map(record => {
            // Format dates for display
            const requestDate = record.request_date ? new Date(record.request_date).toLocaleDateString() : 'N/A';
            const approvedAtDate = record.approved_at ? new Date(record.approved_at).toLocaleDateString() : 'N/A';
            
            // Preserve borrow/due dates for borrow records even after return
            let issueDate;
            let returnDueDateString;
            if (record.request_type === 'borrow') {
                issueDate = record.issue_date ? new Date(record.issue_date).toLocaleDateString() : 'N/A';
                const due = record.return_due_date ? new Date(record.return_due_date) : null;
                returnDueDateString = due ? due.toLocaleDateString() : 'N/A';
            } else {
                // For return records, attempt to use original borrow/due dates if provided; otherwise N/A
                const originalIssue = record.original_issue_date ? new Date(record.original_issue_date) : null;
                const originalDue = record.original_return_due_date ? new Date(record.original_return_due_date) : null;
                issueDate = originalIssue ? originalIssue.toLocaleDateString() : 'N/A';
                returnDueDateString = originalDue ? originalDue.toLocaleDateString() : 'N/A';
            }
            
            const actualReturnDate = record.actual_return_date ? new Date(record.actual_return_date) : null;
            const actualReturnDateString = actualReturnDate ? actualReturnDate.toLocaleDateString() : '-';

            // Use statusLabel from backend if present, otherwise fallback
            let statusText = record.statusLabel || '';
            if (!statusText) {
                if (record.request_type === 'borrow') {
                    if (record.status === 'approved') statusText = 'Borrowed';
                    else if (record.status === 'returned') statusText = 'Returned';
                    else if (record.status === 'pending') statusText = 'Borrow Request Pending';
                    else if (record.status === 'rejected') statusText = 'Borrow Request Rejected';
                    else statusText = record.status;
                } else if (record.request_type === 'return') {
                    if (record.status === 'approved' || record.status === 'returned') statusText = 'Returned';
                    else if (record.status === 'pending') statusText = 'Return Request Pending';
                    else if (record.status === 'rejected') statusText = 'Return Request Rejected';
                    else statusText = record.status;
                } else {
                    statusText = record.status;
                }
            }

            // Determine row highlight color
            const isActiveBorrow = record.request_type === 'borrow' && (record.status === 'approved' || record.status === 'borrowed');
            const isReturned = (record.request_type === 'borrow' && record.status === 'returned') ||
                               (record.request_type === 'return' && (record.status === 'approved' || record.status === 'returned'));
            const rowClass = isReturned ? 'table-success' : (isActiveBorrow ? 'table-danger' : '');

            return `
            <tr class="${rowClass}">
                <td>${record.record_id || record.id}</td>
                <td>${record.user_name || 'N/A'}</td>
                <td>${record.book_title || 'N/A'}</td>
                <td>${Array.isArray(record.authors) ? record.authors.join(', ') : (record.authors || 'N/A')}</td>
                <td>${record.request_type ? record.request_type.charAt(0).toUpperCase() + record.request_type.slice(1) : 'Borrow'}</td>
                <td>${issueDate}</td>
                <td>${returnDueDateString}</td>
                <td>${record.return_date ? new Date(record.return_date).toLocaleDateString() : '-'}</td>
                <td>${statusText}</td>
                <td>${record.status === 'pending' ? `
                     <div class="btn-group">
                         <button class="btn btn-sm btn-success" onclick="handleRequest('${record.id}', 'approved')">Approve</button>
                         <button class="btn btn-sm btn-danger" onclick="handleRequest('${record.id}', 'rejected')">Reject</button>
                     </div>` : '-'}</td>
            </tr>
        `;
        }).join('');
        
    } catch (error) {
        console.error('Load borrowed books error:', error);
        const tbody = document.getElementById('borrowedList');
        tbody.innerHTML = '<tr><td colspan="8">Error loading borrow records.</td></tr>'; // Increased colspan
    }
}

async function handleRequest(requestId, action) {
    try {
        console.log(`Debug: handleRequest called with requestId: ${requestId}, action: ${action}`);
        await apiRequest(`/api/book-requests/request/${requestId}`, 'POST', { action });
        showAlert(`Request ${action} successfully`, 'success');
        loadBorrowedBooks();
    } catch (error) {
        console.error('Error updating request:', error);
        showAlert(error.message || 'Error updating request', 'danger');
    }
}

function showAlert(message, type) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    // Insert at the top of the container
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}

// Load return requests
async function loadReturnRequests() {
    try {
         console.log('Attempting to load return requests...');
         const response = await apiRequest('/api/books/borrow-requests');
        const requests = response.data.filter(request => request.status === 'return_pending');
        
        const tbody = document.getElementById('returnRequestsList');
        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No pending return requests</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(request => `
            <tr>
                <td>${request.user_name}</td>
                <td>${request.book_title}</td>
                <td>${new Date(request.request_date).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="handleReturnRequest('${request.id}', 'approved')">Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="handleReturnRequest('${request.id}', 'rejected')">Reject</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading return requests:', error);
        showAlert('Error loading return requests', 'danger');
    }
}

// Handle return request approval/rejection
async function handleReturnRequest(requestId, action) {
    console.warn('handleReturnRequest is deprecated. Use handleRequest instead.');
    handleRequest(requestId, action);
}

async function deleteBook(bookId) {
    if (!confirm('Are you sure you want to delete this book?')) return;
    try {
        const result = await apiRequest(`/api/books/delete/${bookId}`, 'DELETE');
        if (result.response.ok) {
            showAlert('Book deleted successfully!', 'success');
            await loadAllBooks(); // Reload the books list
        } else {
            throw new Error(result.data.error || 'Failed to delete book');
        }
    } catch (error) {
        console.error('Delete book error:', error);
        showAlert(error.message || 'Error deleting book', 'danger');
    }
}

async function returnBook(recordId) {
    try {
        await apiRequest(`/api/books/return/${recordId}`, 'POST');
        loadBorrowedBooks();
        alert('Book returned successfully!');
    } catch (error) {
        console.error('Return book error:', error);
        alert('Error returning book');
    }
}

async function viewUserBooks(userId) {
    const modalEl = document.getElementById('viewUserBooksModal');
    const modalTitle = modalEl.querySelector('.modal-title');
    const modalBody = modalEl.querySelector('#userBorrowedBooksList');
    const loadingSpinner = modalEl.querySelector('#userBooksLoadingSpinner');
    const errorDiv = modalEl.querySelector('#userBooksError');

    modalTitle.textContent = 'Borrowed Books for User'; // Placeholder, will update with user name if available
    modalBody.innerHTML = '';
    errorDiv.style.display = 'none';
    loadingSpinner.style.display = 'block';

    const viewUserBooksModal = new bootstrap.Modal(modalEl);
    viewUserBooksModal.show();

    try {
        const response = await apiRequest(`/api/books/user/${userId}/borrowed`);
        console.log('User borrowed books response:', response);
        const records = response.data;

        loadingSpinner.style.display = 'none';

        console.log('Admin view: Received records for user books modal:', records);

        if (Array.isArray(records) && records.length > 0) {
            const activeBorrowRecords = records.filter(r => r.request_type === 'borrow' && (r.status === 'approved' || r.status === 'borrowed'));
            if (activeBorrowRecords.length === 0) {
                modalBody.innerHTML = '<p>No actively borrowed books for this user.</p>';
                return;
            }
            // Assuming the backend returns user_name in the records
            if (records[0].user_name) {
                modalTitle.textContent = `Borrowed Books for ${records[0].user_name}`;
            }
            modalBody.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Record ID</th>
                                <th>Book Title</th>
                                <th>Author Name</th>
                                <th>Borrow Date</th>
                                <th>Due Date</th>
                                <th>Return Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeBorrowRecords.map(record => {
                                // Format dates
                                const borrowDate = record.issue_date ? new Date(record.issue_date).toLocaleDateString() : 'N/A';
                                const dueDate = record.return_due_date ? new Date(record.return_due_date).toLocaleDateString() : 'N/A';
                                const returnDate = record.actual_return_date ? new Date(record.actual_return_date).toLocaleDateString() : '-';

                                // Use statusLabel from backend if present, otherwise fallback
                                let statusText = record.statusLabel || '';
                                if (!statusText) {
                                    if (record.request_type === 'borrow') {
                                        if (record.status === 'approved') statusText = 'Borrowed';
                                        else if (record.status === 'returned') statusText = 'Returned';
                                        else if (record.status === 'pending') statusText = 'Borrow Request Pending';
                                        else if (record.status === 'rejected') statusText = 'Borrow Request Rejected';
                                        else statusText = record.status;
                                    } else if (record.request_type === 'return') {
                                        if (record.status === 'returned') statusText = 'Returned';
                                        else if (record.status === 'pending') statusText = 'Return Request Pending';
                                        else if (record.status === 'rejected') statusText = 'Return Request Rejected';
                                        else statusText = record.status;
                                    } else {
                                        statusText = record.status;
                                    }
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
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            modalBody.innerHTML = '<p>No actively borrowed books for this user.</p>';
        }
    } catch (error) {
        console.error('Error fetching user borrowed books:', error);
        loadingSpinner.style.display = 'none';
        errorDiv.textContent = 'Error loading borrowed books.';
        errorDiv.style.display = 'block';
        modalBody.innerHTML = ''; // Clear any partial data
    }

}

async function loadUsers() {
    const tbody = document.getElementById('usersList');
    if (!tbody) {
        console.error('Could not find usersList element');
        return;
    }

    // Show loading state
    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-primary">Loading users...</p>
            </td>
        </tr>
    `;

    try {
        console.log('Fetching users from server...');
        const response = await apiRequest('/api/users/all');
        console.log('Users API Response:', JSON.stringify(response, null, 2));

        // Check if we have a valid response with data
        if (!response || !response.success || !response.data) {
            console.error('Invalid response structure:', response);
            throw new Error('Invalid response from server');
        }

        // Extract users from the response data
        const users = response.data;
        if (!Array.isArray(users)) {
            console.error('Invalid users array:', users);
            throw new Error('Users data is not in the expected format');
        }

        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4">
                        <div class="text-muted">
                            <i class="fas fa-users fa-2x mb-3"></i>
                            <p>No users registered in the system</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        // Sort users by role (admins first) and then by name
        const sortedUsers = users.sort((a, b) => {
            if (a.role === b.role) {
                return a.name.localeCompare(b.name);
            }
            return a.role === 'admin' ? -1 : 1;
        });

        // Render users table
        tbody.innerHTML = sortedUsers.map(user => `
            <tr class="align-middle">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="me-3">
                            <i class="fas fa-user-circle fa-2x text-${user.role === 'admin' ? 'danger' : 'primary'} opacity-75"></i>
                        </div>
                        <div>
                            <div class="fw-bold">${user.name || 'N/A'}</div>
                            <div class="text-muted small">ID: ${user.id}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <i class="fas fa-envelope text-muted me-2"></i>
                        ${user.email || 'N/A'}
                    </div>
                </td>
                <td>
                    <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'} p-2">
                        <i class="fas fa-${user.role === 'admin' ? 'shield-alt' : 'user'} me-1"></i>
                        ${user.role || 'user'}
                    </span>
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-info" onclick="viewUserBooks(${user.id})" title="View Borrowed Books">
                            <i class="fas fa-book me-1"></i> Books
                        </button>
                        ${user.role !== 'admin' ? `
                            <button class="btn btn-sm btn-warning" onclick="editUser(${user.id})" title="Edit User Role">
                                <i class="fas fa-user-edit"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        console.log('Users loaded successfully');
    } catch (error) {
        console.error('Error loading users:', error);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="alert alert-danger d-flex align-items-center mb-0">
                            <div class="me-3">
                                <i class="fas fa-exclamation-circle fa-2x"></i>
                            </div>
                            <div>
                                <h6 class="alert-heading mb-1">Error Loading Users</h6>
                                <p class="mb-0">${error.message || 'An unexpected error occurred. Please try again.'}</p>
                            </div>
                        </div>
                    </td>
                </tr>`;
        }
        // Show error alert at the top of the page
        showAlert('Failed to load users: ' + (error.message || 'Unknown error'), 'danger');
    }
}

async function editUser(userId) {
    const role = prompt('Enter new role for user (admin/user):');
    if (!role || !['admin', 'user'].includes(role.toLowerCase())) {
        alert('Invalid role. Please enter either "admin" or "user".');
        return;
    }

    try {
        await apiRequest(`/api/users/${userId}/role`, 'PUT', { role: role.toLowerCase() });
        showAlert('User role updated successfully', 'success');
        await loadUsers(); // Reload the users list
    } catch (error) {
        console.error('Error updating user role:', error);
        showAlert(error.message || 'Error updating user role', 'danger');
    }
}

async function editBookCopies(bookId) {
    const newCopies = prompt('Enter the new number of total copies:');
    if (!newCopies || isNaN(newCopies) || newCopies <= 0) {
        alert('Invalid input. Please enter a positive number.');
        return;
    }

    try {
        await apiRequest(`/api/books/update-copies/${bookId}`, 'PUT', { total_copies: parseInt(newCopies) });
        alert('Book copies updated successfully!');
        loadAllBooks(); // Refresh the books list
    } catch (error) {
        console.error('Error updating book copies:', error);
        alert('Failed to update book copies. Please try again later.');
    }
}

async function loadBookRecords() {
    try {
        console.log('Loading book records for admin dashboard...');
        const res = await apiRequest('/api/books/all-borrow-records');
        console.log('API Response:', res);
        const tbody = document.getElementById('bookRecordsList');
        const records = Array.isArray(res.data) ? res.data : [];

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10">No book records found.</td></tr>';
            return;
        }

        tbody.innerHTML = records.map(record => {
            const requestDate = record.request_date ? new Date(record.request_date).toLocaleDateString() : 'N/A';
            const approvedAtDate = record.approved_at ? new Date(record.approved_at).toLocaleDateString() : 'N/A';
            const issueDate = record.request_type === 'return' ? (record.original_issue_date ? new Date(record.original_issue_date).toLocaleDateString() : 'N/A') : (record.issue_date ? new Date(record.issue_date).toLocaleDateString() : 'N/A');
            const returnDueDate = record.request_type === 'return' ? (record.original_return_due_date ? new Date(record.original_return_due_date) : null) : (record.return_due_date ? new Date(record.return_due_date) : null);
            const returnDueDateString = returnDueDate ? returnDueDate.toLocaleDateString() : 'N/A';
            const actualReturnDate = record.actual_return_date ? new Date(record.actual_return_date) : null;
            const actualReturnDateString = actualReturnDate ? actualReturnDate.toLocaleDateString() : '-';

            let statusText = record.statusLabel || '';
            if (!statusText) {
                if (record.request_type === 'borrow') {
                    if (record.status === 'approved') statusText = 'Borrowed';
                    else if (record.status === 'returned') statusText = 'Returned';
                    else if (record.status === 'pending') statusText = 'Borrow Request Pending';
                    else if (record.status === 'rejected') statusText = 'Borrow Request Rejected';
                    else statusText = record.status;
                } else if (record.request_type === 'return') {
                    if (record.status === 'returned') statusText = 'Returned';
                    else if (record.status === 'pending') statusText = 'Return Request Pending';
                    else if (record.status === 'rejected') statusText = 'Return Request Rejected';
                    else statusText = record.status;
                } else {
                    statusText = record.status;
                }
            }

            return `
            <tr>
                <td>${record.record_id || record.id}</td>
                <td>${record.user_name || 'N/A'}</td>
                <td>${record.book_title || 'N/A'}</td>
                <td>${Array.isArray(record.authors) ? record.authors.join(', ') : (record.authors || 'N/A')}</td>
                <td>${record.request_type ? record.request_type.charAt(0).toUpperCase() + record.request_type.slice(1) : 'Borrow'}</td>
                <td>${requestDate}</td>
                <td>${issueDate}</td>
                <td>${returnDueDateString}</td>
                <td>${actualReturnDateString}</td>
                <td>${statusText}</td>
            </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading book records:', error);
        const tbody = document.getElementById('bookRecordsList');
        tbody.innerHTML = '<tr><td colspan="10">Error loading book records. Please try again later.</td></tr>';
    }
}

// Add event listener for the "Book Records" tab
const bookRecordsTab = document.getElementById('book-records-tab');
if (bookRecordsTab) {
    bookRecordsTab.addEventListener('shown.bs.tab', loadBookRecords);
}
