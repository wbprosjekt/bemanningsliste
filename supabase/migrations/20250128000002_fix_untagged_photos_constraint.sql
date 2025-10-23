-- =====================================================
-- FIX UNTAGGED PHOTOS CONSTRAINT ISSUE
-- =====================================================
-- Problemet: Constraint krever enten oppgave_id ELLER befaring_punkt_id
-- Men untagged bilder trenger å kunne eksistere uten begge
-- Løsning: Oppdater constraint til å tillate NULL for begge (untagged bilder)

-- Fjern eksisterende constraint
ALTER TABLE public.oppgave_bilder 
DROP CONSTRAINT IF EXISTS oppgave_bilder_oppgave_or_punkt_check;

-- Legg til ny constraint som tillater untagged bilder
ALTER TABLE public.oppgave_bilder 
ADD CONSTRAINT oppgave_bilder_oppgave_or_punkt_check 
CHECK (
  -- Tillat untagged bilder (begge NULL)
  (oppgave_id IS NULL AND befaring_punkt_id IS NULL) OR
  -- Tillat oppgave-bilder (kun oppgave_id satt)
  (oppgave_id IS NOT NULL AND befaring_punkt_id IS NULL) OR
  -- Tillat punkt-bilder (kun befaring_punkt_id satt)
  (oppgave_id IS NULL AND befaring_punkt_id IS NOT NULL)
);

-- Kommenter constraint-en
COMMENT ON CONSTRAINT oppgave_bilder_oppgave_or_punkt_check ON public.oppgave_bilder 
IS 'Ensures either oppgave_id or befaring_punkt_id is set, or both NULL for untagged photos';
