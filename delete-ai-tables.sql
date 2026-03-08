-- Delete AI-related tables from Supabase
-- Run this in Supabase SQL Editor or use the delete-ai-tables.js script

-- Drop AI tables (CASCADE will also drop dependent objects)
DROP TABLE IF EXISTS ai_alerts CASCADE;
DROP TABLE IF EXISTS ai_interaction_logs CASCADE;
DROP TABLE IF EXISTS ai_rate_limits CASCADE;

-- Drop AI-related types (these are automatically created by tables)
-- The array types (_ai_*) will be dropped automatically with the base types
DROP TYPE IF EXISTS ai_alerts CASCADE;
DROP TYPE IF EXISTS ai_daily_cost_summary CASCADE;
DROP TYPE IF EXISTS ai_feature_usage_summary CASCADE;
DROP TYPE IF EXISTS ai_interaction_logs CASCADE;
DROP TYPE IF EXISTS ai_rate_limit_summary CASCADE;
DROP TYPE IF EXISTS ai_rate_limits CASCADE;

-- Verify deletion - this should return empty resulta
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND (tablename ILIKE '%ai%');

-- Check remaining types
SELECT typname 
FROM pg_type 
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND (typname ILIKE '%ai%');

-- Success message
SELECT 'AI tables and types deleted successfully!' as status;
