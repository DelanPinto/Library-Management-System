-- Add return_date column to borrow_records table
ALTER TABLE borrow_records
ADD COLUMN return_date TIMESTAMP NULL AFTER issue_date; 