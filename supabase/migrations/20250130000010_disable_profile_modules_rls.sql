-- Temporarily disable RLS for profile_modules for testing
-- This allows admins to toggle module access

-- Check current RLS status
SELECT 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'profile_modules';

-- Disable RLS temporarily
ALTER TABLE profile_modules DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS profile_modules_select ON profile_modules;
DROP POLICY IF EXISTS profile_modules_insert ON profile_modules;
DROP POLICY IF EXISTS profile_modules_update ON profile_modules;
DROP POLICY IF EXISTS profile_modules_delete ON profile_modules;

SELECT 'RLS disabled for profile_modules' as status;


