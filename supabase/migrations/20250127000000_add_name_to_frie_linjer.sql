-- Add name column to frie_linjer table if it doesn't exist
-- This migration ensures the name field is available for editing line names

-- Check if the column exists before adding it
DO $$ 
BEGIN
    -- Add name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'frie_linjer' 
        AND column_name = 'name'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.frie_linjer 
        ADD COLUMN name TEXT;
        
        -- Add comment to document the purpose
        COMMENT ON COLUMN public.frie_linjer.name IS 'Custom name for the free line (e.g., "Linje 1", "Linje 2", etc.)';
    END IF;
END $$;

-- Update RLS policies to include name field in updates
-- The existing policies should already work, but let's make sure they're properly set up

-- Ensure the table has RLS enabled
ALTER TABLE public.frie_linjer ENABLE ROW LEVEL SECURITY;

-- Verify that the update policy exists and works with the name field
-- If the policy doesn't exist, create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE tablename = 'frie_linjer' 
        AND policyname = 'Users can update frie_linjer for their org'
    ) THEN
        CREATE POLICY "Users can update frie_linjer for their org" ON public.frie_linjer
          FOR UPDATE USING (
            EXISTS (
              SELECT 1 FROM public.profiles 
              WHERE profiles.user_id = auth.uid() 
              AND profiles.org_id = frie_linjer.org_id
            )
          );
    END IF;
END $$;
