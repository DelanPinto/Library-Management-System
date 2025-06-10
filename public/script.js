const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://library-management-system-production-3ba6.up.railway.app';
// Function to make authenticated API requests
async function apiRequest(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

    // Handle token expiry or invalid token
    if (response.status === 401) {
        alert('Session expired. Please login again.');
        logout();
        return;
    }

    // Log detailed error information for debugging
    if (!response.ok) {
        console.error(`API Request failed: ${response.status} ${response.statusText}`);
        const errorData = await response.json().catch(() => null); // Handle JSON parsing errors
        console.error('Error details:', errorData);
        throw new Error(errorData?.error || 'API request failed');
    }

    // For DELETE requests, we might not get a JSON response
    if (method === 'DELETE' && response.status === 200) {
        return { response, data: { message: 'Success' } };
    }

    // Try to parse as JSON, but handle non-JSON responses
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        try {
            data = await response.json();
        } catch (error) {
            console.error('Failed to parse JSON response:', error);
            throw new Error('Invalid JSON response');
        }
    } else {
        data = null; // Non-JSON response
    }

    return { response, data };
}

// Function to check if user is authenticated and redirect if not
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Debugging log for token
    console.log('Token from localStorage:', token);

    if (!token) {
        // Not authenticated, redirect to login
        if (window.location.pathname !== '/login.html' && window.location.pathname !== '/register.html') {
            window.location.href = '/login.html';
        }
        return false;
    }

    // Check role-based access
    if (window.location.pathname === '/admin.html' && user.role !== 'admin') {
        window.location.href = '/user.html';
        return false;
    }

    return true;
}

// Function to handle logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// Function to format date
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

// Function to handle API errors
function handleApiError(error) {
    console.error('API Error:', error);
    alert(error.message || 'An error occurred');
}

// Function to validate form inputs
function validateForm(formData) {
    for (const [key, value] of formData.entries()) {
        if (!value) {
            throw new Error(`${key} is required`);
        }
    }
    return true;
}

// Function to show loading state
function showLoading(element) {
    element.disabled = true;
    element.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
}

// Function to hide loading state
function hideLoading(element, originalText) {
    element.disabled = false;
    element.innerHTML = originalText;
}

// Function to show success message
function showSuccess(message) {
    alert(message); // Replace with a better UI component
}

// Function to show error message
function showError(message) {
    alert(message); // Replace with a better UI component
}

// Function to debounce API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Helper functions for borrow status (moved from admin.html)
function getStatusClass(status) {
    switch(status) {
        case 'pending': return 'status-pending';
        case 'approved': return 'status-borrowed'; // Or a different class for approved
        case 'rejected': return 'status-rejected';
        case 'returned': return 'status-available'; // Or a different class for returned
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

// This function might be specific to admin or user, let's keep it separate for now or refine
// function getActionButton(record) { ... }

// Borrow related helper functions (from admin.html - potentially redundant with above)
// Let's rename and refine these to avoid confusion and ensure they are general enough

function getBorrowRecordStatusClass(status) {
     switch(status) {
        case 'pending': return 'status-pending';
        case 'approved': return 'status-borrowed';
        case 'rejected': return 'status-rejected';
        case 'returned': return 'status-available';
        default: return '';
    }
}

function getBorrowRecordStatusText(status) {
     switch(status) {
        case 'pending': return 'Pending Approval';
        case 'approved': return 'Currently Borrowed';
        case 'rejected': return 'Request Rejected';
        case 'returned': return 'Returned';
        default: return status;
    }
}

function getBorrowActionButton(record) {
     if (record.status === 'approved') {
        return `<button class="btn" onclick="returnBook('${record.id}')">Return Book</button>`;
    } else if (record.status === 'returned') {
        return '<p class="book-status">Returned on: ' + new Date(record.return_date).toLocaleDateString() + '</p>';
    }
    return '';
}

// Export functions for use in other scripts
window.apiRequest = apiRequest;
window.checkAuth = checkAuth;
window.logout = logout;
window.formatDate = formatDate;
window.handleApiError = handleApiError;
window.validateForm = validateForm;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showSuccess = showSuccess;
window.showError = showError;
window.debounce = debounce;
// Exporting new helper functions
window.getStatusClass = getStatusClass;
window.getStatusText = getStatusText;
window.getBorrowRecordStatusClass = getBorrowRecordStatusClass;
window.getBorrowRecordStatusText = getBorrowRecordStatusText;
window.getBorrowActionButton = getBorrowActionButton;

// Add event listener to logout button if it exists (will be added in HTML)
document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
});

// Basic function to display messages (can be enhanced)
function displayMessage(message, type = 'info') {
    console.log(`Message (${type}): ${message}`);
    // Implement actual UI display here (e.g., in a dedicated message area)
}

// Basic function to display errors (can be enhanced)
function displayError(error) {
     console.error('Error:', error);
     // Implement actual UI display here
     const errorElement = document.getElementById('errorMessage'); // Assuming an error message element exists
     if (errorElement) {
         errorElement.textContent = error;
     }
}

async function displayBorrowedBooks() {
    try {
        const response = await apiRequest('/api/books/borrowed');
        const borrowedBooks = response.books;

        if (borrowedBooks.length === 0) {
            document.getElementById('borrowed-books-container').innerHTML = '<p>No borrowed books found.</p>';
            return;
        }

        // Logic to display borrowed books
        borrowedBooks.forEach(book => {
            const bookElement = document.createElement('div');
            bookElement.textContent = book.title; // Example logic
            document.getElementById('borrowed-books-container').appendChild(bookElement);
        });
    } catch (error) {
        console.error('Error displaying borrowed books:', error);
        document.getElementById('borrowed-books-container').innerHTML = '<p>Error fetching borrowed books.</p>';
    }
}
