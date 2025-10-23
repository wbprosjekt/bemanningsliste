-- =====================================================
-- FIX RLS POLICIES FOR FRI BEFARING - Allow users to edit active befaringsrapporter
-- =====================================================

-- 1. Update fri_befaringer policies to allow users to edit active befaringsrapporter
DROP POLICY IF EXISTS "Admins manage own org fri befaringsrapporter" ON public.fri_befaringer;
CREATE POLICY "Admins manage own org fri befaringsrapporter"
  ON public.fri_befaringer FOR ALL
  USING (
    org_id = public.get_user_org_id()
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- Users can update fri befaringsrapporter if they are not signed/locked
DROP POLICY IF EXISTS "Users can update active fri befaringsrapporter" ON public.fri_befaringer;
CREATE POLICY "Users can update active fri befaringsrapporter"
  ON public.fri_befaringer FOR UPDATE
  USING (
    org_id = public.get_user_org_id()
    AND status = 'aktiv'  -- Only allow updates to active (non-signed) befaringsrapporter
  );

-- 2. Update befaring_punkter policies to allow users to manage punkter in active befaringsrapporter
DROP POLICY IF EXISTS "Admins manage punkter in own org" ON public.befaring_punkter;
CREATE POLICY "Admins manage punkter in own org"
  ON public.befaring_punkter FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.fri_befaringer fb
      WHERE fb.id = befaring_punkter.fri_befaring_id
      AND fb.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- Users can manage punkter in active fri befaringsrapporter
DROP POLICY IF EXISTS "Users can manage punkter in active befaringsrapporter" ON public.befaring_punkter;
CREATE POLICY "Users can manage punkter in active befaringsrapporter"
  ON public.befaring_punkter FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.fri_befaringer fb
      WHERE fb.id = befaring_punkter.fri_befaring_id
      AND fb.org_id = public.get_user_org_id()
      AND fb.status = 'aktiv'  -- Only allow updates to active befaringsrapporter
    )
  );

-- 3. Update befaring_oppgaver policies to allow users to manage oppgaver in active befaringsrapporter
DROP POLICY IF EXISTS "Admins manage oppgaver in own org" ON public.befaring_oppgaver;
CREATE POLICY "Admins manage oppgaver in own org"
  ON public.befaring_oppgaver FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.befaring_punkter bp
      JOIN public.fri_befaringer fb ON fb.id = bp.fri_befaring_id
      WHERE bp.id = befaring_oppgaver.befaring_punkt_id
      AND fb.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- Users can manage oppgaver in active fri befaringsrapporter
DROP POLICY IF EXISTS "Users can manage oppgaver in active befaringsrapporter" ON public.befaring_oppgaver;
CREATE POLICY "Users can manage oppgaver in active befaringsrapporter"
  ON public.befaring_oppgaver FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.befaring_punkter bp
      JOIN public.fri_befaringer fb ON fb.id = bp.fri_befaring_id
      WHERE bp.id = befaring_oppgaver.befaring_punkt_id
      AND fb.org_id = public.get_user_org_id()
      AND fb.status = 'aktiv'  -- Only allow updates to active befaringsrapporter
    )
  );

-- =====================================================
-- VERIFY POLICIES
-- =====================================================

-- Check that policies are created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('fri_befaringer', 'befaring_punkter', 'befaring_oppgaver')
ORDER BY tablename, policyname;
