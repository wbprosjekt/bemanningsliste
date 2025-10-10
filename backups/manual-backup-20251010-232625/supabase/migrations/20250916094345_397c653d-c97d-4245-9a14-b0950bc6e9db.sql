-- Add unique constraints for Tripletex cache tables to support upsert operations

-- Add unique constraint for ttx_project_cache
ALTER TABLE ttx_project_cache 
ADD CONSTRAINT ttx_project_cache_org_tripletex_unique 
UNIQUE (org_id, tripletex_project_id);

-- Add unique constraint for ttx_activity_cache  
ALTER TABLE ttx_activity_cache 
ADD CONSTRAINT ttx_activity_cache_org_ttx_unique 
UNIQUE (org_id, ttx_id);

-- Ensure ttx_employee_cache has the constraint (it should already exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ttx_employee_cache_org_tripletex_unique'
        AND table_name = 'ttx_employee_cache'
    ) THEN
        ALTER TABLE ttx_employee_cache 
        ADD CONSTRAINT ttx_employee_cache_org_tripletex_unique 
        UNIQUE (org_id, tripletex_employee_id);
    END IF;
END $$;