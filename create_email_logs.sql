-- Create email_logs table for detailed email tracking
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    
    -- Email details
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    template_type TEXT NOT NULL CHECK (template_type IN ('payroll', 'weekly', 'test')),
    
    -- Sending details
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT,
    
    -- Provider details
    provider TEXT NOT NULL DEFAULT 'resend',
    message_id TEXT, -- External provider message ID
    provider_response JSONB, -- Full response from email provider
    
    -- Context
    triggered_by TEXT NOT NULL CHECK (triggered_by IN ('manual', 'cron', 'test')),
    reminder_type TEXT CHECK (reminder_type IN ('payroll', 'weekly', 'test')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_logs_org_id ON public.email_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_type ON public.email_logs(template_type);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view email logs in their organization" 
ON public.email_logs 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = email_logs.org_id 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Service role can manage email logs" 
ON public.email_logs 
FOR ALL 
USING (auth.role() = 'service_role');

-- Add comments
COMMENT ON TABLE public.email_logs IS 'Detailed log of all emails sent through the system';
COMMENT ON COLUMN public.email_logs.message_id IS 'External provider message ID (e.g., Resend message ID)';
COMMENT ON COLUMN public.email_logs.provider_response IS 'Full JSON response from email provider';
COMMENT ON COLUMN public.email_logs.triggered_by IS 'How the email was triggered: manual, cron, or test';
