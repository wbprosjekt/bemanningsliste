-- =====================================================
-- COMPLETE FIX FOR BEFARING MODULE RLS POLICIES
-- =====================================================
-- This script fixes the get_user_org_id() function and all related policies
-- The main issue: auth.uid() returns user_id, NOT profiles.id

-- Fix 1: Correct the helper function to use user_id instead of id
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Fix 2: Add file_type column to plantegninger table
ALTER TABLE public.plantegninger 
ADD COLUMN IF NOT EXISTS file_type text DEFAULT 'image';

-- Update existing records to have proper file_type
UPDATE public.plantegninger 
SET file_type = CASE 
  WHEN image_url LIKE '%.pdf' THEN 'pdf'
  ELSE 'image'
END;

-- Fix 3: Update BEFARINGER policies (keep admin restriction for now, but fix the function)
-- The policies should now work because get_user_org_id() is fixed
DROP POLICY IF EXISTS "Admins manage own org befaringer" ON public.befaringer;
CREATE POLICY "Admins manage own org befaringer"
  ON public.befaringer FOR ALL
  USING (
    org_id = public.get_user_org_id()
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- Fix 4: Update PLANTEGNINGER policies (keep admin restriction for now, but fix the function)
DROP POLICY IF EXISTS "Admins manage plantegninger in own org" ON public.plantegninger;
CREATE POLICY "Admins manage plantegninger in own org"
  ON public.plantegninger FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.befaringer b
      WHERE b.id = plantegninger.befaring_id
      AND b.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- Fix 5: Update OPPGAVER policies (fix the function reference)
DROP POLICY IF EXISTS "Admins manage oppgaver in own org" ON public.oppgaver;
CREATE POLICY "Admins manage oppgaver in own org"
  ON public.oppgaver FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plantegninger pl
      INNER JOIN public.befaringer b ON b.id = pl.befaring_id
      WHERE pl.id = oppgaver.plantegning_id
      AND b.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- Fix 6: Update storage policies for befaring-assets bucket
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

