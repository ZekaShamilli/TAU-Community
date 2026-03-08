-- Add password reset functionality to users table
-- This migration adds fields needed for password reset tokens

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;

-- Add constraints for password reset fields
ALTER TABLE users ADD CONSTRAINT users_reset_token_length CHECK (reset_token IS NULL OR length(reset_token) >= 32);
ALTER TABLE users ADD CONSTRAINT users_reset_token_consistency CHECK (
    (reset_token IS NULL AND reset_token_expires IS NULL) OR
    (reset_token IS NOT NULL AND reset_token_expires IS NOT NULL)
);

-- Create index for faster reset token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_reset_token_expires ON users(reset_token_expires) WHERE reset_token_expires IS NOT NULL;