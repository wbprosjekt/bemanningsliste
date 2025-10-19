-- Fix RLS policies for plantegninger table

-- 1. Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to view plantegninger" ON plantegninger;
DROP POLICY IF EXISTS "Allow authenticated users to create plantegninger" ON plantegninger;
DROP POLICY IF EXISTS "Allow authenticated users to update plantegninger" ON plantegninger;
DROP POLICY IF EXISTS "Allow authenticated users to delete plantegninger" ON plantegninger;

-- 2. Create new policies
CREATE POLICY "Allow authenticated users to view plantegninger"
ON plantegninger FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
);

CREATE POLICY "Allow authenticated users to create plantegninger"
ON plantegninger FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

CREATE POLICY "Allow authenticated users to update plantegninger"
ON plantegninger FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
)
WITH CHECK (
  auth.uid() IS NOT NULL
);

CREATE POLICY "Allow authenticated users to delete plantegninger"
ON plantegninger FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
);
