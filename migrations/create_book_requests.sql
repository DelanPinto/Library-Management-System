-- Create book_requests table for borrow/return requests
CREATE TABLE IF NOT EXISTS book_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    request_type ENUM('borrow', 'return') NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'returned') NOT NULL DEFAULT 'pending',
    request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME NULL,
    issue_date DATETIME NULL,
    actual_return_date DATETIME NULL,
    return_due_date DATETIME NULL,
    request_id INT NULL, -- For return requests, links to the original borrow request
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
);
