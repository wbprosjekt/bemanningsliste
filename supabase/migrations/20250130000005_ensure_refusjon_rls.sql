-- Ensure all RLS policies are set correctly
-- Run this in Supabase SQL Editor

-- First, check what exists
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'ref_%'
ORDER BY tablename, policyname;

-- Now drop ALL ref_* policies and recreate them properly
DO $$ 
BEGIN
  -- ref_energy_prices
  DROP POLICY IF EXISTS ref_energy_prices_select ON ref_energy_prices;
  DROP POLICY IF EXISTS ref_energy_prices_insert ON ref_energy_prices;
  DROP POLICY IF EXISTS ref_energy_prices_update ON ref_energy_prices;
  DROP POLICY IF EXISTS ref_energy_prices_delete ON ref_energy_prices;
END $$;

-- Recreate with correct syntax
CREATE POLICY ref_energy_prices_select ON ref_energy_prices FOR SELECT
  USING (true);

CREATE POLICY ref_energy_prices_insert ON ref_energy_prices FOR INSERT
  WITH CHECK (true);

CREATE POLICY ref_energy_prices_update ON ref_energy_prices FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY ref_energy_prices_delete ON ref_energy_prices FOR DELETE
  USING (true);

-- Also fix the other tables
DROP POLICY IF EXISTS ref_nett_profiles_select ON ref_nett_profiles;
DROP POLICY IF EXISTS ref_nett_profiles_insert ON ref_nett_profiles;
DROP POLICY IF EXISTS ref_nett_profiles_update ON ref_nett_profiles;
DROP POLICY IF EXISTS ref_nett_profiles_delete ON ref_nett_profiles;

CREATE POLICY ref_nett_profiles_select ON ref_nett_profiles FOR SELECT USING (true);
CREATE POLICY ref_nett_profiles_insert ON ref_nett_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY ref_nett_profiles_update ON ref_nett_profiles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY ref_nett_profiles_delete ON ref_nett_profiles FOR DELETE USING (true);

DROP POLICY IF EXISTS ref_nett_windows_select ON ref_nett_windows;
DROP POLICY IF EXISTS ref_nett_windows_insert ON ref_nett_windows;
DROP POLICY IF EXISTS ref_nett_windows_update ON ref_nett_windows;
DROP POLICY IF EXISTS ref_nett_windows_delete ON ref_nett_windows;

CREATE POLICY ref_nett_windows_select ON ref_nett_windows FOR SELECT USING (true);
CREATE POLICY ref_nett_windows_insert ON ref_nett_windows FOR INSERT WITH CHECK (true);
CREATE POLICY ref_nett_windows_update ON ref_nett_windows FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY ref_nett_windows_delete ON ref_nett_windows FOR DELETE USING (true);

-- Show what was created
SELECT 'ref_energy_prices' as table_name, policyname, cmd FROM pg_policies WHERE tablename = 'ref_energy_prices'
UNION ALL
SELECT 'ref_nett_profiles', policyname, cmd FROM pg_policies WHERE tablename = 'ref_nett_profiles'
UNION ALL
SELECT 'ref_nett_windows', policyname, cmd FROM pg_policies WHERE tablename = 'ref_nett_windows';


