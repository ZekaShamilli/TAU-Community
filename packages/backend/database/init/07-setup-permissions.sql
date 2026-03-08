-- Set up role-based permissions for the TAU Community system
-- This script grants appropriate permissions to each role

-- Super Admin permissions - full access to all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO super_admin_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO super_admin_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO super_admin_role;

-- Club President permissions
-- Users table - can read own record and students who applied to their club
GRANT SELECT ON users TO club_president_role;
GRANT UPDATE (first_name, last_name, phone, password_hash, totp_secret, totp_enabled) ON users TO club_president_role;

-- Clubs table - can read all clubs, update only their own club
GRANT SELECT ON clubs TO club_president_role;
GRANT UPDATE (name, description) ON clubs TO club_president_role;

-- Activities table - full access to activities for their club
GRANT SELECT, INSERT, UPDATE, DELETE ON activities TO club_president_role;

-- Applications table - can read and update applications for their club
GRANT SELECT, UPDATE (status, reviewed_at, reviewed_by, review_comments) ON applications TO club_president_role;

-- Audit log - can read logs related to their club
GRANT SELECT ON audit_log TO club_president_role;

-- Grant sequence usage for inserts
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO club_president_role;

-- Grant function execution
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO club_president_role;

-- Student permissions - read-only access to public information
-- Users table - can read basic info for club presidents and other students
GRANT SELECT (id, first_name, last_name, role, is_active) ON users TO student_role;

-- Clubs table - can read all active clubs
GRANT SELECT ON clubs TO student_role;

-- Activities table - can read published activities
GRANT SELECT ON activities TO student_role;

-- Applications table - can insert new applications and read their own
GRANT SELECT, INSERT ON applications TO student_role;
GRANT UPDATE (motivation) ON applications TO student_role; -- Allow editing before review

-- Grant sequence usage for inserts
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO student_role;

-- Grant function execution for basic operations
GRANT EXECUTE ON FUNCTION current_user_id() TO student_role;
GRANT EXECUTE ON FUNCTION current_user_role() TO student_role;