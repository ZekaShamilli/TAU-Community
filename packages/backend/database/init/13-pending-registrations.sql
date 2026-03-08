-- Create pending_registrations table for storing signup data before email verification
-- This allows us to only create user accounts AFTER email is verified

CREATE TABLE IF NOT EXISTS pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  password_hash TEXT NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  verification_code_expires TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_verification_code ON pending_registrations(verification_code);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires ON pending_registrations(verification_code_expires);

-- Auto-delete expired pending registrations (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_expired_pending_registrations()
RETURNS void AS $$
BEGIN
  DELETE FROM pending_registrations
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run cleanup (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-pending-registrations', '0 * * * *', 'SELECT cleanup_expired_pending_registrations()');

COMMENT ON TABLE pending_registrations IS 'Temporary storage for user registration data before email verification';
COMMENT ON COLUMN pending_registrations.verification_code_expires IS 'Code expires after 10 minutes';
