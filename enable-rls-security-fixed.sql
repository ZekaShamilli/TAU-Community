-- CRITICAL SECURITY FIX: Enable Row Level Security (RLS) on all tables
-- This prevents unauthorized access to database tables via PostgREST API

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Enable RLS on additional tables if they exist
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'club_recommendations') THEN
        ALTER TABLE public.club_recommendations ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'activity_participants') THEN
        ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_coins') THEN
        ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'coin_transactions') THEN
        ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chatbot_conversations') THEN
        ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'application_analysis') THEN
        ALTER TABLE public.application_analysis ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'predictive_analytics') THEN
        ALTER TABLE public.predictive_analytics ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pending_registrations') THEN
        ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Only admins can create users" ON public.users;
DROP POLICY IF EXISTS "Only admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Anyone can view clubs" ON public.clubs;
DROP POLICY IF EXISTS "Presidents can update own club" ON public.clubs;
DROP POLICY IF EXISTS "Only admins can create clubs" ON public.clubs;
DROP POLICY IF EXISTS "Only admins can delete clubs" ON public.clubs;
DROP POLICY IF EXISTS "Anyone can view activities" ON public.activities;
DROP POLICY IF EXISTS "Presidents can manage club activities" ON public.activities;
DROP POLICY IF EXISTS "Users can view own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can create applications" ON public.applications;
DROP POLICY IF EXISTS "Presidents can update applications" ON public.applications;
DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can view own password resets" ON public.password_resets;
DROP POLICY IF EXISTS "Users can create password resets" ON public.password_resets;
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can create audit logs" ON public.audit_logs;

-- IMPORTANT: For now, we'll create permissive policies
-- These allow backend to work while still providing some protection
-- You should customize these based on your authentication setup

-- Users table policies - Allow backend service role full access
CREATE POLICY "Service role has full access to users" ON public.users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Clubs table policies - Public read, service role write
CREATE POLICY "Anyone can view clubs" ON public.clubs
    FOR SELECT
    USING (true);

CREATE POLICY "Service role can manage clubs" ON public.clubs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Activities table policies - Public read, service role write
CREATE POLICY "Anyone can view activities" ON public.activities
    FOR SELECT
    USING (true);

CREATE POLICY "Service role can manage activities" ON public.activities
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Applications table policies - Service role full access
CREATE POLICY "Service role can manage applications" ON public.applications
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Sessions table policies - Service role only
CREATE POLICY "Service role can manage sessions" ON public.sessions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Password resets table policies - Service role only
CREATE POLICY "Service role can manage password resets" ON public.password_resets
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Audit logs table policies - Service role only
CREATE POLICY "Service role can manage audit logs" ON public.audit_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Policies for optional tables
DO $$ 
BEGIN
    -- Activity participants
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'activity_participants') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Service role can manage activity participants" ON public.activity_participants';
        EXECUTE 'CREATE POLICY "Service role can manage activity participants" ON public.activity_participants FOR ALL USING (true) WITH CHECK (true)';
    END IF;
    
    -- User coins
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_coins') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Service role can manage user coins" ON public.user_coins';
        EXECUTE 'CREATE POLICY "Service role can manage user coins" ON public.user_coins FOR ALL USING (true) WITH CHECK (true)';
    END IF;
    
    -- Coin transactions
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'coin_transactions') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Service role can manage coin transactions" ON public.coin_transactions';
        EXECUTE 'CREATE POLICY "Service role can manage coin transactions" ON public.coin_transactions FOR ALL USING (true) WITH CHECK (true)';
    END IF;
    
    -- Club recommendations
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'club_recommendations') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Service role can manage club recommendations" ON public.club_recommendations';
        EXECUTE 'CREATE POLICY "Service role can manage club recommendations" ON public.club_recommendations FOR ALL USING (true) WITH CHECK (true)';
    END IF;
    
    -- Chatbot conversations
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chatbot_conversations') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Service role can manage chatbot conversations" ON public.chatbot_conversations';
        EXECUTE 'CREATE POLICY "Service role can manage chatbot conversations" ON public.chatbot_conversations FOR ALL USING (true) WITH CHECK (true)';
    END IF;
    
    -- Application analysis
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'application_analysis') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Service role can manage application analysis" ON public.application_analysis';
        EXECUTE 'CREATE POLICY "Service role can manage application analysis" ON public.application_analysis FOR ALL USING (true) WITH CHECK (true)';
    END IF;
    
    -- Predictive analytics
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'predictive_analytics') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Service role can manage predictive analytics" ON public.predictive_analytics';
        EXECUTE 'CREATE POLICY "Service role can manage predictive analytics" ON public.predictive_analytics FOR ALL USING (true) WITH CHECK (true)';
    END IF;
    
    -- Pending registrations - Allow inserts for signup
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pending_registrations') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can create pending registration" ON public.pending_registrations';
        EXECUTE 'DROP POLICY IF EXISTS "Service role can manage pending registrations" ON public.pending_registrations';
        EXECUTE 'CREATE POLICY "Anyone can create pending registration" ON public.pending_registrations FOR INSERT WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "Service role can manage pending registrations" ON public.pending_registrations FOR ALL USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- Grant necessary permissions to service role
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Revoke direct access from anon and authenticated roles (they should go through backend)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Allow anon to insert into pending_registrations for signup
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pending_registrations') THEN
        EXECUTE 'GRANT INSERT ON public.pending_registrations TO anon';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'RLS enabled successfully on all tables!';
    RAISE NOTICE 'Backend should use service_role key for database access';
    RAISE NOTICE 'Direct PostgREST API access is now restricted';
END $$;
