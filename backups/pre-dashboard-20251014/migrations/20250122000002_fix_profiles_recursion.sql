-- Fix infinite recursion in profiles RLS policy
-- The current policy creates infinite recursion by referencing profiles table within profiles policy

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Recreate the policy using the security definer function to avoid recursion
CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles 
FOR SELECT 
USING (org_id = public.get_user_org_id());
