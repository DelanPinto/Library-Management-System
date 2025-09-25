// Book search functionality with fallback
const adminItemsPerPage = 12;

// Move setupAdminPagination here so it's available globally
function setupAdminPagination(containerId, currentPage, totalItems, onPageChange) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / adminItemsPerPage);
    if (totalPages <= 1) return;
    // Show only 3 pages at a time, centered around current page
    let startPage = Math.max(0, currentPage - 1);
    let endPage = Math.min(totalPages - 1, startPage + 2);
    if (endPage - startPage < 2) {
        startPage = Math.max(0, endPage - 2);
    }
    if (currentPage > 0) {
        container.innerHTML += `<button class="page-btn" onclick="searchBooks(${currentPage - 1})">←</button>`;
    }
    for (let i = startPage; i <= endPage; i++) {
        container.innerHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="searchBooks(${i})">${i + 1}</button>`;
    }
    if (currentPage < totalPages - 1) {
        container.innerHTML += `<button class="page-btn" onclick="searchBooks(${currentPage + 1})">→</button>`;
    }
}
async function searchBooks(page = 0) {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        alert('⚠️ Please enter a search term');
        return;
    }
    currentAdminSearchPage = page;
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('searchResults').innerHTML = '';
    
    let books = [];
    let totalItems = 0;
    let error = null;
    
    // Try Google Books API first
    try {
        console.log('Attempting Google Books API search...');
        const response = await apiRequest(`/api/books/search?q=${encodeURIComponent(query)}&page=${page}&limit=${adminItemsPerPage}&source=google`);
        if (response && response.books && Array.isArray(response.books)) {
            books = response.books;
            totalItems = response.totalItems || books.length;
            console.log('Google Books API search successful');
        }
    } catch (googleError) {
        console.log('Google Books API failed, attempting OpenLibrary fallback...', googleError);
        error = googleError;
        
        // Fall back to OpenLibrary
        try {
            const openLibResponse = await apiRequest(`/api/books/search?q=${encodeURIComponent(query)}&page=${page}&limit=${adminItemsPerPage}&source=openlibrary`);
            if (openLibResponse && openLibResponse.books && Array.isArray(openLibResponse.books)) {
                books = openLibResponse.books;
                totalItems = openLibResponse.totalItems || books.length;
                error = null; // Clear error if OpenLibrary succeeds
                console.log('OpenLibrary API search successful');
            }
        } catch (openLibError) {
            console.error('Both APIs failed:', { googleError, openLibError });
            error = new Error('Unable to search books at this time. Please try again later.');
        }
    } finally {
        document.getElementById('loadingSpinner').style.display = 'none';
    }
    
    if (error) {
        document.getElementById('searchResults').innerHTML = `
            <div class="no-results">
                <div class="no-results-icon"><i class="fas fa-exclamation-circle text-danger"></i></div>
                <div class="no-results-text">Search Service Unavailable</div>
                <div class="no-results-suggestion">We're experiencing technical difficulties. Please try again in a few moments.</div>
                <div class="error-details text-muted small mt-2">Error: ${error.message}</div>
            </div>`;
    } else if (books.length > 0) {
        console.log('Displaying search results:', books.length, 'books found');
        displaySearchResults(books);
        setupAdminPagination(
            'adminSearchPagination', 
            page, 
            totalItems,
            'searchBooks'
        );
    } else {
        document.getElementById('searchResults').innerHTML = `
            <div class="no-results">
                <div class="no-results-icon"><i class="fas fa-book-open text-muted"></i></div>
                <div class="no-results-text">No Books Found</div>
                <div class="no-results-suggestion">Try different keywords or check the spelling</div>
            </div>`;
    }
}

// Function to display search results
function displaySearchResults(books) {
    window.lastSearchBooks = books;
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
    
    console.log('Rendering books:', books.length);
    container.innerHTML = books.map(book => {
        const volumeInfo = book.volumeInfo || book;
        const thumbnail = (volumeInfo.imageLinks && (volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail)) || 
                        book.thumbnail || 
                        '/images/no-cover.png';
        
        const authorText = Array.isArray(volumeInfo.authors) 
            ? volumeInfo.authors.join(', ') 
            : (volumeInfo.authors || book.authors || 'Unknown Author');
        
        const titleText = volumeInfo.title || book.title || 'Unknown Title';
        const publisherText = volumeInfo.publisher || book.publisher || 'Unknown Publisher';
        
        return `
            <div class="book-card">
                <div class="book-image-container">
                    <img src="${thumbnail}" 
                        alt="${titleText}" 
                        class="book-image"
                        onerror="this.onerror=null; this.src='/images/no-cover.png';">
                </div>
                <div class="book-info">
                    <h3 class="book-title" title="${titleText}">${titleText}</h3>
                    <p class="book-author">
                        <i class="fas fa-user-edit"></i> ${authorText}
                    </p>
                    <p class="book-publisher">
                        <i class="fas fa-building"></i> ${publisherText}
                    </p>
                    <div class="book-action">
                        <button class="add-to-library-btn" 
                            onclick="showAddBookModal('${book.id}', '${titleText.replace(/'/g, "\\'")}', '${authorText.replace(/'/g, "\\'")}')">
                            <i class="fas fa-plus"></i>
                            Add to Library
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Add error handling styles
const style = document.createElement('style');
style.textContent = `
    .error-details {
        color: #666;
        font-size: 0.9em;
        margin-top: 10px;
    }
    
    .no-results {
        text-align: center;
        padding: 2rem;
    }
    
    .no-results-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        color: #6c757d;
    }
    
    .no-results-text {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
    }
    
    .no-results-suggestion {
        color: #6c757d;
    }
`;
document.head.appendChild(style);
