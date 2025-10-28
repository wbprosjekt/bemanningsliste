-- Temporarily disable RLS for refusjon tables for testing
-- Run this in Supabase SQL Editor

-- Check current RLS status
SELECT 
    tablename, 
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = schemaname||'.'||tablename AND schemaname = 'public') as policy_count
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'ref_%'
ORDER BY tablename;

-- Disable RLS for all ref_ tables (testing only)
ALTER TABLE ref_energy_prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE ref_nett_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE ref_nett_windows DISABLE ROW LEVEL SECURITY;
ALTER TABLE ref_chargers DISABLE ROW LEVEL SECURITY;
ALTER TABLE ref_rfid_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE ref_employee_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE ref_employee_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE ref_sessions_raw DISABLE ROW LEVEL SECURITY;
ALTER TABLE ref_sessions_hourly DISABLE ROW LEVEL SECURITY;
ALTER TABLE ref_reimbursements DISABLE ROW LEVEL SECURITY;
ALTER TABLE ref_effect_tiers DISABLE ROW LEVEL SECURITY;

SELECT 'RLS disabled for all ref_ tables' as status;

