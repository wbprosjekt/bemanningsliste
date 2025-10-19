-- Fix RLS policies for befaring-assets bucket

-- 1. Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload befaring assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view befaring assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete befaring assets" ON storage.objects;

-- 2. Create new policies for befaring-assets bucket
CREATE POLICY "Allow authenticated users to upload befaring assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'befaring-assets' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Allow authenticated users to view befaring assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'befaring-assets' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Allow authenticated users to update befaring assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'befaring-assets' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Allow authenticated users to delete befaring assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'befaring-assets' AND
  auth.uid() IS NOT NULL
);
