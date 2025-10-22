-- Fix existing projects without numbers (corrected for integer project_number)
UPDATE ttx_project_cache 
SET project_name = CONCAT(project_number::text, ' ', project_name)
WHERE project_number IS NOT NULL 
  AND project_number > 0
  AND project_name NOT LIKE CONCAT(project_number::text, '%')
  AND org_id = '71f8d13a-2017-41fd-8188-5e0514c7d79d';

-- Check results
SELECT project_number, project_name FROM ttx_project_cache 
WHERE org_id = '71f8d13a-2017-41fd-8188-5e0514c7d79d'
ORDER BY project_number;
