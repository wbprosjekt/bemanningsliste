-- Create reminder_settings table for per-organization reminder configuration
CREATE TABLE public.reminder_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.profiles(org_id) ON DELETE CASCADE,
    
    -- Payroll reminder settings
    payroll_enabled BOOLEAN DEFAULT true,
    payroll_days_before INTEGER DEFAULT 3 CHECK (payroll_days_before >= 1 AND payroll_days_before <= 14),
    payroll_day_of_month INTEGER DEFAULT 10 CHECK (payroll_day_of_month >= 1 AND payroll_day_of_month <= 31),
    
    -- Weekly reminder settings
    weekly_enabled BOOLEAN DEFAULT true,
    weekly_day INTEGER DEFAULT 5 CHECK (weekly_day >= 1 AND weekly_day <= 7), -- 1=Monday, 7=Sunday
    weekly_time TIME DEFAULT '12:00:00',
    
    -- Recipients settings
    send_to_all BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one settings record per organization
    UNIQUE(org_id)
);

-- Create email_templates table for customizable email templates
CREATE TABLE public.email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.profiles(org_id) ON DELETE CASCADE,
    template_type TEXT NOT NULL CHECK (template_type IN ('payroll', 'weekly', 'test')),
    
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb, -- Array of available variables
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one template per type per organization
    UNIQUE(org_id, template_type)
);

-- Create reminder_logs table for tracking sent reminders
CREATE TABLE public.reminder_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.profiles(org_id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('payroll', 'weekly', 'test')),
    
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recipients_count INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_reminder_settings_org_id ON public.reminder_settings(org_id);
CREATE INDEX idx_email_templates_org_id ON public.email_templates(org_id);
CREATE INDEX idx_email_templates_type ON public.email_templates(template_type);
CREATE INDEX idx_reminder_logs_org_id ON public.reminder_logs(org_id);
CREATE INDEX idx_reminder_logs_sent_at ON public.reminder_logs(sent_at);

-- Add RLS policies for reminder_settings
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reminder settings in their organization" 
ON public.reminder_settings 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = reminder_settings.org_id 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Admin/Manager can update reminder settings in their organization" 
ON public.reminder_settings 
FOR UPDATE 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = reminder_settings.org_id 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Admin/Manager can insert reminder settings in their organization" 
ON public.reminder_settings 
FOR INSERT 
WITH CHECK (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = reminder_settings.org_id 
        AND role IN ('admin', 'manager')
    )
);

-- Add RLS policies for email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email templates in their organization" 
ON public.email_templates 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = email_templates.org_id 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Admin/Manager can update email templates in their organization" 
ON public.email_templates 
FOR UPDATE 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = email_templates.org_id 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Admin/Manager can insert email templates in their organization" 
ON public.email_templates 
FOR INSERT 
WITH CHECK (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = email_templates.org_id 
        AND role IN ('admin', 'manager')
    )
);

-- Add RLS policies for reminder_logs
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reminder logs in their organization" 
ON public.reminder_logs 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = reminder_logs.org_id 
        AND role IN ('admin', 'manager')
    )
);

-- Add service role policies for edge functions
CREATE POLICY "Service role can manage reminder settings" 
ON public.reminder_settings 
FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage email templates" 
ON public.email_templates 
FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage reminder logs" 
ON public.reminder_logs 
FOR ALL 
USING (auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE public.reminder_settings IS 'Per-organization settings for reminder system';
COMMENT ON TABLE public.email_templates IS 'Customizable email templates for reminders';
COMMENT ON TABLE public.reminder_logs IS 'Log of sent reminders for tracking and debugging';

COMMENT ON COLUMN public.reminder_settings.payroll_day_of_month IS 'Day of month for payroll (1-31)';
COMMENT ON COLUMN public.reminder_settings.weekly_day IS 'Day of week for weekly reminders (1=Monday, 7=Sunday)';
COMMENT ON COLUMN public.email_templates.template_type IS 'Type of template: payroll, weekly, or test';
COMMENT ON COLUMN public.email_templates.variables IS 'JSON array of available variables for template';





