-- Setup storage bucket for befaring assets (plantegninger, images, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'befaring-assets',
  'befaring-assets', 
  true,
  5242880, -- 5MB limit (images are compressed client-side)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Enable RLS on storage.buckets
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read files from their organization's befaring assets
CREATE POLICY "Users can view befaring assets from their org" ON storage.objects
FOR SELECT USING (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM befaringer b
    WHERE b.id::text = (storage.foldername(name))[2]
    AND b.org_id IN (
      SELECT org_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
);

-- Policy: Users can upload files to befaring assets
CREATE POLICY "Users can upload befaring assets" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM befaringer b
    WHERE b.id::text = (storage.foldername(name))[2]
    AND b.org_id IN (
      SELECT org_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
);

-- Policy: Users can update files in befaring assets
CREATE POLICY "Users can update befaring assets" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM befaringer b
    WHERE b.id::text = (storage.foldername(name))[2]
    AND b.org_id IN (
      SELECT org_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
);

-- Policy: Users can delete files from befaring assets
CREATE POLICY "Users can delete befaring assets" ON storage.objects
FOR DELETE USING (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM befaringer b
    WHERE b.id::text = (storage.foldername(name))[2]
    AND b.org_id IN (
      SELECT org_id FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
);
