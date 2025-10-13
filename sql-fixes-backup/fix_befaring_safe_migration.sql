-- ============================================================
-- SAFE BEFARING FOREIGN KEYS MIGRATION
-- ============================================================
-- This version handles orphaned data (users that no longer exist)
-- ============================================================

-- STEP 1: Check for orphaned data before migration
-- This identifies befaringer created by non-existent profiles
DO $$
BEGIN
  RAISE NOTICE 'Checking for orphaned befaringer...';
  
  PERFORM b.id
  FROM public.befaringer b
  LEFT JOIN public.profiles p ON b.created_by = p.id
  WHERE p.id IS NULL;
  
  IF FOUND THEN
    RAISE NOTICE 'Found orphaned befaringer. These will be handled.';
  ELSE
    RAISE NOTICE 'No orphaned befaringer found.';
  END IF;
END $$;

-- STEP 2: For orphaned befaringer, set created_by to a default admin user
-- First, find the first admin in the database
DO $$
DECLARE
  default_user_id UUID;
BEGIN
  -- Get the first admin user's user_id
  SELECT user_id INTO default_user_id
  FROM public.profiles
  WHERE role = 'admin'
  LIMIT 1;
  
  IF default_user_id IS NULL THEN
    -- If no admin, just get the first user
    SELECT user_id INTO default_user_id
    FROM public.profiles
    LIMIT 1;
  END IF;
  
  -- Update orphaned befaringer to this user
  UPDATE public.befaringer
  SET created_by = default_user_id
  WHERE created_by NOT IN (SELECT id FROM public.profiles);
  
  RAISE NOTICE 'Orphaned befaringer assigned to user: %', default_user_id;
END $$;

-- STEP 3: Migrate valid data in befaringer
-- Convert profiles.id to profiles.user_id for existing valid records
UPDATE public.befaringer b
SET created_by = p.user_id
FROM public.profiles p
WHERE b.created_by = p.id
AND b.created_by IN (SELECT id FROM public.profiles);

-- STEP 4: Migrate valid data in oppgaver
-- First handle orphaned oppgaver
DO $$
DECLARE
  default_user_id UUID;
BEGIN
  SELECT user_id INTO default_user_id
  FROM public.profiles
  WHERE role = 'admin'
  LIMIT 1;
  
  IF default_user_id IS NULL THEN
    SELECT user_id INTO default_user_id
    FROM public.profiles
    LIMIT 1;
  END IF;
  
  UPDATE public.oppgaver
  SET created_by = default_user_id
  WHERE created_by NOT IN (SELECT id FROM public.profiles);
END $$;

-- Then migrate valid oppgaver
UPDATE public.oppgaver o
SET created_by = p.user_id
FROM public.profiles p
WHERE o.created_by = p.id
AND o.created_by IN (SELECT id FROM public.profiles);

-- STEP 5: Migrate valid data in oppgave_kommentarer
DO $$
DECLARE
  default_user_id UUID;
BEGIN
  SELECT user_id INTO default_user_id
  FROM public.profiles
  WHERE role = 'admin'
  LIMIT 1;
  
  IF default_user_id IS NULL THEN
    SELECT user_id INTO default_user_id
    FROM public.profiles
    LIMIT 1;
  END IF;
  
  UPDATE public.oppgave_kommentarer
  SET created_by = default_user_id
  WHERE created_by NOT IN (SELECT id FROM public.profiles);
END $$;

UPDATE public.oppgave_kommentarer ok
SET created_by = p.user_id
FROM public.profiles p
WHERE ok.created_by = p.id
AND ok.created_by IN (SELECT id FROM public.profiles);

-- STEP 6: Migrate valid data in oppgave_historikk
DO $$
DECLARE
  default_user_id UUID;
BEGIN
  SELECT user_id INTO default_user_id
  FROM public.profiles
  WHERE role = 'admin'
  LIMIT 1;
  
  IF default_user_id IS NULL THEN
    SELECT user_id INTO default_user_id
    FROM public.profiles
    LIMIT 1;
  END IF;
  
  UPDATE public.oppgave_historikk
  SET endret_av = default_user_id
  WHERE endret_av NOT IN (SELECT id FROM public.profiles);
END $$;

UPDATE public.oppgave_historikk oh
SET endret_av = p.user_id
FROM public.profiles p
WHERE oh.endret_av = p.id
AND oh.endret_av IN (SELECT id FROM public.profiles);

-- STEP 7: Migrate valid data in notifikasjoner
DO $$
DECLARE
  default_user_id UUID;
BEGIN
  SELECT user_id INTO default_user_id
  FROM public.profiles
  WHERE role = 'admin'
  LIMIT 1;
  
  IF default_user_id IS NULL THEN
    SELECT user_id INTO default_user_id
    FROM public.profiles
    LIMIT 1;
  END IF;
  
  UPDATE public.notifikasjoner
  SET bruker_id = default_user_id
  WHERE bruker_id NOT IN (SELECT id FROM public.profiles);
END $$;

UPDATE public.notifikasjoner n
SET bruker_id = p.user_id
FROM public.profiles p
WHERE n.bruker_id = p.id
AND n.bruker_id IN (SELECT id FROM public.profiles);

-- STEP 8: Now it's safe to drop and recreate foreign keys
-- befaringer.created_by
ALTER TABLE public.befaringer
  DROP CONSTRAINT IF EXISTS befaringer_created_by_fkey;

ALTER TABLE public.befaringer
  ADD CONSTRAINT befaringer_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- oppgaver.created_by
ALTER TABLE public.oppgaver
  DROP CONSTRAINT IF EXISTS oppgaver_created_by_fkey;

ALTER TABLE public.oppgaver
  ADD CONSTRAINT oppgaver_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- oppgave_kommentarer.created_by
ALTER TABLE public.oppgave_kommentarer
  DROP CONSTRAINT IF EXISTS oppgave_kommentarer_created_by_fkey;

ALTER TABLE public.oppgave_kommentarer
  ADD CONSTRAINT oppgave_kommentarer_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- oppgave_historikk.endret_av
ALTER TABLE public.oppgave_historikk
  DROP CONSTRAINT IF EXISTS oppgave_historikk_endret_av_fkey;

ALTER TABLE public.oppgave_historikk
  ADD CONSTRAINT oppgave_historikk_endret_av_fkey
  FOREIGN KEY (endret_av) REFERENCES auth.users(id);

-- notifikasjoner.bruker_id
ALTER TABLE public.notifikasjoner
  DROP CONSTRAINT IF EXISTS notifikasjoner_bruker_id_fkey;

ALTER TABLE public.notifikasjoner
  ADD CONSTRAINT notifikasjoner_bruker_id_fkey
  FOREIGN KEY (bruker_id) REFERENCES auth.users(id);

-- STEP 9: Add helpful comments
COMMENT ON COLUMN public.befaringer.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgaver.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgave_kommentarer.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgave_historikk.endret_av IS 'User ID (auth.uid) of person who made the change';
COMMENT ON COLUMN public.notifikasjoner.bruker_id IS 'User ID (auth.uid) of recipient';

-- STEP 10: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE 'All foreign keys now point to auth.users(id)';
END $$;


