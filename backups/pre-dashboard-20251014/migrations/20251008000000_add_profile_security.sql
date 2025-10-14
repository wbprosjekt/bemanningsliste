-- =====================================================
-- SECURITY FIX: Profile validation and RLS policies
-- =====================================================
-- Created: 2025-10-08
-- Purpose: Ensure all users have profiles and proper access control
-- =====================================================

-- 1. Create function to check if user has profile
CREATE OR REPLACE FUNCTION public.user_has_profile()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create function to get user's org_id (used in RLS policies)
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT org_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Add RLS policy to vakt table - require profile
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view vakt in their org" ON public.vakt;
  DROP POLICY IF EXISTS "Users can insert vakt in their org" ON public.vakt;
  DROP POLICY IF EXISTS "Users can update vakt in their org" ON public.vakt;
  DROP POLICY IF EXISTS "Users can delete vakt in their org" ON public.vakt;
END $$;

-- Enable RLS on vakt if not already enabled
ALTER TABLE public.vakt ENABLE ROW LEVEL SECURITY;

-- Create new policies that require profile
CREATE POLICY "Users can view vakt in their org"
  ON public.vakt
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND user_has_profile() 
    AND org_id = get_user_org_id()
  );

CREATE POLICY "Users can insert vakt in their org"
  ON public.vakt
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_has_profile() 
    AND org_id = get_user_org_id()
  );

CREATE POLICY "Users can update vakt in their org"
  ON public.vakt
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL 
    AND user_has_profile() 
    AND org_id = get_user_org_id()
  );

CREATE POLICY "Users can delete vakt in their org"
  ON public.vakt
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL 
    AND user_has_profile() 
    AND org_id = get_user_org_id()
  );

-- 4. Add RLS policies to person table
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view person in their org" ON public.person;
  DROP POLICY IF EXISTS "Admins can manage person in their org" ON public.person;
END $$;

ALTER TABLE public.person ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view person in their org"
  ON public.person
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND user_has_profile() 
    AND org_id = get_user_org_id()
  );

CREATE POLICY "Admins can manage person in their org"
  ON public.person
  FOR ALL
  USING (
    auth.uid() IS NOT NULL 
    AND user_has_profile() 
    AND org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- 5. Add RLS policies to profiles table
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can view profiles in their org" ON public.profiles;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

CREATE POLICY "Admins can view profiles in their org"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.org_id = profiles.org_id
      AND p.role IN ('admin', 'manager')
    )
  );

-- 6. Add RLS policies to org table
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their org" ON public.org;
  DROP POLICY IF EXISTS "Admins can update their org" ON public.org;
END $$;

ALTER TABLE public.org ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org"
  ON public.org
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND user_has_profile()
    AND id = get_user_org_id()
  );

CREATE POLICY "Admins can update their org"
  ON public.org
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL 
    AND user_has_profile()
    AND id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin')
    )
  );

-- 7. Add RLS policies to ttx_project_cache
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view projects in their org" ON public.ttx_project_cache;
  DROP POLICY IF EXISTS "Admins can manage projects in their org" ON public.ttx_project_cache;
END $$;

ALTER TABLE public.ttx_project_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in their org"
  ON public.ttx_project_cache
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND user_has_profile() 
    AND org_id = get_user_org_id()
  );

CREATE POLICY "Admins can manage projects in their org"
  ON public.ttx_project_cache
  FOR ALL
  USING (
    auth.uid() IS NOT NULL 
    AND user_has_profile() 
    AND org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- 8. Add RLS policies to ttx_employee_cache
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view employees in their org" ON public.ttx_employee_cache;
  DROP POLICY IF EXISTS "Admins can manage employees in their org" ON public.ttx_employee_cache;
END $$;

ALTER TABLE public.ttx_employee_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employees in their org"
  ON public.ttx_employee_cache
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND user_has_profile() 
    AND org_id = get_user_org_id()
  );

CREATE POLICY "Admins can manage employees in their org"
  ON public.ttx_employee_cache
  FOR ALL
  USING (
    auth.uid() IS NOT NULL 
    AND user_has_profile() 
    AND org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- 9. Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_vakt_org_id_date ON public.vakt(org_id, dato);
CREATE INDEX IF NOT EXISTS idx_person_org_id ON public.person(org_id);

-- 10. Add comment for documentation
COMMENT ON FUNCTION public.user_has_profile() IS 
  'Security function: Checks if authenticated user has a profile in the system';

COMMENT ON FUNCTION public.get_user_org_id() IS 
  'Security function: Returns the organization ID for the authenticated user';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Profile security policies applied successfully';
  RAISE NOTICE '✅ RLS enabled on all core tables';
  RAISE NOTICE '✅ Users now require profiles to access data';
END $$;

