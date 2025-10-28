-- Fix RLS policies for ref_nett_profiles
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS ref_nett_profiles_select ON ref_nett_profiles;
DROP POLICY IF EXISTS ref_nett_profiles_insert ON ref_nett_profiles;
DROP POLICY IF EXISTS ref_nett_profiles_update ON ref_nett_profiles;
DROP POLICY IF EXISTS ref_nett_profiles_delete ON ref_nett_profiles;

-- CREATE policies with correct syntax
CREATE POLICY ref_nett_profiles_select ON ref_nett_profiles FOR SELECT
  USING (true);

CREATE POLICY ref_nett_profiles_insert ON ref_nett_profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY ref_nett_profiles_update ON ref_nett_profiles FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY ref_nett_profiles_delete ON ref_nett_profiles FOR DELETE
  USING (true);

-- Fix TOU windows too
DROP POLICY IF EXISTS ref_nett_windows_select ON ref_nett_windows;
DROP POLICY IF EXISTS ref_nett_windows_insert ON ref_nett_windows;
DROP POLICY IF EXISTS ref_nett_windows_update ON ref_nett_windows;
DROP POLICY IF EXISTS ref_nett_windows_delete ON ref_nett_windows;

CREATE POLICY ref_nett_windows_select ON ref_nett_windows FOR SELECT
  USING (true);

CREATE POLICY ref_nett_windows_insert ON ref_nett_windows FOR INSERT
  WITH CHECK (true);

CREATE POLICY ref_nett_windows_update ON ref_nett_windows FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY ref_nett_windows_delete ON ref_nett_windows FOR DELETE
  USING (true);


