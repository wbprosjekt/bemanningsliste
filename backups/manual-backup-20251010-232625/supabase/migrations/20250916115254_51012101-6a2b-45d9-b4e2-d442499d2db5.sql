-- Add overtime support and Tripletex integration fields to vakt_timer
ALTER TABLE vakt_timer ADD COLUMN IF NOT EXISTS is_overtime boolean DEFAULT false;
ALTER TABLE vakt_timer ADD COLUMN IF NOT EXISTS tripletex_synced_at timestamp with time zone;
ALTER TABLE vakt_timer ADD COLUMN IF NOT EXISTS sync_error text;

-- Add approval workflow fields
ALTER TABLE vakt_timer ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;
ALTER TABLE vakt_timer ADD COLUMN IF NOT EXISTS approved_by uuid;

-- Comment on new fields
COMMENT ON COLUMN vakt_timer.is_overtime IS 'Indicates if this is overtime hours';
COMMENT ON COLUMN vakt_timer.tripletex_synced_at IS 'When this entry was successfully synced to Tripletex';
COMMENT ON COLUMN vakt_timer.sync_error IS 'Error message if sync to Tripletex failed';
COMMENT ON COLUMN vakt_timer.approved_at IS 'When this entry was approved';
COMMENT ON COLUMN vakt_timer.approved_by IS 'User who approved this entry';

-- Create index for better performance on frequently queried fields
CREATE INDEX IF NOT EXISTS idx_vakt_timer_status ON vakt_timer(status);
CREATE INDEX IF NOT EXISTS idx_vakt_timer_tripletex_synced ON vakt_timer(tripletex_synced_at) WHERE tripletex_synced_at IS NOT NULL;