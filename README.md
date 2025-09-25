# Library Management System

A digital library management system built with Node.js, Express.js, and MySQL. The system includes user authentication, book management, and integration with the Google Books API.

## Features

- User authentication (login/register)
- Role-based access control (admin/user)
- Book search using Google Books API
- Book management (add, delete, update)
- Borrow and return books
- User management (admin only)
- Responsive design

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MySQL
- Authentication: JWT
- API Integration: Google Books API

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v8 or higher)
- Google Books API key

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd library-management-system
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a MySQL database:
   ```sql
   CREATE DATABASE library_management;
   ```

4. Import the database schema:
   ```bash
   mysql -u root -p library_management < database.sql
   ```

5. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=library_management
   JWT_SECRET=your_jwt_secret_key
   GOOGLE_BOOKS_API_KEY=your_google_books_api_key
   ```

6. Start the server:
   ```bash
   npm start
   ```

7. Access the application at `http://localhost:3000`

## Default Admin Account

- Email: admin@library.com
- Password: admin123

## API Endpoints

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- GET /api/auth/me - Get current user

### Books
- GET /api/books/search - Search books
- GET /api/books/all - Get all books (admin only)
- POST /api/books/add - Add book (admin only)
- DELETE /api/books/:id - Delete book (admin only)
- POST /api/books/borrow/:bookId - Borrow a book
- POST /api/books/return/:recordId - Return a book
- GET /api/books/borrowed - Get all borrowed books (admin only)
- GET /api/books/my-borrowed - Get user's borrowed books

### Users
- GET /api/users - Get all users (admin only)
- GET /api/users/:id - Get user by ID (admin only)
- PUT /api/users/:id - Update user (admin only)
- DELETE /api/users/:id - Delete user (admin only)
- POST /api/users/change-password - Change password

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

