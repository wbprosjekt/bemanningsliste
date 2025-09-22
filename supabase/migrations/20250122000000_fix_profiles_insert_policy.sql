-- Fix profiles INSERT policy to allow admin/manager users to create profiles for others
-- This is needed for the tripletex-create-profile edge function to work

-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create a new INSERT policy that allows admin/manager users to create profiles for others
-- while still allowing users to create their own profiles
CREATE POLICY "Users can insert profiles in their organization" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
    -- Allow users to create their own profile
    user_id = auth.uid() 
    OR 
    -- Allow admin/manager users to create profiles for others in their organization
    (
        org_id IN (
            SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
        )
        AND 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = auth.uid() 
            AND org_id = profiles.org_id 
            AND role IN ('admin', 'manager')
        )
    )
);

-- Also add a policy to allow service role (edge functions) to insert profiles
-- This is needed for the tripletex-create-profile edge function
CREATE POLICY "Service role can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');
