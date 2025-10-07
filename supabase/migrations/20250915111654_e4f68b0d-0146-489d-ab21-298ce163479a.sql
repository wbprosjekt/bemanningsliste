-- Create sync_log table for tracking synchronization results
CREATE TABLE public.sync_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL,
    results JSONB NOT NULL DEFAULT '{}',
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for sync_log table
CREATE POLICY "Users can view sync logs in their organization" 
ON public.sync_log 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create index for better performance
CREATE INDEX idx_sync_log_org_id ON public.sync_log(org_id);
CREATE INDEX idx_sync_log_completed_at ON public.sync_log(completed_at);

-- Set up cron job for nightly sync at 02:00
SELECT cron.schedule(
  'tripletex-nightly-sync',
  '0 2 * * *', -- Every day at 02:00
  $$
  SELECT
    net.http_post(
        url:='https://jlndohflirfixbinqdwe.supabase.co/functions/v1/nightly-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body:='{"triggered_by": "cron", "time": "' || now()::text || '"}'::jsonb
    ) as request_id;
  $$
);