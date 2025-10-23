-- Allow admins/managers to update profiles within their organization
DROP POLICY IF EXISTS "Users can update profiles in their organization" ON public.profiles;

CREATE POLICY "Users can update profiles in their organization"
ON public.profiles
FOR UPDATE
USING (
    -- The acting user must belong to the same organization
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND (
        -- Users may update their own profile
        auth.uid() = user_id
        OR
        -- Admins and managers may update other profiles in the organization
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND org_id = profiles.org_id
            AND role IN ('admin', 'manager')
        )
    )
)
WITH CHECK (
    -- Ensure the modified row stays within the same organization
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND org_id = profiles.org_id
            AND role IN ('admin', 'manager')
        )
    )
);

-- Allow edge functions (service role) to perform updates
DROP POLICY IF EXISTS "Service role can update profiles" ON public.profiles;

CREATE POLICY "Service role can update profiles"
ON public.profiles
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
