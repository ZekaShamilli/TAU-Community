-- Create database roles for RBAC
-- This script runs during PostgreSQL container initialization

-- Create roles for different user types
CREATE ROLE super_admin_role;
CREATE ROLE club_president_role;
CREATE ROLE student_role;

-- Grant basic connection privileges
GRANT CONNECT ON DATABASE tau_kays TO super_admin_role;
GRANT CONNECT ON DATABASE tau_kays TO club_president_role;
GRANT CONNECT ON DATABASE tau_kays TO student_role;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO super_admin_role;
GRANT USAGE ON SCHEMA public TO club_president_role;
GRANT USAGE ON SCHEMA public TO student_role;

-- Create application users with roles
CREATE USER tau_kays_super_admin WITH PASSWORD 'super_admin_password';
CREATE USER tau_kays_club_president WITH PASSWORD 'club_president_password';
CREATE USER tau_kays_student WITH PASSWORD 'student_password';

-- Assign roles to users
GRANT super_admin_role TO tau_kays_super_admin;
GRANT club_president_role TO tau_kays_club_president;
GRANT student_role TO tau_kays_student;

-- Enable Row Level Security by default
ALTER DATABASE tau_kays SET row_security = on;