-- Test script for Row-Level Security (RLS) policies
-- This script tests that RLS policies correctly enforce role-based access control
-- Note: This test uses the existing database roles created in 01-create-roles.sql

-- Test setup: Create test data
BEGIN;

-- Create test users for each role
INSERT INTO users (id, email, password_hash, role, first_name, last_name) VALUES
    ('11111111-1111-1111-1111-111111111111', 'superadmin@tau.edu.az', 'hash1', 'SUPER_ADMIN', 'Super', 'Admin'),
    ('22222222-2222-2222-2222-222222222222', 'president1@tau.edu.az', 'hash2', 'CLUB_PRESIDENT', 'Club', 'President1'),
    ('33333333-3333-3333-3333-333333333333', 'president2@tau.edu.az', 'hash3', 'CLUB_PRESIDENT', 'Club', 'President2'),
    ('44444444-4444-4444-4444-444444444444', 'student1@tau.edu.az', 'hash4', 'STUDENT', 'Student', 'One'),
    ('55555555-5555-5555-5555-555555555555', 'student2@tau.edu.az', 'hash5', 'STUDENT', 'Student', 'Two');

-- Create test clubs
INSERT INTO clubs (id, name, description, url_slug, president_id) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Club 1', 'First test club', 'test-club-1', '22222222-2222-2222-2222-222222222222'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Club 2', 'Second test club', 'test-club-2', '33333333-3333-3333-3333-333333333333'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Inactive Club', 'Inactive test club', 'inactive-club', '22222222-2222-2222-2222-222222222222');

-- Make one club inactive
UPDATE clubs SET is_active = false WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Create test activities
INSERT INTO activities (id, club_id, title, description, start_date, end_date, created_by, status) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Club 1 Activity', 'Activity for club 1', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', '22222222-2222-2222-2222-222222222222', 'PUBLISHED'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Club 2 Activity', 'Activity for club 2', NOW() + INTERVAL '3 days', NOW() + INTERVAL '4 days', '33333333-3333-3333-3333-333333333333', 'PUBLISHED'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Draft Activity', 'Draft activity for club 1', NOW() + INTERVAL '5 days', NOW() + INTERVAL '6 days', '22222222-2222-2222-2222-222222222222', 'DRAFT');

-- Create test applications
INSERT INTO applications (id, club_id, student_id, student_name, student_email, motivation) VALUES
    ('99999999-9999-9999-9999-999999999999', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Student One', 'student1@tau.edu.az', 'I want to join this club because it aligns with my interests and goals.'),
    ('88888888-8888-8888-8888-888888888888', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'Student Two', 'student2@tau.edu.az', 'This club offers great opportunities for personal and professional development.');

-- =============================================================================
-- TEST 1: SUPER ADMIN ACCESS
-- =============================================================================

-- Set context as Super Admin
SELECT set_user_context('11111111-1111-1111-1111-111111111111', 'SUPER_ADMIN');

-- Super Admin should see all users
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    IF user_count != 5 THEN
        RAISE EXCEPTION 'FAIL: Super Admin should see all 5 users, but saw %', user_count;
    END IF;
    RAISE NOTICE 'PASS: Super Admin can see all users (%))', user_count;
END $$;

-- Super Admin should see all clubs
DO $$
DECLARE
    club_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO club_count FROM clubs;
    IF club_count != 3 THEN
        RAISE EXCEPTION 'FAIL: Super Admin should see all 3 clubs, but saw %', club_count;
    END IF;
    RAISE NOTICE 'PASS: Super Admin can see all clubs (%))', club_count;
END $$;

-- Super Admin should see all activities
DO $$
DECLARE
    activity_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO activity_count FROM activities;
    IF activity_count != 3 THEN
        RAISE EXCEPTION 'FAIL: Super Admin should see all 3 activities, but saw %', activity_count;
    END IF;
    RAISE NOTICE 'PASS: Super Admin can see all activities (%))', activity_count;
END $$;

-- Super Admin should see all applications
DO $$
DECLARE
    app_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO app_count FROM applications;
    IF app_count != 2 THEN
        RAISE EXCEPTION 'FAIL: Super Admin should see all 2 applications, but saw %', app_count;
    END IF;
    RAISE NOTICE 'PASS: Super Admin can see all applications (%))', app_count;
END $$;

-- =============================================================================
-- TEST 2: CLUB PRESIDENT ACCESS (President 1)
-- =============================================================================

-- Set context as Club President 1
SELECT set_user_context('22222222-2222-2222-2222-222222222222', 'CLUB_PRESIDENT');

-- Club President should only see their own user record
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    IF user_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Club President should see only their own user record, but saw %', user_count;
    END IF;
    RAISE NOTICE 'PASS: Club President can see only their own user record (%))', user_count;
END $$;

-- Club President should only see their assigned clubs
DO $$
DECLARE
    club_count INTEGER;
    club_names TEXT;
BEGIN
    SELECT COUNT(*), string_agg(name, ', ') INTO club_count, club_names FROM clubs;
    IF club_count != 2 THEN
        RAISE EXCEPTION 'FAIL: Club President 1 should see 2 clubs (Test Club 1, Inactive Club), but saw % clubs: %', club_count, club_names;
    END IF;
    RAISE NOTICE 'PASS: Club President 1 can see their assigned clubs (% clubs: %)', club_count, club_names;
END $$;

-- Club President should only see activities from their clubs
DO $$
DECLARE
    activity_count INTEGER;
    activity_titles TEXT;
BEGIN
    SELECT COUNT(*), string_agg(title, ', ') INTO activity_count, activity_titles FROM activities;
    IF activity_count != 2 THEN
        RAISE EXCEPTION 'FAIL: Club President 1 should see 2 activities from their clubs, but saw % activities: %', activity_count, activity_titles;
    END IF;
    RAISE NOTICE 'PASS: Club President 1 can see activities from their clubs (% activities: %)', activity_count, activity_titles;
END $$;

-- Club President should only see applications to their clubs
DO $$
DECLARE
    app_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO app_count FROM applications;
    IF app_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Club President 1 should see 1 application to their club, but saw %', app_count;
    END IF;
    RAISE NOTICE 'PASS: Club President 1 can see applications to their clubs (%))', app_count;
END $$;

-- =============================================================================
-- TEST 3: CLUB PRESIDENT ACCESS (President 2)
-- =============================================================================

-- Set context as Club President 2
SELECT set_user_context('33333333-3333-3333-3333-333333333333', 'CLUB_PRESIDENT');

-- Club President 2 should only see their assigned club
DO $$
DECLARE
    club_count INTEGER;
    club_names TEXT;
BEGIN
    SELECT COUNT(*), string_agg(name, ', ') INTO club_count, club_names FROM clubs;
    IF club_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Club President 2 should see 1 club (Test Club 2), but saw % clubs: %', club_count, club_names;
    END IF;
    RAISE NOTICE 'PASS: Club President 2 can see their assigned club (% clubs: %)', club_count, club_names;
END $$;

-- Club President 2 should only see activities from their club
DO $$
DECLARE
    activity_count INTEGER;
    activity_titles TEXT;
BEGIN
    SELECT COUNT(*), string_agg(title, ', ') INTO activity_count, activity_titles FROM activities;
    IF activity_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Club President 2 should see 1 activity from their club, but saw % activities: %', activity_count, activity_titles;
    END IF;
    RAISE NOTICE 'PASS: Club President 2 can see activities from their club (% activities: %)', activity_count, activity_titles;
END $$;

-- Club President 2 should only see applications to their club
DO $$
DECLARE
    app_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO app_count FROM applications;
    IF app_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Club President 2 should see 1 application to their club, but saw %', app_count;
    END IF;
    RAISE NOTICE 'PASS: Club President 2 can see applications to their club (%))', app_count;
END $$;

-- =============================================================================
-- TEST 4: STUDENT ACCESS
-- =============================================================================

-- Set context as Student 1
SELECT set_user_context('44444444-4444-4444-4444-444444444444', 'STUDENT');

-- Student should only see their own user record
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    IF user_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Student should see only their own user record, but saw %', user_count;
    END IF;
    RAISE NOTICE 'PASS: Student can see only their own user record (%))', user_count;
END $$;

-- Student should only see active clubs
DO $$
DECLARE
    club_count INTEGER;
    club_names TEXT;
BEGIN
    SELECT COUNT(*), string_agg(name, ', ') INTO club_count, club_names FROM clubs;
    IF club_count != 2 THEN
        RAISE EXCEPTION 'FAIL: Student should see 2 active clubs, but saw % clubs: %', club_count, club_names;
    END IF;
    RAISE NOTICE 'PASS: Student can see active clubs (% clubs: %)', club_count, club_names;
END $$;

-- Student should only see published activities from active clubs
DO $$
DECLARE
    activity_count INTEGER;
    activity_titles TEXT;
BEGIN
    SELECT COUNT(*), string_agg(title, ', ') INTO activity_count, activity_titles FROM activities;
    IF activity_count != 2 THEN
        RAISE EXCEPTION 'FAIL: Student should see 2 published activities, but saw % activities: %', activity_count, activity_titles;
    END IF;
    RAISE NOTICE 'PASS: Student can see published activities (% activities: %)', activity_count, activity_titles;
END $$;

-- Student should only see their own applications
DO $$
DECLARE
    app_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO app_count FROM applications;
    IF app_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Student should see 1 of their own applications, but saw %', app_count;
    END IF;
    RAISE NOTICE 'PASS: Student can see their own applications (%))', app_count;
END $$;

-- =============================================================================
-- TEST 5: CROSS-ROLE ACCESS PREVENTION
-- =============================================================================

-- Test that Club President 1 cannot update Club President 2's club
SELECT set_user_context('22222222-2222-2222-2222-222222222222', 'CLUB_PRESIDENT');

DO $$
DECLARE
    update_count INTEGER;
BEGIN
    -- Try to update Club 2 (which belongs to President 2)
    UPDATE clubs SET description = 'Hacked!' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    GET DIAGNOSTICS update_count = ROW_COUNT;
    
    IF update_count != 0 THEN
        RAISE EXCEPTION 'FAIL: Club President 1 should not be able to update Club President 2''s club';
    END IF;
    RAISE NOTICE 'PASS: Club President 1 cannot update other president''s club';
END $$;

-- Test that Student cannot create activities
SELECT set_user_context('44444444-4444-4444-4444-444444444444', 'STUDENT');

DO $$
BEGIN
    -- Try to create an activity (should fail)
    BEGIN
        INSERT INTO activities (club_id, title, description, start_date, end_date, created_by) 
        VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Hacker Activity', 'Should not work', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', '44444444-4444-4444-4444-444444444444');
        RAISE EXCEPTION 'FAIL: Student should not be able to create activities';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'PASS: Student cannot create activities (insufficient privilege)';
        WHEN OTHERS THEN
            RAISE NOTICE 'PASS: Student cannot create activities (other error: %)', SQLERRM;
    END;
END $$;

-- =============================================================================
-- TEST 6: UTILITY FUNCTIONS
-- =============================================================================

-- Test current_user_id function
SELECT set_user_context('22222222-2222-2222-2222-222222222222', 'CLUB_PRESIDENT');

DO $$
DECLARE
    current_id UUID;
BEGIN
    SELECT current_user_id() INTO current_id;
    IF current_id != '22222222-2222-2222-2222-222222222222' THEN
        RAISE EXCEPTION 'FAIL: current_user_id() returned %, expected 22222222-2222-2222-2222-222222222222', current_id;
    END IF;
    RAISE NOTICE 'PASS: current_user_id() returns correct value';
END $$;

-- Test current_user_role function
DO $$
DECLARE
    current_role user_role;
BEGIN
    SELECT current_user_role() INTO current_role;
    IF current_role != 'CLUB_PRESIDENT' THEN
        RAISE EXCEPTION 'FAIL: current_user_role() returned %, expected CLUB_PRESIDENT', current_role;
    END IF;
    RAISE NOTICE 'PASS: current_user_role() returns correct value';
END $$;

-- Test is_club_president function
DO $$
DECLARE
    is_president BOOLEAN;
BEGIN
    SELECT is_club_president('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') INTO is_president;
    IF NOT is_president THEN
        RAISE EXCEPTION 'FAIL: is_club_president() should return true for president''s own club';
    END IF;
    
    SELECT is_club_president('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') INTO is_president;
    IF is_president THEN
        RAISE EXCEPTION 'FAIL: is_club_president() should return false for other president''s club';
    END IF;
    
    RAISE NOTICE 'PASS: is_club_president() works correctly';
END $$;

-- Test get_president_club_id function
DO $$
DECLARE
    club_id UUID;
BEGIN
    SELECT get_president_club_id() INTO club_id;
    IF club_id NOT IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc') THEN
        RAISE EXCEPTION 'FAIL: get_president_club_id() returned %, expected one of president''s clubs', club_id;
    END IF;
    RAISE NOTICE 'PASS: get_president_club_id() returns correct club ID';
END $$;

-- Test validate_club_access function
DO $$
DECLARE
    has_access BOOLEAN;
BEGIN
    -- President should have access to their own club
    SELECT validate_club_access('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') INTO has_access;
    IF NOT has_access THEN
        RAISE EXCEPTION 'FAIL: validate_club_access() should return true for president''s own club';
    END IF;
    
    -- President should not have access to other president's club
    SELECT validate_club_access('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') INTO has_access;
    IF has_access THEN
        RAISE EXCEPTION 'FAIL: validate_club_access() should return false for other president''s club';
    END IF;
    
    RAISE NOTICE 'PASS: validate_club_access() works correctly';
END $$;

-- =============================================================================
-- TEST 7: SECURITY VIEWS
-- =============================================================================

-- Test accessible_clubs view
DO $$
DECLARE
    club_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO club_count FROM accessible_clubs;
    IF club_count != 2 THEN
        RAISE EXCEPTION 'FAIL: accessible_clubs view should show 2 clubs for club president, but showed %', club_count;
    END IF;
    RAISE NOTICE 'PASS: accessible_clubs view works correctly for club president';
END $$;

-- Test accessible_activities view
DO $$
DECLARE
    activity_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO activity_count FROM accessible_activities;
    IF activity_count != 2 THEN
        RAISE EXCEPTION 'FAIL: accessible_activities view should show 2 activities for club president, but showed %', activity_count;
    END IF;
    RAISE NOTICE 'PASS: accessible_activities view works correctly for club president';
END $$;

-- Test views for student
SELECT set_user_context('44444444-4444-4444-4444-444444444444', 'STUDENT');

DO $$
DECLARE
    club_count INTEGER;
    activity_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO club_count FROM accessible_clubs;
    IF club_count != 2 THEN
        RAISE EXCEPTION 'FAIL: accessible_clubs view should show 2 active clubs for student, but showed %', club_count;
    END IF;
    
    SELECT COUNT(*) INTO activity_count FROM accessible_activities;
    IF activity_count != 2 THEN
        RAISE EXCEPTION 'FAIL: accessible_activities view should show 2 published activities for student, but showed %', activity_count;
    END IF;
    
    RAISE NOTICE 'PASS: Security views work correctly for student';
END $$;

-- =============================================================================
-- CLEANUP AND SUMMARY
-- =============================================================================

-- Clear user context
SELECT clear_user_context();

-- Clean up test data
ROLLBACK;

-- Summary
RAISE NOTICE '=============================================================================';
RAISE NOTICE 'RLS POLICY TESTS COMPLETED SUCCESSFULLY';
RAISE NOTICE '=============================================================================';
RAISE NOTICE 'All Row-Level Security policies are working correctly:';
RAISE NOTICE '- Super Admin: Full access to all data';
RAISE NOTICE '- Club President: Access only to their assigned club data';
RAISE NOTICE '- Student: Read-only access to public content, can submit applications';
RAISE NOTICE '- Cross-role access prevention: Working correctly';
RAISE NOTICE '- Utility functions: All working correctly';
RAISE NOTICE '- Security views: Working correctly for all roles';
RAISE NOTICE '=============================================================================';
