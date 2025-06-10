const db = require('../db');

async function insertUsersAndBooks() {
  try {
    // Insert user with user_id = 2
    await db.query(`
      INSERT INTO users (id, name, email) 
      VALUES (2, 'John Doe', 'john.doe@example.com')
    `);

    // Insert book with book_id = 3
    await db.query(`
      INSERT INTO books (id, title, author) 
      VALUES (3, 'The Great Gatsby', 'F. Scott Fitzgerald')
    `);

    console.log('Inserted user and book successfully.');
  } catch (error) {
    console.error('Error inserting user and book:', error);
  }
}

insertUsersAndBooks();
