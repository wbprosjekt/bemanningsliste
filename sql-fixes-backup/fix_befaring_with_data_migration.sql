-- ============================================================
-- FIX BEFARING FOREIGN KEYS WITH DATA MIGRATION
-- ============================================================
-- This safely migrates existing data before changing foreign keys
-- ============================================================

-- STEP 1: Migrate existing data in befaringer
-- Convert profiles.id to profiles.user_id
UPDATE public.befaringer b
SET created_by = p.user_id
FROM public.profiles p
WHERE b.created_by = p.id;

-- STEP 2: Migrate existing data in oppgaver
UPDATE public.oppgaver o
SET created_by = p.user_id
FROM public.profiles p
WHERE o.created_by = p.id;

-- STEP 3: Migrate existing data in oppgave_kommentarer
UPDATE public.oppgave_kommentarer ok
SET created_by = p.user_id
FROM public.profiles p
WHERE ok.created_by = p.id;

-- STEP 4: Migrate existing data in oppgave_historikk
UPDATE public.oppgave_historikk oh
SET endret_av = p.user_id
FROM public.profiles p
WHERE oh.endret_av = p.id;

-- STEP 5: Migrate existing data in notifikasjoner
UPDATE public.notifikasjoner n
SET bruker_id = p.user_id
FROM public.profiles p
WHERE n.bruker_id = p.id;

-- STEP 6: Now it's safe to drop and recreate foreign keys
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

-- STEP 7: Add helpful comments
COMMENT ON COLUMN public.befaringer.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgaver.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgave_kommentarer.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgave_historikk.endret_av IS 'User ID (auth.uid) of person who made the change';
COMMENT ON COLUMN public.notifikasjoner.bruker_id IS 'User ID (auth.uid) of recipient';

-- STEP 8: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';


