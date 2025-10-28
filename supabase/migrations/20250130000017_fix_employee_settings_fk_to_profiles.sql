-- Fix ref_employee_settings.profile_id to reference profiles.id instead of person.id

-- Drop existing foreign key constraint
ALTER TABLE ref_employee_settings
DROP CONSTRAINT IF EXISTS ref_employee_settings_profile_id_fkey;

-- Delete existing settings that point to person.id values
DELETE FROM ref_employee_settings
WHERE profile_id NOT IN (SELECT id FROM profiles);

-- Recreate foreign key pointing to profiles table (NOT person)
ALTER TABLE ref_employee_settings
ADD CONSTRAINT ref_employee_settings_profile_id_fkey
FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

SELECT 'Employee settings FK updated to point to profiles table' as status;


