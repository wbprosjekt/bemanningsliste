-- Quick fix for file_type column issue
-- This should resolve the 406 Not Acceptable error

-- Check if column exists first
DO $$ 
BEGIN
  -- Only add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plantegninger' 
    AND column_name = 'file_type'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.plantegninger ADD COLUMN file_type text DEFAULT 'image';
    
    -- Update existing records
    UPDATE public.plantegninger 
    SET file_type = CASE 
      WHEN image_url LIKE '%.pdf' THEN 'pdf'
      ELSE 'image'
    END;
    
    RAISE NOTICE 'file_type column added successfully';
  ELSE
    RAISE NOTICE 'file_type column already exists';
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

