-- FORCE FIX: Disable RLS temporarily to test

-- Option 1: Disable RLS completely (TEMPORARY - for testing only!)
ALTER TABLE plantegninger DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS enabled, run this instead:
-- ALTER TABLE plantegninger ENABLE ROW LEVEL SECURITY;

-- Then create policies with proper permissions
DROP POLICY IF EXISTS "Allow authenticated users to view plantegninger" ON plantegninger;
DROP POLICY IF EXISTS "Allow authenticated users to create plantegninger" ON plantegninger;
DROP POLICY IF EXISTS "Allow authenticated users to update plantegninger" ON plantegninger;
DROP POLICY IF EXISTS "Allow authenticated users to delete plantegninger" ON plantegninger;

CREATE POLICY "Allow authenticated users to view plantegninger"
ON plantegninger FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to create plantegninger"
ON plantegninger FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update plantegninger"
ON plantegninger FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete plantegninger"
ON plantegninger FOR DELETE
TO authenticated
USING (true);

-- Re-enable RLS
ALTER TABLE plantegninger ENABLE ROW LEVEL SECURITY;
