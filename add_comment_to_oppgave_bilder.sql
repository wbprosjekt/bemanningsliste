-- Add comment column to oppgave_bilder table

ALTER TABLE oppgave_bilder
ADD COLUMN IF NOT EXISTS comment text;

-- Add comment to comment
COMMENT ON COLUMN oppgave_bilder.comment IS 'Comment/description for untagged photos (when prosjekt_id is NULL)';

