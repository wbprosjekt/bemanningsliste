-- Add overtime_type column to vakt_timer table
ALTER TABLE vakt_timer ADD COLUMN IF NOT EXISTS overtime_type TEXT CHECK (overtime_type IN ('100', '50'));

-- Add comment for documentation
COMMENT ON COLUMN vakt_timer.overtime_type IS 'Type of overtime: 100 for 100% overtime, 50 for 50% overtime';

-- Create index for better performance on overtime queries
CREATE INDEX IF NOT EXISTS idx_vakt_timer_overtime_type ON vakt_timer(overtime_type) WHERE overtime_type IS NOT NULL;

