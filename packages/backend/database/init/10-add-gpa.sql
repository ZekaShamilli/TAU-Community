-- Add GPA column to users table
-- Created: 2026-03-02

-- Add GPA column (decimal with 2 decimal places, range 0.00-4.00)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS gpa DECIMAL(3,2) CHECK (gpa >= 0.00 AND gpa <= 4.00);

-- Add comment
COMMENT ON COLUMN users.gpa IS 'Student GPA (0.00-4.00 scale)';
