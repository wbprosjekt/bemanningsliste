-- Add file_type column to plantegninger table
ALTER TABLE public.plantegninger 
ADD COLUMN IF NOT EXISTS file_type text DEFAULT 'image';

-- Update existing records to have proper file_type
UPDATE public.plantegninger 
SET file_type = CASE 
  WHEN image_url LIKE '%.pdf' THEN 'pdf'
  ELSE 'image'
END;

