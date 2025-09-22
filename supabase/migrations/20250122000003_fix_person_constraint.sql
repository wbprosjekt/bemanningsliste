-- Fix duplicate key constraint issue for person table
-- Remove the old unique constraint on tripletex_employee_id that doesn't include org_id
-- Keep only the composite unique constraint (org_id, tripletex_employee_id)

-- Drop the old constraint that only checks tripletex_employee_id
ALTER TABLE public.person DROP CONSTRAINT IF EXISTS person_tripletex_employees_id_key;

-- Ensure the composite constraint exists (it should already exist from migration 20250916100932)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'person_org_tripletex_employee_uniq'
        AND table_name = 'person'
    ) THEN
        ALTER TABLE public.person
        ADD CONSTRAINT person_org_tripletex_employee_uniq
        UNIQUE (org_id, tripletex_employee_id);
    END IF;
END $$;
