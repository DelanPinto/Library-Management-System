// Carousel Navigation Functions
let isScrolling = false;

function scrollBooks(direction) {
    if (isScrolling) return; // Prevent multiple scroll attempts
    
    const container = document.querySelector('.books-grid');
    if (!container) return;
    
    const scrollAmount = 600; // Adjust this value based on your card width + gap
    isScrolling = true;
    
    try {
        if (direction === 'prev') {
            container.scrollLeft -= scrollAmount;
        } else {
            container.scrollLeft += scrollAmount;
        }
    } finally {
        // Use setTimeout to prevent rapid consecutive scrolls
        setTimeout(() => {
            isScrolling = false;
        }, 300); // Adjust timing to match your transition duration
    }
}

// Optional: Add keyboard navigation with debounce
let keyNavigationTimeout;
document.addEventListener('keydown', (e) => {
    if (keyNavigationTimeout) return; // Prevent rapid keypresses
    
    if (e.key === 'ArrowLeft') {
        scrollBooks('prev');
    } else if (e.key === 'ArrowRight') {
        scrollBooks('next');
    }
    
    keyNavigationTimeout = setTimeout(() => {
        keyNavigationTimeout = null;
    }, 300); // Match the scroll timeout
});
