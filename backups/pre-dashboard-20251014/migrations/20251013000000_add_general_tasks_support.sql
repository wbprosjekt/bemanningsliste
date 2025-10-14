-- Add support for general tasks (not tied to plantegning)
-- This allows tasks at project level and befaring level

-- First, make plantegning_id nullable in oppgaver table
ALTER TABLE public.oppgaver 
ALTER COLUMN plantegning_id DROP NOT NULL;

-- Add new columns for general tasks
ALTER TABLE public.oppgaver 
ADD COLUMN befaring_id uuid REFERENCES public.befaringer(id) ON DELETE CASCADE,
ADD COLUMN project_id uuid REFERENCES public.ttx_project_cache(id) ON DELETE CASCADE;

-- Add constraint to ensure at least one of plantegning_id, befaring_id, or project_id is set
ALTER TABLE public.oppgaver 
ADD CONSTRAINT oppgaver_must_have_parent 
CHECK (
  (plantegning_id IS NOT NULL)::int + 
  (befaring_id IS NOT NULL)::int + 
  (project_id IS NOT NULL)::int = 1
);

-- Update oppgave_nummer to be nullable for general tasks (since they don't need numbering like plantegning tasks)
ALTER TABLE public.oppgaver 
ALTER COLUMN oppgave_nummer DROP NOT NULL;

-- Update x_position and y_position to be nullable for general tasks (since they don't have coordinates)
ALTER TABLE public.oppgaver 
ALTER COLUMN x_position DROP NOT NULL,
ALTER COLUMN y_position DROP NOT NULL;

-- Add constraint to ensure x_position and y_position are only required for plantegning tasks
ALTER TABLE public.oppgaver 
ADD CONSTRAINT oppgaver_coordinates_required_for_plantegning 
CHECK (
  (plantegning_id IS NOT NULL AND x_position IS NOT NULL AND y_position IS NOT NULL) OR
  (plantegning_id IS NULL)
);

-- Add constraint to ensure oppgave_nummer is only required for plantegning tasks
ALTER TABLE public.oppgaver 
ADD CONSTRAINT oppgaver_nummer_required_for_plantegning 
CHECK (
  (plantegning_id IS NOT NULL AND oppgave_nummer IS NOT NULL) OR
  (plantegning_id IS NULL)
);

-- Update RLS policies to handle new task types

-- Drop existing RLS policy for oppgaver
DROP POLICY IF EXISTS "Admins manage oppgaver in own org" ON public.oppgaver;

-- Create new comprehensive RLS policy for oppgaver
CREATE POLICY "Admins manage oppgaver in own org"
  ON public.oppgaver FOR ALL
  USING (
    (
      -- Plantegning-based oppgaver (existing)
      (plantegning_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.plantegninger p
        JOIN public.befaringer b ON b.id = p.befaring_id
        WHERE p.id = oppgaver.plantegning_id
        AND b.org_id = public.get_user_org_id()
      ))
      OR
      -- Befaring-level general oppgaver (new)
      (befaring_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.befaringer b
        WHERE b.id = oppgaver.befaring_id
        AND b.org_id = public.get_user_org_id()
      ))
      OR
      -- Project-level general oppgaver (new)
      (project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ttx_project_cache p
        WHERE p.id = oppgaver.project_id
        AND p.org_id = public.get_user_org_id()
      ))
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- Update oppgave_bilder RLS policy to handle new task types
DROP POLICY IF EXISTS "Admins manage oppgave_bilder in own org" ON public.oppgaver_bilder;

CREATE POLICY "Admins manage oppgave_bilder in own org"
  ON public.oppgaver_bilder FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.oppgaver o
      WHERE o.id = oppgaver_bilder.oppgave_id
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
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_oppgaver_befaring_id ON public.oppgaver(befaring_id);
CREATE INDEX IF NOT EXISTS idx_oppgaver_project_id ON public.oppgaver(project_id);

-- Add comments for documentation
COMMENT ON COLUMN public.oppgaver.befaring_id IS 'References befaring for general befaring-level tasks';
COMMENT ON COLUMN public.oppgaver.project_id IS 'References project for general project-level tasks';
COMMENT ON COLUMN public.oppgaver.plantegning_id IS 'References plantegning for plantegning-specific tasks (nullable for general tasks)';
COMMENT ON CONSTRAINT oppgaver_must_have_parent ON public.oppgaver IS 'Ensures each task belongs to exactly one parent (plantegning, befaring, or project)';
COMMENT ON CONSTRAINT oppgaver_coordinates_required_for_plantegning ON public.oppgaver IS 'Coordinates are only required for plantegning tasks';
COMMENT ON CONSTRAINT oppgaver_nummer_required_for_plantegning ON public.oppgaver IS 'Task number is only required for plantegning tasks';
