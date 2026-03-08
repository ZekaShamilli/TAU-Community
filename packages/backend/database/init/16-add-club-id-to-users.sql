-- Add club_id column to users table for club presidents
-- This allows us to easily track which club a president manages

-- Add club_id column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_club_id ON users(club_id);

-- Add comment to explain the column
COMMENT ON COLUMN users.club_id IS 'For CLUB_PRESIDENT role: references the club they manage';

-- Update existing club presidents to have their club_id set
UPDATE users u
SET 
  club_id = c.id,
  updated_at = CURRENT_TIMESTAMP
FROM clubs c
WHERE 
  u.role = 'CLUB_PRESIDENT'
  AND c.president_id = u.id
  AND c.is_active = true
  AND u.club_id IS NULL;

-- Verify the update
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.role,
  u.club_id,
  c.name as club_name
FROM users u
LEFT JOIN clubs c ON u.club_id = c.id
WHERE u.role = 'CLUB_PRESIDENT';
