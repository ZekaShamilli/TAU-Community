-- Schema Verification Script for TAU Community Database
-- This script verifies that all database objects have been created correctly

\echo 'Starting TAU Community Database Schema Verification...'

-- Check if custom types exist
\echo 'Checking custom types...'
SELECT 
    typname as type_name,
    array_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE typname IN ('user_role', 'activity_status', 'application_status')
GROUP BY typname
ORDER BY typname;

-- Check if all tables exist with correct structure
\echo 'Checking table structure...'
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN ('users', 'clubs', 'activities', 'applications', 'audit_log')
ORDER BY table_name, ordinal_position;

-- Check foreign key constraints
\echo 'Checking foreign key constraints...'
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- Check indexes
\echo 'Checking indexes...'
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'clubs', 'activities', 'applications', 'audit_log')
ORDER BY tablename, indexname;

-- Check functions
\echo 'Checking functions...'
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name IN (
        'current_user_id', 
        'current_user_role', 
        'is_club_president', 
        'get_president_club_id',
        'generate_url_slug',
        'update_updated_at_column',
        'update_activity_status'
    )
ORDER BY routine_name;

-- Check triggers
\echo 'Checking triggers...'
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Check role permissions
\echo 'Checking role permissions...'
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
    AND grantee IN ('super_admin_role', 'club_president_role', 'student_role')
ORDER BY grantee, table_name, privilege_type;

-- Test data verification
\echo 'Checking seed data...'
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'clubs' as table_name, COUNT(*) as record_count FROM clubs
UNION ALL
SELECT 'activities' as table_name, COUNT(*) as record_count FROM activities
UNION ALL
SELECT 'applications' as table_name, COUNT(*) as record_count FROM applications
UNION ALL
SELECT 'audit_log' as table_name, COUNT(*) as record_count FROM audit_log
ORDER BY table_name;

-- Test URL slug generation function
\echo 'Testing URL slug generation...'
SELECT 
    'TAU Robotics Club' as original_name,
    generate_url_slug('TAU Robotics Club') as generated_slug
UNION ALL
SELECT 
    'Müzik Kulübü (Çok Güzel)' as original_name,
    generate_url_slug('Müzik Kulübü (Çok Güzel)') as generated_slug
UNION ALL
SELECT 
    'Öğrenci Şenliği & Etkinlik Grubu' as original_name,
    generate_url_slug('Öğrenci Şenliği & Etkinlik Grubu') as generated_slug;

-- Test constraint validations
\echo 'Testing constraint validations...'
-- This will show constraint names and their definitions
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid IN (
    SELECT oid FROM pg_class 
    WHERE relname IN ('users', 'clubs', 'activities', 'applications', 'audit_log')
)
AND contype IN ('c', 'f', 'u') -- check, foreign key, unique constraints
ORDER BY conrelid::regclass, conname;

\echo 'TAU Community Database Schema Verification Completed!'
\echo 'If all queries returned expected results, the schema is properly configured.'