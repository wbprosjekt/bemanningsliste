-- Check if file_type column exists in plantegninger table

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'plantegninger'
  AND column_name = 'file_type';

-- Check current data
SELECT 
  id,
  title,
  file_type,
  image_url
FROM plantegninger
ORDER BY created_at DESC
LIMIT 5;
