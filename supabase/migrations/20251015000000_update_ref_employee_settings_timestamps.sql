-- Update ref_employee_settings effective period columns to use TIMESTAMPTZ

BEGIN;

-- Drop existing unique index to allow column type change
DROP INDEX IF EXISTS idx_ref_employee_settings_profile;

-- Convert effective_from/effective_to to timestamptz and adjust defaults
ALTER TABLE ref_employee_settings
  ALTER COLUMN effective_from TYPE timestamptz USING effective_from::timestamptz,
  ALTER COLUMN effective_to TYPE timestamptz USING effective_to::timestamptz,
  ALTER COLUMN effective_from SET DEFAULT NOW();

-- Recreate the unique index with the new column type
CREATE UNIQUE INDEX IF NOT EXISTS idx_ref_employee_settings_profile
  ON ref_employee_settings(profile_id, effective_from);

COMMIT;
