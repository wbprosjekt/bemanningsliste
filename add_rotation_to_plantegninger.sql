-- Add rotation column to plantegninger table

ALTER TABLE plantegninger
ADD COLUMN IF NOT EXISTS rotation integer DEFAULT 0;

-- Add comment
COMMENT ON COLUMN plantegninger.rotation IS 'Rotation in degrees (0, 90, 180, 270). Only editable when plantegning has 0 oppgaver.';
