-- Debug script to check photos in database
-- Run this in Supabase SQL Editor

-- Check total photos
SELECT 
  COUNT(*) as total_photos,
  COUNT(CASE WHEN oppgave_id IS NULL AND befaring_punkt_id IS NULL THEN 1 END) as untagged_photos,
  COUNT(CASE WHEN oppgave_id IS NOT NULL THEN 1 END) as oppgave_photos,
  COUNT(CASE WHEN befaring_punkt_id IS NOT NULL THEN 1 END) as punkt_photos,
  COUNT(CASE WHEN prosjekt_id IS NULL THEN 1 END) as no_project_photos,
  COUNT(CASE WHEN is_tagged = false THEN 1 END) as is_tagged_false
FROM oppgave_bilder;

-- Check sample untagged photos
SELECT 
  id,
  image_url,
  prosjekt_id,
  oppgave_id,
  befaring_punkt_id,
  is_tagged,
  inbox_date,
  comment
FROM oppgave_bilder 
WHERE oppgave_id IS NULL 
  AND befaring_punkt_id IS NULL 
  AND is_tagged = false
ORDER BY inbox_date DESC
LIMIT 5;

-- Check RLS policies on oppgave_bilder
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'oppgave_bilder';


