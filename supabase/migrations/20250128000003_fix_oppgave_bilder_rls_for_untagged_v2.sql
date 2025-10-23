-- =====================================================
-- FIX OPPGAVE_BILDER RLS FOR UNTAGGED PHOTOS
-- =====================================================
-- Denne migrasjonen fikser RLS policies på oppgave_bilder
-- for å tillate alle brukere å se untagged bilder,
-- mens admin/manager kreves for bilder koblet til oppgaver.

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins manage oppgave_bilder in own org" ON public.oppgave_bilder;

-- Create new policy that allows all users to see untagged photos
-- but requires admin/manager for photos linked to oppgaver
CREATE POLICY "Users see oppgave_bilder in own org"
  ON public.oppgave_bilder FOR SELECT
  USING (
    -- Allow all users to see untagged photos (no oppgave_id or befaring_punkt_id)
    (oppgave_id IS NULL AND befaring_punkt_id IS NULL)
    OR
    -- For photos linked to oppgaver, require admin/manager role
    (oppgave_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.oppgaver o
      WHERE o.id = oppgave_bilder.oppgave_id
      AND (
        -- Plantegning-based oppgaver
        (o.plantegning_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.plantegninger p
          JOIN public.befaringer b ON b.id = p.befaring_id
          WHERE p.id = o.plantegning_id
          AND b.org_id = public.get_user_org_id()
        ))
        OR
        -- Befaring-level general oppgaver
        (o.befaring_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.befaringer b
          WHERE b.id = o.befaring_id
          AND b.org_id = public.get_user_org_id()
        ))
        OR
        -- Project-level general oppgaver
        (o.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.ttx_project_cache p
          WHERE p.id = o.project_id
          AND p.org_id = public.get_user_org_id()
        ))
      )
      AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
    ))
    OR
    -- For photos linked to befaring_punkter, allow all users in org
    (befaring_punkt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.befaring_punkter bp
      JOIN public.fri_befaringer fb ON fb.id = bp.fri_befaring_id
      WHERE bp.id = oppgave_bilder.befaring_punkt_id
      AND fb.org_id = public.get_user_org_id()
    ))
  );

-- Create policy for INSERT operations
CREATE POLICY "Users upload oppgave_bilder in own org"
  ON public.oppgave_bilder FOR INSERT
  WITH CHECK (
    -- Allow all users to upload untagged photos
    (oppgave_id IS NULL AND befaring_punkt_id IS NULL)
    OR
    -- For photos linked to oppgaver, require admin/manager role
    (oppgave_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.oppgaver o
      WHERE o.id = oppgave_bilder.oppgave_id
      AND (
        (o.plantegning_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.plantegninger p
          JOIN public.befaringer b ON b.id = p.befaring_id
          WHERE p.id = o.plantegning_id
          AND b.org_id = public.get_user_org_id()
        ))
        OR
        (o.befaring_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.befaringer b
          WHERE b.id = o.befaring_id
          AND b.org_id = public.get_user_org_id()
        ))
        OR
        (o.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.ttx_project_cache p
          WHERE p.id = o.project_id
          AND p.org_id = public.get_user_org_id()
        ))
      )
      AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
    ))
    OR
    -- For photos linked to befaring_punkter, allow all users in org
    (befaring_punkt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.befaring_punkter bp
      JOIN public.fri_befaringer fb ON fb.id = bp.fri_befaring_id
      WHERE bp.id = oppgave_bilder.befaring_punkt_id
      AND fb.org_id = public.get_user_org_id()
    ))
  );

-- Create policy for UPDATE operations
CREATE POLICY "Users update oppgave_bilder in own org"
  ON public.oppgave_bilder FOR UPDATE
  USING (
    -- Same logic as SELECT policy
    (oppgave_id IS NULL AND befaring_punkt_id IS NULL)
    OR
    (oppgave_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.oppgaver o
      WHERE o.id = oppgave_bilder.oppgave_id
      AND (
        (o.plantegning_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.plantegninger p
          JOIN public.befaringer b ON b.id = p.befaring_id
          WHERE p.id = o.plantegning_id
          AND b.org_id = public.get_user_org_id()
        ))
        OR
        (o.befaring_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.befaringer b
          WHERE b.id = o.befaring_id
          AND b.org_id = public.get_user_org_id()
        ))
        OR
        (o.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.ttx_project_cache p
          WHERE p.id = o.project_id
          AND p.org_id = public.get_user_org_id()
        ))
      )
      AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
    ))
    OR
    (befaring_punkt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.befaring_punkter bp
      JOIN public.fri_befaringer fb ON fb.id = bp.fri_befaring_id
      WHERE bp.id = oppgave_bilder.befaring_punkt_id
      AND fb.org_id = public.get_user_org_id()
    ))
  );

-- Create policy for DELETE operations
CREATE POLICY "Users delete oppgave_bilder in own org"
  ON public.oppgave_bilder FOR DELETE
  USING (
    -- Same logic as SELECT policy
    (oppgave_id IS NULL AND befaring_punkt_id IS NULL)
    OR
    (oppgave_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.oppgaver o
      WHERE o.id = oppgave_bilder.oppgave_id
      AND (
        (o.plantegning_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.plantegninger p
          JOIN public.befaringer b ON b.id = p.befaring_id
          WHERE p.id = o.plantegning_id
          AND b.org_id = public.get_user_org_id()
        ))
        OR
        (o.befaring_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.befaringer b
          WHERE b.id = o.befaring_id
          AND b.org_id = public.get_user_org_id()
        ))
        OR
        (o.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.ttx_project_cache p
          WHERE p.id = o.project_id
          AND p.org_id = public.get_user_org_id()
        ))
      )
      AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
    ))
    OR
    (befaring_punkt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.befaring_punkter bp
      JOIN public.fri_befaringer fb ON fb.id = bp.fri_befaring_id
      WHERE bp.id = oppgave_bilder.befaring_punkt_id
      AND fb.org_id = public.get_user_org_id()
    ))
  );

COMMENT ON POLICY "Users see oppgave_bilder in own org" ON public.oppgave_bilder IS 'Allows all users to see untagged photos, admin/manager required for photos linked to oppgaver';
COMMENT ON POLICY "Users upload oppgave_bilder in own org" ON public.oppgave_bilder IS 'Allows all users to upload untagged photos, admin/manager required for photos linked to oppgaver';
COMMENT ON POLICY "Users update oppgave_bilder in own org" ON public.oppgave_bilder IS 'Allows all users to update untagged photos, admin/manager required for photos linked to oppgaver';
COMMENT ON POLICY "Users delete oppgave_bilder in own org" ON public.oppgave_bilder IS 'Allows all users to delete untagged photos, admin/manager required for photos linked to oppgaver';

