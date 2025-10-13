-- ============================================================
-- FIX OPPGAVER RLS POLICY
-- ============================================================
-- Problem 1: Policy checks profiles.id = auth.uid() (WRONG - should be user_id)
-- Problem 2: Only admin/manager can create oppgaver (WRONG - all users should)
-- Problem 3: Missing WITH CHECK clause for INSERT operations
-- ============================================================

-- Step 1: Drop the broken policy completely
DROP POLICY IF EXISTS "Admins manage oppgaver in own org" ON public.oppgaver;

-- Step 2: Drop if exists (in case already created)
DROP POLICY IF EXISTS "Users manage oppgaver in own org" ON public.oppgaver;

-- Step 3: Create NEW policy that allows ALL users in the organization
CREATE POLICY "Users manage oppgaver in own org"
  ON public.oppgaver
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 
      FROM public.plantegninger p
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE p.id = oppgaver.plantegning_id
      AND b.org_id = public.get_user_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.plantegninger p
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE p.id = oppgaver.plantegning_id
      AND b.org_id = public.get_user_org_id()
    )
  );

-- Step 3: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

