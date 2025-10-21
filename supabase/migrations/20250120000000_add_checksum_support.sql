-- Add checksum support for Tripletex API compliance
-- This table stores checksums and timestamps for resources to enable efficient syncing

CREATE TABLE IF NOT EXISTS tripletex_sync_state (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type text NOT NULL, -- 'employee', 'project', 'activity', etc.
  resource_id text NOT NULL,   -- Tripletex ID as string
  checksum text,               -- MD5/SHA256 hash of resource data
  last_modified timestamp with time zone,
  last_synced timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Unique constraint per org + resource
  UNIQUE(org_id, resource_type, resource_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tripletex_sync_state_lookup 
ON tripletex_sync_state(org_id, resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_tripletex_sync_state_last_synced 
ON tripletex_sync_state(last_synced);

-- Function to update sync state
CREATE OR REPLACE FUNCTION update_tripletex_sync_state(
  p_org_id uuid,
  p_resource_type text,
  p_resource_id text,
  p_checksum text DEFAULT NULL,
  p_last_modified timestamp with time zone DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO tripletex_sync_state (org_id, resource_type, resource_id, checksum, last_modified, last_synced)
  VALUES (p_org_id, p_resource_type, p_resource_id, p_checksum, p_last_modified, now())
  ON CONFLICT (org_id, resource_type, resource_id)
  DO UPDATE SET
    checksum = EXCLUDED.checksum,
    last_modified = EXCLUDED.last_modified,
    last_synced = now(),
    updated_at = now();
END;
$$;

-- Function to get checksum for resource
CREATE OR REPLACE FUNCTION get_tripletex_checksum(
  p_org_id uuid,
  p_resource_type text,
  p_resource_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result text;
BEGIN
  SELECT checksum INTO result
  FROM tripletex_sync_state
  WHERE org_id = p_org_id 
    AND resource_type = p_resource_type 
    AND resource_id = p_resource_id;
  
  RETURN result;
END;
$$;

-- Function to clean up old sync state (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_tripletex_sync_state()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM tripletex_sync_state
  WHERE last_synced < now() - interval '30 days';
END;
$$;

-- Enable RLS
ALTER TABLE tripletex_sync_state ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view sync state for their organization" ON tripletex_sync_state
  FOR SELECT USING (
    org_id IN (
      SELECT id FROM organizations 
      WHERE id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role can manage sync state" ON tripletex_sync_state
  FOR ALL USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON tripletex_sync_state TO authenticated;
GRANT EXECUTE ON FUNCTION update_tripletex_sync_state TO authenticated;
GRANT EXECUTE ON FUNCTION get_tripletex_checksum TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_tripletex_sync_state TO authenticated;
