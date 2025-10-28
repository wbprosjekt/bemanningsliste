-- FINAL FIX: Ensure profile_modules points to profiles(id), not person(id)
-- This is the correct relationship since profiles is linked to auth.users

-- Drop the existing foreign key constraint (both possible names)
ALTER TABLE profile_modules
DROP CONSTRAINT IF EXISTS profile_modules_profile_id_fkey;

ALTER TABLE profile_modules
DROP CONSTRAINT IF EXISTS profile_modules_profile_id_fkey2;

-- Drop unique index
DROP INDEX IF EXISTS idx_profile_modules_unique;

-- Recreate foreign key pointing to profiles table (NOT person)
ALTER TABLE profile_modules
ADD CONSTRAINT profile_modules_profile_id_fkey
FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Recreate unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_modules_unique ON profile_modules(profile_id, module_name);

SELECT 'Foreign key updated to point to profiles table (final)' as status;


