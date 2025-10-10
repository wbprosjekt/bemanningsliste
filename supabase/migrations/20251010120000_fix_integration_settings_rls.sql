-- Fix RLS policies for integration_settings to restrict access to admin/manager only
-- This prevents regular users from viewing sensitive API keys and tokens

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view integration settings in their organization" ON public.integration_settings;
DROP POLICY IF EXISTS "Users can manage integration settings in their organization" ON public.integration_settings;

-- Create restrictive policy: only admin/manager can view
CREATE POLICY "Only admins and managers can view integration settings"
ON public.integration_settings 
FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Create restrictive policy: only admin/manager can manage
CREATE POLICY "Only admins and managers can manage integration settings"
ON public.integration_settings 
FOR ALL
USING (
  org_id IN (
    SELECT org_id FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Add comment for documentation
COMMENT ON TABLE public.integration_settings IS 'Stores integration settings including API keys. Access restricted to admin/manager roles only for security.';

