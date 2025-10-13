-- Fix RLS policies for oppgave_bilder and related tables
-- Issues fixed:
-- 1. get_user_org_id() was using profiles.id instead of profiles.user_id
-- 2. oppgave_bilder.uploaded_by foreign key should reference auth.users(id) not profiles(id)
-- 3. Update storage bucket file size limit to 5MB

-- 1. Update storage bucket file size limit to 5MB (5242880 bytes)
UPDATE storage.buckets 
SET file_size_limit = 5242880 
WHERE id = 'befaring-assets';

-- 2. Fix foreign key constraint for uploaded_by
ALTER TABLE public.oppgave_bilder 
DROP CONSTRAINT IF EXISTS oppgave_bilder_uploaded_by_fkey;

ALTER TABLE public.oppgave_bilder 
ADD CONSTRAINT oppgave_bilder_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Fix the get_user_org_id() function
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Recreate RLS policies with correct role checks

-- BEFARINGER
DROP POLICY IF EXISTS "Admins manage own org befaringer" ON public.befaringer;
CREATE POLICY "Admins manage own org befaringer"
  ON public.befaringer FOR ALL
  USING (
    org_id = public.get_user_org_id()
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- PLANTEGNINGER
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

-- UNDERLEVERANDØRER
DROP POLICY IF EXISTS "Admins manage own org underleverandører" ON public.underleverandorer;
CREATE POLICY "Admins manage own org underleverandører"
  ON public.underleverandorer FOR ALL
  USING (
    org_id = public.get_user_org_id()
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- OPPGAVER
DROP POLICY IF EXISTS "Admins manage oppgaver in own org" ON public.oppgaver;
CREATE POLICY "Admins manage oppgaver in own org"
  ON public.oppgaver FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plantegninger p
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE p.id = oppgaver.plantegning_id
      AND b.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- 5. Verify oppgave_bilder policies are correct
-- These should already be correct, but let's recreate them to be sure

DROP POLICY IF EXISTS "Users see bilder in own org" ON public.oppgave_bilder;
CREATE POLICY "Users see bilder in own org"
  ON public.oppgave_bilder FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.oppgaver o
      JOIN public.plantegninger p ON p.id = o.plantegning_id
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE o.id = oppgave_bilder.oppgave_id
      AND b.org_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Users upload bilder in own org" ON public.oppgave_bilder;
CREATE POLICY "Users upload bilder in own org"
  ON public.oppgave_bilder FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.oppgaver o
      JOIN public.plantegninger p ON p.id = o.plantegning_id
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE o.id = oppgave_bilder.oppgave_id
      AND b.org_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Users delete bilder in own org" ON public.oppgave_bilder;
CREATE POLICY "Users delete bilder in own org"
  ON public.oppgave_bilder FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.oppgaver o
      JOIN public.plantegninger p ON p.id = o.plantegning_id
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE o.id = oppgave_bilder.oppgave_id
      AND b.org_id = public.get_user_org_id()
    )
  );

-- 6. Fix storage policies for befaring-assets bucket
-- The current policies expect befaring_id/oppgave_id/filename structure
-- But we're uploading to oppgave_id/filename structure
-- Let's update the policies to match the actual upload pattern

DROP POLICY IF EXISTS "Users can upload befaring assets" ON storage.objects;
CREATE POLICY "Users can upload befaring assets" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'befaring-assets' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.oppgaver o
    JOIN public.plantegninger p ON p.id = o.plantegning_id
    JOIN public.befaringer b ON b.id = p.befaring_id
    WHERE o.id::text = (storage.foldername(name))[1]
    AND b.org_id IN (
      SELECT org_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can view befaring assets from their org" ON storage.objects;
CREATE POLICY "Users can view befaring assets from their org" ON storage.objects
FOR SELECT USING (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM public.oppgaver o
    JOIN public.plantegninger p ON p.id = o.plantegning_id
    JOIN public.befaringer b ON b.id = p.befaring_id
    WHERE o.id::text = (storage.foldername(name))[1]
    AND b.org_id IN (
      SELECT org_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can delete befaring assets" ON storage.objects;
CREATE POLICY "Users can delete befaring assets" ON storage.objects
FOR DELETE USING (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM public.oppgaver o
    JOIN public.plantegninger p ON p.id = o.plantegning_id
    JOIN public.befaringer b ON b.id = p.befaring_id
    WHERE o.id::text = (storage.foldername(name))[1]
    AND b.org_id IN (
      SELECT org_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  )
);

