-- Create reminder_settings table
-- Run this in Supabase SQL Editor

-- Create reminder_settings table for per-organization reminder configuration
CREATE TABLE IF NOT EXISTS public.reminder_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reminder_settings_org_id ON public.reminder_settings(org_id);

-- Enable RLS on reminder_settings
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reminder_settings
DROP POLICY IF EXISTS "Users can view reminder settings in their organization" ON public.reminder_settings;
DROP POLICY IF EXISTS "Admin/Manager can update reminder settings in their organization" ON public.reminder_settings;
DROP POLICY IF EXISTS "Admin/Manager can insert reminder settings in their organization" ON public.reminder_settings;
DROP POLICY IF EXISTS "Service role can manage reminder settings" ON public.reminder_settings;

CREATE POLICY "Users can view reminder settings in their organization" 
ON public.reminder_settings 
FOR SELECT 
USING (
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
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = reminder_settings.org_id 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Service role can manage reminder settings" 
ON public.reminder_settings 
FOR ALL 
USING (auth.role() = 'service_role');

-- Insert default reminder settings for all existing organizations
INSERT INTO public.reminder_settings (org_id, payroll_enabled, payroll_days_before, payroll_day_of_month, weekly_enabled, weekly_day, weekly_time, send_to_all)
SELECT 
    o.id as org_id,
    true as payroll_enabled,
    3 as payroll_days_before,
    10 as payroll_day_of_month,
    true as weekly_enabled,
    5 as weekly_day,
    '12:00:00'::time as weekly_time,
    true as send_to_all
FROM public.org o
WHERE NOT EXISTS (
    SELECT 1 FROM public.reminder_settings rs 
    WHERE rs.org_id = o.id
);

-- Add comments for documentation
COMMENT ON TABLE public.reminder_settings IS 'Per-organization settings for reminder system';
COMMENT ON COLUMN public.reminder_settings.payroll_day_of_month IS 'Day of month for payroll (1-31)';
COMMENT ON COLUMN public.reminder_settings.weekly_day IS 'Day of week for weekly reminders (1=Monday, 7=Sunday)';
