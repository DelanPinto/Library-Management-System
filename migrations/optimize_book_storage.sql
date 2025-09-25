-- Create book_details table for non-essential metadata
CREATE TABLE IF NOT EXISTS book_details (
    book_id INT PRIMARY KEY,
    description TEXT,
    thumbnail VARCHAR(255),
    publisher VARCHAR(255),
    published_date VARCHAR(50),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
