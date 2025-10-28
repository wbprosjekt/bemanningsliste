-- Change profile_modules to use profiles(id) instead of person(id)
-- This makes more sense because profiles is linked to auth.users

-- Drop the existing foreign key constraint
ALTER TABLE profile_modules
DROP CONSTRAINT IF EXISTS profile_modules_profile_id_fkey;

-- Drop unique index
DROP INDEX IF EXISTS idx_profile_modules_unique;

-- Recreate foreign key pointing to profiles table
ALTER TABLE profile_modules
ADD CONSTRAINT profile_modules_profile_id_fkey
FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Recreate unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_modules_unique ON profile_modules(profile_id, module_name);

SELECT 'Foreign key updated to point to profiles table' as status;


