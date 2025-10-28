-- Fix profile_modules to reference person instead of profiles
-- Similar to ref_employee_settings fix

-- Drop the existing foreign key constraint
ALTER TABLE profile_modules
DROP CONSTRAINT IF EXISTS profile_modules_profile_id_fkey;

-- Recreate foreign key pointing to person table
ALTER TABLE profile_modules
ADD CONSTRAINT profile_modules_profile_id_fkey
FOREIGN KEY (profile_id) REFERENCES public.person(id) ON DELETE CASCADE;

-- Update unique index to match
DROP INDEX IF EXISTS idx_profile_modules_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_modules_unique ON profile_modules(profile_id, module_name);

SELECT 'Foreign key updated to point to person table' as status;


