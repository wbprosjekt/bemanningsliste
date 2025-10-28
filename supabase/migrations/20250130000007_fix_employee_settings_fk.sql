-- Fix employee_settings foreign key to use person instead of profiles
-- Run this in Supabase SQL Editor

-- Drop the old constraint
ALTER TABLE ref_employee_settings 
  DROP CONSTRAINT IF EXISTS ref_employee_settings_profile_id_fkey;

-- Add new constraint pointing to person table
ALTER TABLE ref_employee_settings 
  ADD CONSTRAINT ref_employee_settings_profile_id_fkey 
  FOREIGN KEY (profile_id) 
  REFERENCES person(id) 
  ON DELETE CASCADE;

SELECT 'Foreign key updated to point to person table' as status;


