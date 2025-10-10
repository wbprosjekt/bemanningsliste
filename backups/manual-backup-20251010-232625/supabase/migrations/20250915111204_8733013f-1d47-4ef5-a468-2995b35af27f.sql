-- Fix security issue: Set search_path for the function
CREATE OR REPLACE FUNCTION public.generate_client_reference(org_uuid UUID, timer_uuid UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN org_uuid::text || '-' || timer_uuid::text;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;