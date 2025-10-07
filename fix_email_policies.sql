-- Fix RLS policies for email_settings table
-- Run this in Supabase SQL Editor

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view email settings in their organization" ON public.email_settings;
DROP POLICY IF EXISTS "Admin/Manager can update email settings in their organization" ON public.email_settings;
DROP POLICY IF EXISTS "Admin/Manager can insert email settings in their organization" ON public.email_settings;
DROP POLICY IF EXISTS "Service role can manage email settings" ON public.email_settings;

-- Create simpler policies that should work
CREATE POLICY "Users can view email settings in their organization" 
ON public.email_settings 
FOR SELECT 
USING (
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

-- Test query to see if policies work
SELECT 
    es.*,
    p.role as user_role,
    p.user_id
FROM public.email_settings es
LEFT JOIN public.profiles p ON es.org_id = p.org_id
WHERE p.user_id = auth.uid();
