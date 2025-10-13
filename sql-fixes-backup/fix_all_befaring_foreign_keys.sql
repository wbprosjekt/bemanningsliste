-- ============================================================
-- FIX ALL BEFARING FOREIGN KEY CONSTRAINTS
-- ============================================================
-- SYSTEMATISK PROBLEM: Alle foreign keys refererer profiles.id
-- men mottaker auth.uid() som er user_id (ikke profiles.id)
-- 
-- LØSNING: Endre alle foreign keys til å peke på auth.users(id)
-- Dette er riktig fordi:
-- - auth.uid() returnerer auth.users.id
-- - profiles.user_id peker til auth.users.id
-- - profiles.id er en annen UUID (primary key)
-- ============================================================

-- TABLE 1: befaringer.created_by
ALTER TABLE public.befaringer
  DROP CONSTRAINT IF EXISTS befaringer_created_by_fkey;

ALTER TABLE public.befaringer
  ADD CONSTRAINT befaringer_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- TABLE 2: oppgaver.ansvarlig_person_id
-- NOTE: This should stay as profiles.id because it's assigned manually
-- (not from auth.uid()), but let's check if it's nullable
-- Keep as is for now - will only fail if you try to assign invalid ID

-- TABLE 3: oppgaver.created_by
ALTER TABLE public.oppgaver
  DROP CONSTRAINT IF EXISTS oppgaver_created_by_fkey;

ALTER TABLE public.oppgaver
  ADD CONSTRAINT oppgaver_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- TABLE 4: oppgave_kommentarer.created_by
ALTER TABLE public.oppgave_kommentarer
  DROP CONSTRAINT IF EXISTS oppgave_kommentarer_created_by_fkey;

ALTER TABLE public.oppgave_kommentarer
  ADD CONSTRAINT oppgave_kommentarer_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- TABLE 5: oppgave_historikk.endret_av
ALTER TABLE public.oppgave_historikk
  DROP CONSTRAINT IF EXISTS oppgave_historikk_endret_av_fkey;

ALTER TABLE public.oppgave_historikk
  ADD CONSTRAINT oppgave_historikk_endret_av_fkey
  FOREIGN KEY (endret_av) REFERENCES auth.users(id);

-- TABLE 6: notifikasjoner.bruker_id
ALTER TABLE public.notifikasjoner
  DROP CONSTRAINT IF EXISTS notifikasjoner_bruker_id_fkey;

ALTER TABLE public.notifikasjoner
  ADD CONSTRAINT notifikasjoner_bruker_id_fkey
  FOREIGN KEY (bruker_id) REFERENCES auth.users(id);

-- TABLE 7: oppgave_bilder.uploaded_by
-- NOTE: This is nullable and might be set from email tokens
-- Keep as profiles.id for now since it's manually assigned

-- Add helpful comments
COMMENT ON COLUMN public.befaringer.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgaver.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgave_kommentarer.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgave_historikk.endret_av IS 'User ID (auth.uid) of person who made the change';
COMMENT ON COLUMN public.notifikasjoner.bruker_id IS 'User ID (auth.uid) of recipient';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';


