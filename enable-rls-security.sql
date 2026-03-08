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
ALTER TABLE public.club_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictive_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
-- Users can only read their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT
    USING (auth.uid() = id OR auth.jwt() ->> 'role' = 'super_admin');

-- Users can update their own data
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE
    USING (auth.uid() = id OR auth.jwt() ->> 'role' = 'super_admin');

-- Only super admins can insert users
CREATE POLICY "Only admins can create users" ON public.users
    FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Only super admins can delete users
CREATE POLICY "Only admins can delete users" ON public.users
    FOR DELETE
    USING (auth.jwt() ->> 'role' = 'super_admin');

-- Create policies for clubs table
-- Everyone can view clubs
CREATE POLICY "Anyone can view clubs" ON public.clubs
    FOR SELECT
    USING (true);

-- Only club presidents and admins can update their clubs
CREATE POLICY "Presidents can update own club" ON public.clubs
    FOR UPDATE
    USING (
        auth.jwt() ->> 'role' = 'super_admin' OR
        auth.jwt() ->> 'role' = 'club_president' AND president_id = auth.uid()
    );

-- Only admins can create clubs
CREATE POLICY "Only admins can create clubs" ON public.clubs
    FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Only admins can delete clubs
CREATE POLICY "Only admins can delete clubs" ON public.clubs
    FOR DELETE
    USING (auth.jwt() ->> 'role' = 'super_admin');

-- Create policies for activities table
-- Everyone can view activities
CREATE POLICY "Anyone can view activities" ON public.activities
    FOR SELECT
    USING (true);

-- Club presidents can manage their club's activities
CREATE POLICY "Presidents can manage club activities" ON public.activities
    FOR ALL
    USING (
        auth.jwt() ->> 'role' = 'super_admin' OR
        (auth.jwt() ->> 'role' = 'club_president' AND 
         club_id IN (SELECT id FROM public.clubs WHERE president_id = auth.uid()))
    );

-- Create policies for applications table
-- Users can view their own applications
CREATE POLICY "Users can view own applications" ON public.applications
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        auth.jwt() ->> 'role' = 'super_admin' OR
        (auth.jwt() ->> 'role' = 'club_president' AND 
         club_id IN (SELECT id FROM public.clubs WHERE president_id = auth.uid()))
    );

-- Users can create applications
CREATE POLICY "Users can create applications" ON public.applications
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Presidents and admins can update applications
CREATE POLICY "Presidents can update applications" ON public.applications
    FOR UPDATE
    USING (
        auth.jwt() ->> 'role' = 'super_admin' OR
        (auth.jwt() ->> 'role' = 'club_president' AND 
         club_id IN (SELECT id FROM public.clubs WHERE president_id = auth.uid()))
    );

-- Create policies for sessions table
-- Users can only access their own sessions
CREATE POLICY "Users can view own sessions" ON public.sessions
    FOR SELECT
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "Users can delete own sessions" ON public.sessions
    FOR DELETE
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'super_admin');

-- Create policies for password_resets table
-- Users can only access their own password resets
CREATE POLICY "Users can view own password resets" ON public.password_resets
    FOR SELECT
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "Users can create password resets" ON public.password_resets
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Create policies for pending_registrations table
-- Only admins can view pending registrations
CREATE POLICY "Only admins can view pending registrations" ON public.pending_registrations
    FOR SELECT
    USING (auth.jwt() ->> 'role' = 'super_admin');

-- Anyone can create pending registration (for signup)
CREATE POLICY "Anyone can create pending registration" ON public.pending_registrations
    FOR INSERT
    WITH CHECK (true);

-- Create policies for audit_logs table
-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" ON public.audit_logs
    FOR SELECT
    USING (auth.jwt() ->> 'role' = 'super_admin');

-- System can insert audit logs
CREATE POLICY "System can create audit logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Create policies for user_coins table
-- Users can view their own coins
CREATE POLICY "Users can view own coins" ON public.user_coins
    FOR SELECT
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'super_admin');

-- Create policies for coin_transactions table
-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON public.coin_transactions
    FOR SELECT
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'super_admin');

-- Create policies for activity_participants table
-- Users can view participants of activities they're in
CREATE POLICY "Users can view activity participants" ON public.activity_participants
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        auth.jwt() ->> 'role' = 'super_admin' OR
        (auth.jwt() ->> 'role' = 'club_president' AND 
         activity_id IN (SELECT id FROM public.activities WHERE club_id IN 
            (SELECT id FROM public.clubs WHERE president_id = auth.uid())))
    );

-- Create policies for club_recommendations table
-- Users can view their own recommendations
CREATE POLICY "Users can view own recommendations" ON public.club_recommendations
    FOR SELECT
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'super_admin');

-- Create policies for chatbot_conversations table (if AI was used)
CREATE POLICY "Users can view own conversations" ON public.chatbot_conversations
    FOR SELECT
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'super_admin');

-- Create policies for application_analysis table (if AI was used)
CREATE POLICY "Admins can view application analysis" ON public.application_analysis
    FOR SELECT
    USING (auth.jwt() ->> 'role' = 'super_admin');

-- Create policies for predictive_analytics table (if AI was used)
CREATE POLICY "Admins can view predictive analytics" ON public.predictive_analytics
    FOR SELECT
    USING (auth.jwt() ->> 'role' = 'super_admin');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Revoke direct access from anon users (unauthenticated)
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
