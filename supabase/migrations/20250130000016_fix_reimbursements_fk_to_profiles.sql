-- Fix ref_reimbursements.employee_id to reference profiles.id instead of person.id
-- This allows mapping from Tripletex employees to auth users

-- Drop existing foreign key constraint
ALTER TABLE ref_reimbursements
DROP CONSTRAINT IF EXISTS ref_reimbursements_employee_id_fkey;

-- Delete existing reimbursements that point to person.id values
-- (we need to regenerate them with correct profiles.id)
DELETE FROM ref_reimbursements
WHERE employee_id NOT IN (SELECT id FROM profiles);

-- Recreate foreign key pointing to profiles table (NOT person)
ALTER TABLE ref_reimbursements
ADD CONSTRAINT ref_reimbursements_employee_id_fkey
FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

SELECT 'Foreign key updated to point to profiles table, old data deleted' as status;

