-- Add missing columns for sync optimization
-- This migration adds the missing columns that webhooks and sync functions need

-- Add needs_sync column to ttx_project_cache
ALTER TABLE ttx_project_cache 
ADD COLUMN IF NOT EXISTS needs_sync BOOLEAN DEFAULT false;

-- Add needs_sync column to ttx_employee_cache  
ALTER TABLE ttx_employee_cache 
ADD COLUMN IF NOT EXISTS needs_sync BOOLEAN DEFAULT false;

-- Add Tripletex-specific sync markers to tripletex_sync_state
ALTER TABLE tripletex_sync_state 
ADD COLUMN IF NOT EXISTS tripletex_checksum TEXT,
ADD COLUMN IF NOT EXISTS tripletex_last_modified TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ttx_project_cache_needs_sync ON ttx_project_cache(needs_sync);
CREATE INDEX IF NOT EXISTS idx_ttx_employee_cache_needs_sync ON ttx_employee_cache(needs_sync);
CREATE INDEX IF NOT EXISTS idx_tripletex_sync_state_tripletex_checksum ON tripletex_sync_state(tripletex_checksum);

-- Update existing records to have needs_sync = false
UPDATE ttx_project_cache SET needs_sync = false WHERE needs_sync IS NULL;
UPDATE ttx_employee_cache SET needs_sync = false WHERE needs_sync IS NULL;
