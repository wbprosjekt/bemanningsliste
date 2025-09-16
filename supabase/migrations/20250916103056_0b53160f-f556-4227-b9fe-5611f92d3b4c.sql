-- Support upsert for project colors
ALTER TABLE public.project_color
ADD CONSTRAINT project_color_org_project_unique
UNIQUE (org_id, tripletex_project_id);