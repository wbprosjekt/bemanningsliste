-- Fix ref_reimbursements.employee_id to point to person table instead of profiles
-- Similar to the employee_settings fix

-- Drop the existing foreign key constraint
ALTER TABLE ref_reimbursements
DROP CONSTRAINT IF EXISTS ref_reimbursements_employee_id_fkey;

-- Recreate foreign key pointing to person table
ALTER TABLE ref_reimbursements
ADD CONSTRAINT ref_reimbursements_employee_id_fkey
FOREIGN KEY (employee_id) REFERENCES public.person(id) ON DELETE CASCADE;

SELECT 'Foreign key updated to point to person table' as status;


