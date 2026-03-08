-- TAU KAYS Database Initialization Script
-- This script initializes the complete database schema for the TAU Club and Activity Management System
-- 
-- Execution Order:
-- 1. Create database roles (01-create-roles.sql) - Already exists
-- 2. Create custom types (02-create-types.sql)
-- 3. Create tables (03-create-tables.sql)
-- 4. Create indexes (04-create-indexes.sql)
-- 5. Create functions (05-create-functions.sql)
-- 6. Create triggers (06-create-triggers.sql)
-- 7. Setup permissions (07-setup-permissions.sql)
-- 8. Seed development data (08-seed-data.sql)

-- This file serves as documentation and can be used to run all scripts in order
-- Individual scripts should be executed in the numbered order for proper initialization

\echo 'TAU KAYS Database Schema Creation Started...'

\echo 'Step 1: Database roles already created in 01-create-roles.sql'
\echo 'Step 2: Creating custom types...'
\i 02-create-types.sql

\echo 'Step 3: Creating tables...'
\i 03-create-tables.sql

\echo 'Step 4: Creating indexes...'
\i 04-create-indexes.sql

\echo 'Step 5: Creating functions...'
\i 05-create-functions.sql

\echo 'Step 6: Creating triggers...'
\i 06-create-triggers.sql

\echo 'Step 7: Setting up permissions...'
\i 07-setup-permissions.sql

\echo 'Step 8: Seeding development data...'
\i 08-seed-data.sql

\echo 'TAU KAYS Database Schema Creation Completed Successfully!'

-- Verify the schema by showing table counts
SELECT 
    'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 
    'clubs' as table_name, COUNT(*) as record_count FROM clubs
UNION ALL
SELECT 
    'activities' as table_name, COUNT(*) as record_count FROM activities
UNION ALL
SELECT 
    'applications' as table_name, COUNT(*) as record_count FROM applications
UNION ALL
SELECT 
    'audit_log' as table_name, COUNT(*) as record_count FROM audit_log
ORDER BY table_name;