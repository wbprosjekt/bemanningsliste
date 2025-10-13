-- ============================================================
-- FIX OPPGAVEFORM ISSUES
-- ============================================================
-- Problem 1: underleverandorer.fag is text[] (array), not text
-- Problem 2: oppgave_historikk.endret_av references profiles.id but should reference user_id
-- Problem 3: Trigger uses auth.uid() which is user_id, not profiles.id
-- ============================================================

-- STEP 1: Fix oppgave_historikk foreign key constraint
-- Drop the incorrect foreign key
ALTER TABLE public.oppgave_historikk
  DROP CONSTRAINT IF EXISTS oppgave_historikk_endret_av_fkey;

-- Add new foreign key that references profiles.user_id instead of profiles.id
ALTER TABLE public.oppgave_historikk
  ADD CONSTRAINT oppgave_historikk_endret_av_fkey
  FOREIGN KEY (endret_av) REFERENCES auth.users(id);

-- Update the comment to reflect the change
COMMENT ON COLUMN public.oppgave_historikk.endret_av IS 'User ID (auth.uid) of person who made the change';

-- STEP 2: Fix notifikasjoner table (has same issue)
ALTER TABLE public.notifikasjoner
  DROP CONSTRAINT IF EXISTS notifikasjoner_bruker_id_fkey;

ALTER TABLE public.notifikasjoner
  ADD CONSTRAINT notifikasjoner_bruker_id_fkey
  FOREIGN KEY (bruker_id) REFERENCES auth.users(id);

-- STEP 3: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';


