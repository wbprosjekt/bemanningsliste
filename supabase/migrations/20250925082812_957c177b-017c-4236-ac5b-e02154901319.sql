-- Add name column to frie_linjer table
ALTER TABLE public.frie_linjer 
ADD COLUMN name TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN public.frie_linjer.name IS 'Custom name for the free line (e.g., "Linje 1", "Linje 2", etc.)';