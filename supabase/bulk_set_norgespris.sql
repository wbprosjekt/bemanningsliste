-- Bulk set all employees with module access to norgespris policy
-- Run this in Supabase SQL Editor if you want to set norgespris for all

-- First, get your org_id (replace with your actual org_id)
-- You can find it in: SELECT id FROM org;

-- Set norgespris for all current profiles (adjust org_id)
INSERT INTO ref_employee_settings (
  org_id,
  profile_id,
  policy,
  default_area,
  fastpris_nok_per_kwh,
  terskel_nok_per_kwh,
  stotte_andel,
  effective_from,
  effective_to
)
SELECT 
  profiles.org_id,
  profiles.id as profile_id,
  'norgespris' as policy,
  'NO1' as default_area,
  0.50 as fastpris_nok_per_kwh,
  0.75 as terskel_nok_per_kwh,
  0.9 as stotte_andel,
  CURRENT_DATE as effective_from,
  NULL as effective_to
FROM profiles
WHERE profiles.org_id = '<YOUR_ORG_ID_HERE>' -- Replace this!
  AND profiles.user_id IS NOT NULL -- Only users with login
  AND profiles.id IN (
    -- Only profiles with module access enabled
    SELECT profile_id 
    FROM profile_modules 
    WHERE module_name = 'refusjon_hjemmelading' 
    AND enabled = true
  )
  AND NOT EXISTS (
    -- Don't duplicate existing settings
    SELECT 1 FROM ref_employee_settings 
    WHERE profile_id = profiles.id 
    AND effective_to IS NULL
  );


