-- Add fields to store original values before sending to Tripletex
ALTER TABLE public.vakt_timer
ADD COLUMN original_timer DECIMAL(5,2),
ADD COLUMN original_aktivitet_id UUID REFERENCES public.ttx_activity_cache(id) ON DELETE SET NULL,
ADD COLUMN original_notat TEXT,
ADD COLUMN original_status TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.vakt_timer.original_timer IS 'Original timer value before sending to Tripletex';
COMMENT ON COLUMN public.vakt_timer.original_aktivitet_id IS 'Original activity ID before sending to Tripletex';
COMMENT ON COLUMN public.vakt_timer.original_notat IS 'Original note before sending to Tripletex';
COMMENT ON COLUMN public.vakt_timer.original_status IS 'Original status before sending to Tripletex';
