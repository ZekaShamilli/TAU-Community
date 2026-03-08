-- Add failed_attempts column to pending_registrations table
-- This tracks how many times user entered wrong code

ALTER TABLE pending_registrations 
ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;

COMMENT ON COLUMN pending_registrations.failed_attempts IS 'Number of failed verification attempts. Max 5 allowed.';
