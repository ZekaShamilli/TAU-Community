-- Row-Level Security (RLS) policies for the TAU Community system
-- This script implements RLS policies for role-based access control
-- Note: Database roles are created in 01-create-roles.sql

-- Enable Row-Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- USERS TABLE RLS POLICIES
-- =============================================================================

-- Super Admin: Full access to all users
CREATE POLICY super_admin_users_all ON users
    FOR ALL TO super_admin_role
    USING (true)
    WITH CHECK (true);

-- Club President: Can read their own user record and update limited fields
CREATE POLICY club_president_users_own ON users
    FOR SELECT TO club_president_role
    USING (id = current_user_id());

CREATE POLICY club_president_users_update ON users
    FOR UPDATE TO club_president_role
    USING (id = current_user_id())
    WITH CHECK (id = current_user_id());

-- Student: Can read their own user record (if they have one)
CREATE POLICY student_users_own ON users
    FOR SELECT TO student_role
    USING (id = current_user_id());

-- =============================================================================
-- CLUBS TABLE RLS POLICIES
-- =============================================================================

-- Super Admin: Full access to all clubs
CREATE POLICY super_admin_clubs_all ON clubs
    FOR ALL TO super_admin_role
    USING (true)
    WITH CHECK (true);

-- Club President: Can read and update only their assigned club
CREATE POLICY club_president_clubs_own ON clubs
    FOR SELECT TO club_president_role
    USING (president_id = current_user_id());

CREATE POLICY club_president_clubs_update ON clubs
    FOR UPDATE TO club_president_role
    USING (president_id = current_user_id())
    WITH CHECK (president_id = current_user_id());

-- Student: Can read all active clubs (public information)
CREATE POLICY student_clubs_read ON clubs
    FOR SELECT TO student_role
    USING (is_active = true);

-- =============================================================================
-- ACTIVITIES TABLE RLS POLICIES
-- =============================================================================

-- Super Admin: Full access to all activities
CREATE POLICY super_admin_activities_all ON activities
    FOR ALL TO super_admin_role
    USING (true)
    WITH CHECK (true);

-- Club President: Can manage activities for their club only
CREATE POLICY club_president_activities_own_club ON activities
    FOR ALL TO club_president_role
    USING (club_id = get_president_club_id())
    WITH CHECK (club_id = get_president_club_id());

-- Student: Can read published activities from active clubs
CREATE POLICY student_activities_read ON activities
    FOR SELECT TO student_role
    USING (
        status = 'PUBLISHED' 
        AND club_id IN (SELECT id FROM clubs WHERE is_active = true)
    );

-- =============================================================================
-- APPLICATIONS TABLE RLS POLICIES
-- =============================================================================

-- Super Admin: Full access to all applications
CREATE POLICY super_admin_applications_all ON applications
    FOR ALL TO super_admin_role
    USING (true)
    WITH CHECK (true);

-- Club President: Can read and manage applications for their club
CREATE POLICY club_president_applications_own_club ON applications
    FOR SELECT TO club_president_role
    USING (club_id = get_president_club_id());

CREATE POLICY club_president_applications_update ON applications
    FOR UPDATE TO club_president_role
    USING (club_id = get_president_club_id())
    WITH CHECK (club_id = get_president_club_id());

-- Student: Can create applications and read their own applications
CREATE POLICY student_applications_create ON applications
    FOR INSERT TO student_role
    WITH CHECK (
        club_id IN (SELECT id FROM clubs WHERE is_active = true)
        AND (student_id IS NULL OR student_id = current_user_id())
    );

CREATE POLICY student_applications_own ON applications
    FOR SELECT TO student_role
    USING (
        student_id = current_user_id() 
        OR (student_id IS NULL AND student_email = current_setting('app.current_user_email', true))
    );

-- =============================================================================
-- AUDIT_LOG TABLE RLS POLICIES
-- =============================================================================

-- Super Admin: Full access to all audit logs
CREATE POLICY super_admin_audit_all ON audit_log
    FOR ALL TO super_admin_role
    USING (true)
    WITH CHECK (true);

-- Club President: Can read audit logs related to their club and their own actions
CREATE POLICY club_president_audit_read ON audit_log
    FOR SELECT TO club_president_role
    USING (
        user_id = current_user_id()
        OR (
            resource IN ('clubs', 'activities', 'applications')
            AND resource_id IN (
                -- Their club
                SELECT get_president_club_id()
                UNION
                -- Activities from their club
                SELECT id FROM activities WHERE club_id = get_president_club_id()
                UNION
                -- Applications to their club
                SELECT id FROM applications WHERE club_id = get_president_club_id()
            )
        )
    );

-- Student: Can read their own audit logs only
CREATE POLICY student_audit_own ON audit_log
    FOR SELECT TO student_role
    USING (user_id = current_user_id());

-- =============================================================================
-- ADDITIONAL SECURITY FUNCTIONS
-- =============================================================================

-- Function to set user context for RLS policies
-- This should be called by the application when establishing a database connection
CREATE OR REPLACE FUNCTION set_user_context(
    user_uuid UUID,
    user_role_param user_role,
    user_email_param TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Set session variables for RLS policies
    PERFORM set_config('app.current_user_id', user_uuid::TEXT, false);
    PERFORM set_config('app.current_user_role', user_role_param::TEXT, false);
    
    IF user_email_param IS NOT NULL THEN
        PERFORM set_config('app.current_user_email', user_email_param, false);
    END IF;
    
    -- Set the appropriate database role based on user role
    CASE user_role_param
        WHEN 'SUPER_ADMIN' THEN
            SET ROLE super_admin_role;
        WHEN 'CLUB_PRESIDENT' THEN
            SET ROLE club_president_role;
        WHEN 'STUDENT' THEN
            SET ROLE student_role;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear user context (for logout or session end)
CREATE OR REPLACE FUNCTION clear_user_context() RETURNS VOID AS $$
BEGIN
    -- Clear session variables
    PERFORM set_config('app.current_user_id', '', false);
    PERFORM set_config('app.current_user_role', '', false);
    PERFORM set_config('app.current_user_email', '', false);
    
    -- Reset to default role
    RESET ROLE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate user has permission for a specific club
CREATE OR REPLACE FUNCTION validate_club_access(club_uuid UUID) RETURNS BOOLEAN AS $$
BEGIN
    CASE current_user_role()
        WHEN 'SUPER_ADMIN' THEN
            RETURN true;
        WHEN 'CLUB_PRESIDENT' THEN
            RETURN is_club_president(club_uuid);
        WHEN 'STUDENT' THEN
            RETURN EXISTS (SELECT 1 FROM clubs WHERE id = club_uuid AND is_active = true);
        ELSE
            RETURN false;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get accessible clubs for current user
CREATE OR REPLACE FUNCTION get_accessible_clubs() RETURNS TABLE(club_id UUID) AS $$
BEGIN
    CASE current_user_role()
        WHEN 'SUPER_ADMIN' THEN
            RETURN QUERY SELECT id FROM clubs;
        WHEN 'CLUB_PRESIDENT' THEN
            RETURN QUERY SELECT id FROM clubs WHERE president_id = current_user_id();
        WHEN 'STUDENT' THEN
            RETURN QUERY SELECT id FROM clubs WHERE is_active = true;
        ELSE
            RETURN;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SECURITY VIEWS FOR APPLICATION USE
-- =============================================================================

-- View for accessible clubs based on current user role
CREATE OR REPLACE VIEW accessible_clubs AS
SELECT c.*
FROM clubs c
WHERE c.id IN (SELECT club_id FROM get_accessible_clubs());

-- View for accessible activities based on current user role
CREATE OR REPLACE VIEW accessible_activities AS
SELECT a.*
FROM activities a
WHERE 
    CASE current_user_role()
        WHEN 'SUPER_ADMIN' THEN true
        WHEN 'CLUB_PRESIDENT' THEN a.club_id = get_president_club_id()
        WHEN 'STUDENT' THEN 
            a.status = 'PUBLISHED' 
            AND a.club_id IN (SELECT id FROM clubs WHERE is_active = true)
        ELSE false
    END;

-- Grant permissions on views
GRANT SELECT ON accessible_clubs TO super_admin_role, club_president_role, student_role;
GRANT SELECT ON accessible_activities TO super_admin_role, club_president_role, student_role;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON FUNCTION set_user_context(UUID, user_role, TEXT) IS 
'Sets the user context for Row-Level Security policies. Must be called when establishing database connections.';

COMMENT ON FUNCTION clear_user_context() IS 
'Clears the user context and resets database role. Should be called on logout or session end.';

COMMENT ON FUNCTION validate_club_access(UUID) IS 
'Validates if the current user has access to a specific club based on their role.';

COMMENT ON FUNCTION get_accessible_clubs() IS 
'Returns the list of club IDs that the current user can access based on their role.';

COMMENT ON VIEW accessible_clubs IS 
'View that shows only the clubs accessible to the current user based on RLS policies.';

COMMENT ON VIEW accessible_activities IS 
'View that shows only the activities accessible to the current user based on RLS policies.';