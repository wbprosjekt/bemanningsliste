-- Add overtime activity field to vakt_timer table
ALTER TABLE public.vakt_timer 
ADD COLUMN overtime_aktivitet_id UUID REFERENCES public.ttx_activity_cache(id) ON DELETE SET NULL;

-- Add comment to explain the field
COMMENT ON COLUMN public.vakt_timer.overtime_aktivitet_id IS 'Separate activity for overtime hours to avoid conflicts with regular hours in Tripletex';
