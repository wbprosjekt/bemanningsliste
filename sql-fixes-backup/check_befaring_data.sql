-- ============================================================
-- CHECK EXISTING DATA BEFORE MIGRATION
-- ============================================================
-- This will help us understand what data exists and how to migrate it

-- 1. Check how many befaringer exist
SELECT COUNT(*) as total_befaringer FROM public.befaringer;

-- 2. Check created_by values in befaringer
SELECT 
  b.id as befaring_id,
  b.created_by,
  p.id as profile_id,
  p.user_id,
  p.role
FROM public.befaringer b
LEFT JOIN public.profiles p ON b.created_by = p.id
LIMIT 10;

-- 3. Check if created_by matches profiles.id or profiles.user_id
SELECT 
  'Matches profiles.id' as match_type,
  COUNT(*) as count
FROM public.befaringer b
INNER JOIN public.profiles p ON b.created_by = p.id

UNION ALL

SELECT 
  'Matches profiles.user_id' as match_type,
  COUNT(*) as count
FROM public.befaringer b
INNER JOIN public.profiles p ON b.created_by = p.user_id;

-- 4. Check oppgaver data
SELECT 
  COUNT(*) as total_oppgaver,
  COUNT(DISTINCT created_by) as unique_creators
FROM public.oppgaver;

-- 5. Check if oppgaver.created_by matches profiles.id or user_id
SELECT 
  'Matches profiles.id' as match_type,
  COUNT(*) as count
FROM public.oppgaver o
INNER JOIN public.profiles p ON o.created_by = p.id

UNION ALL

SELECT 
  'Matches profiles.user_id' as match_type,
  COUNT(*) as count
FROM public.oppgaver o
INNER JOIN public.profiles p ON o.created_by = p.user_id;


