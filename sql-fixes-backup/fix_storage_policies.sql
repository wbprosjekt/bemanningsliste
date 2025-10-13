-- Fix storage policies for befaring-assets bucket
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view befaring assets from their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload befaring assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update befaring assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete befaring assets" ON storage.objects;

-- Recreate policies with correct folder path handling
-- Policy: Users can view files (SELECT)
CREATE POLICY "Users can view befaring assets from their org" ON storage.objects
FOR SELECT USING (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM befaringer b
    INNER JOIN profiles p ON p.org_id = b.org_id
    WHERE p.user_id = auth.uid()
    AND b.id::text = split_part(name, '/', 1)
  )
);

-- Policy: Users can upload files (INSERT)
CREATE POLICY "Users can upload befaring assets" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM befaringer b
    INNER JOIN profiles p ON p.org_id = b.org_id
    WHERE p.user_id = auth.uid()
    AND b.id::text = split_part(name, '/', 1)
  )
);

-- Policy: Users can update files (UPDATE)
CREATE POLICY "Users can update befaring assets" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM befaringer b
    INNER JOIN profiles p ON p.org_id = b.org_id
    WHERE p.user_id = auth.uid()
    AND b.id::text = split_part(name, '/', 1)
  )
);

-- Policy: Users can delete files (DELETE)
CREATE POLICY "Users can delete befaring assets" ON storage.objects
FOR DELETE USING (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM befaringer b
    INNER JOIN profiles p ON p.org_id = b.org_id
    WHERE p.user_id = auth.uid()
    AND b.id::text = split_part(name, '/', 1)
  )
);

