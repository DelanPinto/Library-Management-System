USE LibraryDB;

-- Insert admin user with hashed password (admin123)
INSERT INTO users (name, email, password, role) 
VALUES (
    'Admin',
    'admin@library.com',
    '$2a$10$45DTjxa28OFnMAXgG5QuZ.c1XAqE5xaN5eaELDw8E2X9L2zoE6jLa',
    'admin'
);