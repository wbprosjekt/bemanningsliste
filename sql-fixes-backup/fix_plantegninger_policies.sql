-- =====================================================
-- COMPLETE FIX FOR BEFARING MODULE - ALL USERS ACCESS
-- =====================================================
-- This script removes admin/manager restrictions from the befaring module
-- so that ALL users within an organization can create and manage befaringer.

-- Fix 1: Add file_type column to plantegninger table
ALTER TABLE public.plantegninger 
ADD COLUMN IF NOT EXISTS file_type text DEFAULT 'image';

-- Update existing records to have proper file_type
UPDATE public.plantegninger 
SET file_type = CASE 
  WHEN image_url LIKE '%.pdf' THEN 'pdf'
  ELSE 'image'
END;

-- Fix 2: Update RLS policies for plantegninger to allow ALL users (not just admin/manager)
DROP POLICY IF EXISTS "Admins manage plantegninger in own org" ON public.plantegninger;

-- New policy: ALL users can manage plantegninger in their org
CREATE POLICY "Users manage plantegninger in own org"
  ON public.plantegninger FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.befaringer b
      WHERE b.id = plantegninger.befaring_id
      AND b.org_id = (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.befaringer b
      WHERE b.id = plantegninger.befaring_id
      AND b.org_id = (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- Fix 3: Update storage policies for befaring-assets bucket
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

-- Fix 4: Update RLS policies for oppgaver to allow ALL users (not just admin/manager)
DROP POLICY IF EXISTS "Admins manage oppgaver in own org" ON public.oppgaver;

-- New policy: ALL users can manage oppgaver in their org
CREATE POLICY "Users manage oppgaver in own org"
  ON public.oppgaver FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plantegninger pl
      INNER JOIN public.befaringer b ON b.id = pl.befaring_id
      WHERE pl.id = oppgaver.plantegning_id
      AND b.org_id = (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plantegninger pl
      INNER JOIN public.befaringer b ON b.id = pl.befaring_id
      WHERE pl.id = oppgaver.plantegning_id
      AND b.org_id = (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
    )
  );
