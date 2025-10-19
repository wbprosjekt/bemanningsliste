-- Make oppgave_id nullable in oppgave_bilder table

-- First, check if there are any existing rows with NULL oppgave_id
-- If yes, we need to handle them

-- Make oppgave_id nullable
ALTER TABLE oppgave_bilder
ALTER COLUMN oppgave_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN oppgave_bilder.oppgave_id IS 'NULL for photos in project inbox (not yet tagged to an oppgave)';

