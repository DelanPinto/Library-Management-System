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

async function loadSectionData(section) {
    showSection(section); // Show the section first
    console.log('Loading data for section:', section);
    switch (section) {
        case 'search':
            // Search functionality is handled by searchBooks(), which is called on button click
            // No need to load all search data on tab show
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
    }
}

async function loadBorrowedBooks() {
    try {
        console.log('Attempting to load all borrow records for admin...');
        // Fetch all borrow records for admin
        const res = await apiRequest('/api/books/all-borrow-records');
        console.log('API Response:', res); // Log the API response
        const tbody = document.getElementById('borrowedList');
        // Ensure res.data is an array
        const records = Array.isArray(res.data) ? res.data : [];

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10">No borrow records found.</td></tr>';
            return;
        }

        tbody.innerHTML = records.map(record => {
            // Format dates for display
            const requestDate = record.request_date ? new Date(record.request_date).toLocaleDateString() : 'N/A';

            // Borrow Date: Only display if borrowed or returned, otherwise N/A
            let borrowDateDisplay = 'N/A';
            if (record.request_type === 'borrow' && (record.status === 'borrowed' || record.status === 'returned') && record.approved_at) {
                borrowDateDisplay = new Date(record.approved_at).toLocaleDateString();
            } else if (record.request_type === 'return' && record.original_borrow_approved_at) {
                // For return requests, display the original borrow's approved_at date
                borrowDateDisplay = new Date(record.original_borrow_approved_at).toLocaleDateString();
            }

            // Due Date: 15 days from borrow date for borrowed requests, N/A for pending/rejected
            let dueDateDisplay = 'N/A';
            if (record.request_type === 'borrow' && (record.status === 'borrowed' || record.status === 'approved') && record.return_due_date) {
                dueDateDisplay = new Date(record.return_due_date).toLocaleDateString();
            } else if (record.request_type === 'return' && record.original_return_due_date) {
                // For return requests, display the original borrow's due date
                dueDateDisplay = new Date(record.original_return_due_date).toLocaleDateString();
            }
            
            // Return Date: Actual return date if available, otherwise N/A
            let returnDateDisplay = 'N/A';
            if (record.request_type === 'borrow' && record.status === 'returned' && record.return_date) {
                returnDateDisplay = new Date(record.return_date).toLocaleDateString();
            } else if (record.request_type === 'return' && (record.status === 'returned' || record.status === 'approved') && record.return_date) {
                returnDateDisplay = new Date(record.return_date).toLocaleDateString();
            }

            let statusText = record.statusLabel || '';
            if (!statusText) {
                if (record.request_type === 'borrow') {
                    if (record.status === 'borrowed') statusText = 'Borrowed';
                    else if (record.status === 'returned') statusText = 'Returned';
                    else if (record.status === 'pending') statusText = 'Borrow Request Pending';
                    else if (record.status === 'approved') statusText = 'Borrowed';
                    else if (record.status === 'rejected') statusText = 'Borrow Request Rejected';
                } else if (record.request_type === 'return') {
                    if (record.status === 'returned') statusText = 'Returned';
                    else if (record.status === 'approved') statusText = 'Returned';
                    else if (record.status === 'pending') statusText = 'Return Request Pending';
                    else if (record.status === 'rejected') statusText = 'Return Request Rejected';
                    else statusText = record.status;
                } else {
                    statusText = record.status;
                }
            }

            // Action buttons for pending requests
            let actionButtons = '-';
            if (record.status === 'pending') {
                actionButtons = `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-success" onclick="handleRequest(${record.id}, 'approved')">Approve</button>
                        <button class="btn btn-sm btn-danger" onclick="handleRequest(${record.id}, 'rejected')">Reject</button>
                    </div>`;
            }

            return `
                <tr>
                    <td>${record.id}</td>
                    <td>${record.user_name || 'N/A'}</td>
                    <td>${record.book_title || 'N/A'}</td>
                    <td>${Array.isArray(record.authors) ? record.authors.join(', ') : (record.authors || 'N/A')}</td>
                    <td>${record.request_type ? record.request_type.charAt(0).toUpperCase() + record.request_type.slice(1) : 'Borrow'}</td>
                    <td>${borrowDateDisplay}</td>
                    <td>${dueDateDisplay}</td>
                    <td>${returnDateDisplay}</td>
                    <td>${statusText}</td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Load borrowed books error:', error);
        const tbody = document.getElementById('borrowedList');
        tbody.innerHTML = '<tr><td colspan="10">Error loading borrow records.</td></tr>';
    }
}

async function handleRequest(requestId, status) {
    try {
        console.log(`Handling request ${requestId} with status ${status}`);
        await apiRequest(`/api/books/request/${requestId}`, 'POST', { status });
        showAlert(`Request ${status} successfully`, 'success');
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
async function handleReturnRequest(requestId, status) {
    console.warn('handleReturnRequest is deprecated. Use handleRequest instead.');
    handleRequest(requestId, status);
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
        const response = await apiRequest(`/api/books/borrowed/${userId}`);
        const records = response.data;

        loadingSpinner.style.display = 'none';

        console.log('Admin view: Received records for user books modal:', records);

        if (Array.isArray(records) && records.length > 0) {
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
                            ${records.map(record => {
                                // Format dates
                                let borrowDate = 'N/A';
                                if (record.request_type === 'borrow' && (record.status === 'borrowed' || record.status === 'returned' || record.status === 'approved') && record.issue_date) {
                                    borrowDate = new Date(record.issue_date).toLocaleDateString();
                                } else if (record.request_type === 'return' && record.original_borrow_approved_at) {
                                    borrowDate = new Date(record.original_borrow_approved_at).toLocaleDateString();
                                }

                                let dueDate = 'N/A';
                                if (record.request_type === 'borrow' && record.return_due_date) {
                                    dueDate = new Date(record.return_due_date).toLocaleDateString();
                                } else if (record.request_type === 'return' && record.original_return_due_date) {
                                    dueDate = new Date(record.original_return_due_date).toLocaleDateString();
                                }

                                let returnDate = '-';
                                if (record.request_type === 'borrow' && record.status === 'returned' && record.return_date) {
                                    returnDate = new Date(record.return_date).toLocaleDateString();
                                } else if (record.request_type === 'return' && (record.status === 'returned' || record.status === 'approved') && record.return_date) {
                                    returnDate = new Date(record.return_date).toLocaleDateString();
                                }

                                // Use statusLabel from backend if present, otherwise fallback
                                let statusText = record.statusLabel || '';
                                if (!statusText) {
                                    if (record.request_type === 'borrow') {
                                        if (record.status === 'borrowed') statusText = 'Borrowed';
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
            modalBody.innerHTML = '<p>No borrowed books found for this user.</p>';
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
    try {
        console.log('Attempting to load users from /api/users/all');
        const response = await apiRequest('/api/users/all');
        const users = response.data?.data?.users || []; // Ensure proper response structure

        const tbody = document.getElementById('usersList');
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No user details available.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewUserBooks(${user.id})">View Books</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
        const tbody = document.getElementById('usersList');
        tbody.innerHTML = '<tr><td colspan="4">Error loading user details. Please try again later.</td></tr>';
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
            // For return requests, only show borrow date if there is a valid issue_date
            const showBorrowDate = record.request_type === 'return' ? !!record.original_issue_date : !!record.issue_date;
            const issueDate = showBorrowDate ? (record.request_type === 'return' ? new Date(record.original_issue_date).toLocaleDateString() : new Date(record.issue_date).toLocaleDateString()) : 'N/A';
            
            // Determine the due date to display
            let displayDueDate = 'N/A';
            if (record.request_type === 'borrow') {
                if (record.return_due_date) {
                    displayDueDate = new Date(record.return_due_date).toLocaleDateString();
                }
            } else if (record.request_type === 'return') {
                if (record.original_return_due_date) {
                    displayDueDate = new Date(record.original_return_due_date).toLocaleDateString();
                }
            }

            const actualReturnDate = record.actual_return_date ? new Date(record.actual_return_date) : null;
            const actualReturnDateString = actualReturnDate ? actualReturnDate.toLocaleDateString() : '-';

            let statusText = record.statusLabel || '';
            if (!statusText) {
                if (record.request_type === 'borrow') {
                    if (record.status === 'borrowed') statusText = 'Borrowed';
                    else if (record.status === 'returned') statusText = 'Returned';
                    else if (record.status === 'pending') statusText = 'Borrow Request Pending';
                    else if (record.status === 'approved') statusText = 'Borrowed';
                    else if (record.status === 'rejected') statusText = 'Borrow Request Rejected';
                } else if (record.request_type === 'return') {
                    if (record.status === 'returned') statusText = 'Returned';
                    else if (record.status === 'approved') statusText = 'Returned';
                    else if (record.status === 'pending') statusText = 'Return Request Pending';
                    else if (record.status === 'rejected') statusText = 'Return Request Rejected';
                    else statusText = record.status;
                } else {
                    statusText = record.status;
                }
            }

            // Action buttons for pending requests
            let actionButtons = '';
            if (record.status === 'pending' && (record.request_type === 'borrow' || record.request_type === 'return')) {
                actionButtons = `
                    <button class="btn btn-sm btn-success" onclick="handleRequest(${record.id}, 'approved')">Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="handleRequest(${record.id}, 'rejected')">Reject</button>
                `;
            } else {
                actionButtons = '-';
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
                <td>${displayDueDate}</td>
                <td>${actualReturnDateString}</td>
                <td>${statusText}</td>
                <td>${actionButtons}</td>
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
