-- Create database
CREATE DATABASE IF NOT EXISTS LibraryDB;
USE LibraryDB1;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create books table
CREATE TABLE IF NOT EXISTS books (
    id INT PRIMARY KEY AUTO_INCREMENT,
    google_books_id VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    authors JSON,
    publisher VARCHAR(255),
    thumbnail VARCHAR(255),
    total_copies INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create borrow_records table
CREATE TABLE IF NOT EXISTS book_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    request_type ENUM('borrow', 'return') NOT NULL,
    request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    issue_date DATETIME,
    return_date DATETIME,
    return_due_date DATETIME,
    status ENUM('pending', 'borrowed', 'returned', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    action ENUM('approved', 'rejected') NULL, -- Stores the action taken by admin
    approved_at DATETIME NULL, -- Timestamp of approval/rejection
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Insert default admin user (password: admin123)
INSERT INTO users (name, email, password, role) 
VALUES ('Admin', 'admin@library.com', '$2a$10$X7UrH5YxX5YxX5YxX5YxX.5YxX5YxX5YxX5YxX5YxX5YxX5YxX5Yx', 'admin')
ON DUPLICATE KEY UPDATE id=id; 
