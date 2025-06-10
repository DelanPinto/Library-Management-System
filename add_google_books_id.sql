-- Add google_books_id column to books table
ALTER TABLE books
ADD COLUMN google_books_id VARCHAR(255) AFTER id;

-- Add an index to improve search performance
CREATE INDEX idx_google_books_id ON books(google_books_id); 