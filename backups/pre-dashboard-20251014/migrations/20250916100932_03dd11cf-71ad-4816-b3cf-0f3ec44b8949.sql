-- Support upsert in tripletex sync: ensure ON CONFLICT target exists
ALTER TABLE public.person
ADD CONSTRAINT person_org_tripletex_employee_uniq
UNIQUE (org_id, tripletex_employee_id);