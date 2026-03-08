-- Add email verification fields to users table
-- This migration adds OTP verification for signup

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMP WITH TIME ZONE;

-- Create index for faster verification code lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_code ON users(verification_code) WHERE verification_code IS NOT NULL;

-- Update existing users to have email_verified = true (they were created before this feature)
UPDATE users SET email_verified = true WHERE email_verified IS NULL OR email_verified = false;
