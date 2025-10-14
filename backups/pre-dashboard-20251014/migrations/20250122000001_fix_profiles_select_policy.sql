-- Fix RLS policy for profiles table to ensure all profiles in the same org are visible
-- The current policy using get_user_org_id() might have issues with edge function created profiles

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Create a new policy that directly checks org_id
CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Also ensure the service role can view all profiles (for debugging)
CREATE POLICY "Service role can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.role() = 'service_role');
