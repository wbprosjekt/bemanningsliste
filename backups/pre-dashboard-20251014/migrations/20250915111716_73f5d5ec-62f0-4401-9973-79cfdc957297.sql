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