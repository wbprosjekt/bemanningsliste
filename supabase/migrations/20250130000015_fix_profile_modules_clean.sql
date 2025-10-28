-- CLEAN UP: Fix profile_modules and FK constraint properly
-- This removes old data pointing to person IDs and fixes the FK

-- Step 1: Delete all existing profile_modules entries that point to non-existent profiles
DELETE FROM profile_modules
WHERE profile_id NOT IN (SELECT id FROM profiles);

-- Step 2: Drop the existing foreign key constraint (both possible names)
ALTER TABLE profile_modules
DROP CONSTRAINT IF EXISTS profile_modules_profile_id_fkey;

ALTER TABLE profile_modules
DROP CONSTRAINT IF EXISTS profile_modules_profile_id_fkey2;

-- Step 3: Drop unique index
DROP INDEX IF EXISTS idx_profile_modules_unique;

-- Step 4: Recreate foreign key pointing to profiles table (NOT person)
ALTER TABLE profile_modules
ADD CONSTRAINT profile_modules_profile_id_fkey
FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Step 5: Recreate unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_modules_unique ON profile_modules(profile_id, module_name);

-- Verify: Show current profile_modules entries
SELECT 
  pm.*, 
  p.display_name as profile_name,
  p.user_id IS NOT NULL as has_login
FROM profile_modules pm
LEFT JOIN profiles p ON pm.profile_id = p.id
WHERE pm.module_name = 'refusjon_hjemmelading';

SELECT 'Foreign key updated and old data cleaned' as status;


