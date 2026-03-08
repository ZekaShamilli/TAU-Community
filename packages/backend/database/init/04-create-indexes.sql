-- Create indexes for optimal query performance
-- This script creates indexes on frequently queried columns and foreign keys

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Clubs table indexes  
CREATE INDEX idx_clubs_name ON clubs(name);
CREATE INDEX idx_clubs_url_slug ON clubs(url_slug);
CREATE INDEX idx_clubs_president_id ON clubs(president_id);
CREATE INDEX idx_clubs_is_active ON clubs(is_active);
CREATE INDEX idx_clubs_created_at ON clubs(created_at);

-- Activities table indexes
CREATE INDEX idx_activities_club_id ON activities(club_id);
CREATE INDEX idx_activities_created_by ON activities(created_by);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_start_date ON activities(start_date);
CREATE INDEX idx_activities_end_date ON activities(end_date);
CREATE INDEX idx_activities_created_at ON activities(created_at);
-- Composite index for club activities ordered by date
CREATE INDEX idx_activities_club_date ON activities(club_id, start_date DESC);
-- Index for finding activities by date range
CREATE INDEX idx_activities_date_range ON activities(start_date, end_date);

-- Applications table indexes
CREATE INDEX idx_applications_club_id ON applications(club_id);
CREATE INDEX idx_applications_student_id ON applications(student_id);
CREATE INDEX idx_applications_student_email ON applications(student_email);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_submitted_at ON applications(submitted_at);
CREATE INDEX idx_applications_reviewed_by ON applications(reviewed_by);
-- Composite index for club applications by status and date
CREATE INDEX idx_applications_club_status_date ON applications(club_id, status, submitted_at DESC);

-- Audit log table indexes
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_user_role ON audit_log(user_role);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource ON audit_log(resource);
CREATE INDEX idx_audit_log_resource_id ON audit_log(resource_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_success ON audit_log(success);
-- Composite index for user activity logs
CREATE INDEX idx_audit_log_user_timestamp ON audit_log(user_id, timestamp DESC);
-- Composite index for resource-specific logs
CREATE INDEX idx_audit_log_resource_timestamp ON audit_log(resource, resource_id, timestamp DESC);
-- Index for IP-based analysis
CREATE INDEX idx_audit_log_ip_timestamp ON audit_log(ip_address, timestamp DESC);