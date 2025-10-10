-- Fix null aktiv values in ttx_activity_cache to ensure activities show up in dropdowns
UPDATE public.ttx_activity_cache 
SET aktiv = true 
WHERE aktiv IS NULL;