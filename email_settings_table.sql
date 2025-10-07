-- Create email_settings table for per-organization email configuration
-- Run this directly in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.email_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    
    -- Email service configuration
    provider TEXT NOT NULL DEFAULT 'resend' CHECK (provider IN ('resend', 'sendgrid', 'smtp')),
    api_key TEXT NOT NULL,
    from_email TEXT NOT NULL,
    from_name TEXT NOT NULL DEFAULT 'Bemanningsliste',
    site_url TEXT NOT NULL DEFAULT 'https://bemanningsliste.vercel.app',
    
    -- SMTP settings (if using custom SMTP)
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_username TEXT,
    smtp_password TEXT,
    smtp_secure BOOLEAN DEFAULT true,
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    last_tested_at TIMESTAMP WITH TIME ZONE,
    test_status TEXT CHECK (test_status IN ('success', 'failed', 'pending')),
    test_error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one settings record per organization
    UNIQUE(org_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_settings_org_id ON public.email_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_email_settings_provider ON public.email_settings(provider);
CREATE INDEX IF NOT EXISTS idx_email_settings_active ON public.email_settings(is_active);

-- Add RLS policies for email_settings
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view email settings in their organization" ON public.email_settings;
DROP POLICY IF EXISTS "Admin/Manager can update email settings in their organization" ON public.email_settings;
DROP POLICY IF EXISTS "Admin/Manager can insert email settings in their organization" ON public.email_settings;
DROP POLICY IF EXISTS "Service role can manage email settings" ON public.email_settings;

CREATE POLICY "Users can view email settings in their organization" 
ON public.email_settings 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = email_settings.org_id 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Admin/Manager can update email settings in their organization" 
ON public.email_settings 
FOR UPDATE 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = email_settings.org_id 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Admin/Manager can insert email settings in their organization" 
ON public.email_settings 
FOR INSERT 
WITH CHECK (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = email_settings.org_id 
        AND role IN ('admin', 'manager')
    )
);

-- Add service role policies for edge functions
CREATE POLICY "Service role can manage email settings" 
ON public.email_settings 
FOR ALL 
USING (auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE public.email_settings IS 'Per-organization email service configuration';
COMMENT ON COLUMN public.email_settings.provider IS 'Email service provider: resend, sendgrid, or smtp';
COMMENT ON COLUMN public.email_settings.api_key IS 'API key for email service (encrypted in production)';
COMMENT ON COLUMN public.email_settings.from_email IS 'From email address for sent emails';
COMMENT ON COLUMN public.email_settings.from_name IS 'From name for sent emails';
COMMENT ON COLUMN public.email_settings.test_status IS 'Status of last email test: success, failed, or pending';
