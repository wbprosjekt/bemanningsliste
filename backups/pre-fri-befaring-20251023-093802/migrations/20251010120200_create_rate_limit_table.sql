-- Create rate limiting table for persistent rate limit tracking across Edge Function cold starts
CREATE TABLE IF NOT EXISTS public.rate_limits (
  identifier TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (but allow public access for service role functions)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage rate limits
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limits
FOR ALL
TO service_role
USING (true);

-- Create index for efficient cleanup and queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_updated_at ON public.rate_limits(updated_at);

-- Create cleanup function to remove old rate limit entries
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete entries older than 5 minutes
  DELETE FROM public.rate_limits 
  WHERE window_start < now() - INTERVAL '5 minutes';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check and increment rate limit atomically
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_max_requests INTEGER DEFAULT 20,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  window_expired BOOLEAN;
BEGIN
  -- Lock the row for this identifier to prevent race conditions
  SELECT 
    request_count,
    (window_start + (p_window_seconds || ' seconds')::INTERVAL) < now()
  INTO current_count, window_expired
  FROM public.rate_limits
  WHERE identifier = p_identifier
  FOR UPDATE;
  
  -- If no record exists or window expired, create/reset
  IF NOT FOUND OR window_expired THEN
    INSERT INTO public.rate_limits (identifier, request_count, window_start, updated_at)
    VALUES (p_identifier, 1, now(), now())
    ON CONFLICT (identifier) 
    DO UPDATE SET 
      request_count = 1,
      window_start = now(),
      updated_at = now();
    
    RETURN TRUE;
  END IF;
  
  -- Check if limit exceeded
  IF current_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Increment counter
  UPDATE public.rate_limits
  SET 
    request_count = request_count + 1,
    updated_at = now()
  WHERE identifier = p_identifier;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE public.rate_limits IS 'Persistent rate limiting storage for Edge Functions. Survives cold starts.';
COMMENT ON FUNCTION public.cleanup_old_rate_limits() IS 'Removes rate limit entries older than 5 minutes. Should be called periodically.';
COMMENT ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) IS 'Atomically checks and increments rate limit. Returns TRUE if allowed, FALSE if limit exceeded.';

-- Schedule automatic cleanup (runs every 5 minutes)
-- This requires pg_cron extension
DO $$
BEGIN
  -- Only schedule if pg_cron is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Try to unschedule existing job if it exists
    BEGIN
      PERFORM cron.unschedule('cleanup-rate-limits');
    EXCEPTION WHEN OTHERS THEN
      -- Job doesn't exist, that's fine
    END;
    
    -- Schedule new job
    PERFORM cron.schedule(
      'cleanup-rate-limits',
      '*/5 * * * *', -- Every 5 minutes
      $$SELECT cleanup_old_rate_limits();$$
    );
  END IF;
END $$;

