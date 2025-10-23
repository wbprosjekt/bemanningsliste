-- =====================================================
-- FRI BEFARING - OPPGAVE BILDER INTEGRATION
-- =====================================================
-- Utvider eksisterende oppgave_bilder tabell for å støtte fri befaringsrapporter
-- Beholder bakoverkompatibilitet med eksisterende befaringsmodul

-- =====================================================
-- 1. OPPDATER OPPGAVE_BILDER TABELL
-- =====================================================

-- Legg til kolonner for fri befaringsrapporter
DO $$ 
BEGIN
  -- befaring_punkt_id for fri befaringsrapporter
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'oppgave_bilder' AND column_name = 'befaring_punkt_id'
  ) THEN
    ALTER TABLE public.oppgave_bilder ADD COLUMN befaring_punkt_id uuid REFERENCES public.befaring_punkter(id) ON DELETE CASCADE;
  END IF;

  -- image_source for å skille mellom oppgave-bilder og punkt-bilder
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'oppgave_bilder' AND column_name = 'image_source'
  ) THEN
    ALTER TABLE public.oppgave_bilder ADD COLUMN image_source text DEFAULT 'oppgave' CHECK (image_source IN ('oppgave', 'punkt'));
  END IF;
END $$;

-- =====================================================
-- 2. OPPDATER CONSTRAINTS
-- =====================================================

-- Sørg for at enten oppgave_id eller befaring_punkt_id er satt
ALTER TABLE public.oppgave_bilder 
DROP CONSTRAINT IF EXISTS oppgave_bilder_oppgave_or_punkt_check;

-- Fiks eksisterende data før vi setter constraint
DO $$ 
BEGIN
  -- Sett image_source for eksisterende rader
  UPDATE public.oppgave_bilder 
  SET image_source = 'oppgave'
  WHERE oppgave_id IS NOT NULL AND befaring_punkt_id IS NULL;
  
  -- Hvis det finnes rader med begge NULL (skjer ikke normalt), sett oppgave_id til første tilgjengelige
  -- Dette er en sikkerhetsmekanisme
  IF EXISTS (
    SELECT 1 FROM public.oppgave_bilder 
    WHERE oppgave_id IS NULL AND befaring_punkt_id IS NULL
  ) THEN
    -- Finn første oppgave_id som finnes
    UPDATE public.oppgave_bilder 
    SET oppgave_id = (
      SELECT o.id FROM public.oppgaver o LIMIT 1
    )
    WHERE oppgave_id IS NULL AND befaring_punkt_id IS NULL;
  END IF;
  
  -- Hvis det finnes rader med begge satt (skjer ikke normalt), nullstill befaring_punkt_id
  UPDATE public.oppgave_bilder 
  SET befaring_punkt_id = NULL
  WHERE oppgave_id IS NOT NULL AND befaring_punkt_id IS NOT NULL;
END $$;

ALTER TABLE public.oppgave_bilder 
ADD CONSTRAINT oppgave_bilder_oppgave_or_punkt_check 
CHECK (
  (oppgave_id IS NOT NULL AND befaring_punkt_id IS NULL) OR
  (oppgave_id IS NULL AND befaring_punkt_id IS NOT NULL)
);

-- =====================================================
-- 3. OPPDATER INDEXES
-- =====================================================

-- Index for befaring_punkt_id
CREATE INDEX IF NOT EXISTS idx_oppgave_bilder_befaring_punkt_id ON public.oppgave_bilder(befaring_punkt_id);

-- Index for image_source
CREATE INDEX IF NOT EXISTS idx_oppgave_bilder_image_source ON public.oppgave_bilder(image_source);

-- =====================================================
-- 4. OPPDATER RLS POLICIES
-- =====================================================

-- Oppdater eksisterende policy for å inkludere befaring_punkt_id
DROP POLICY IF EXISTS "Users see bilder in own org" ON public.oppgave_bilder;
CREATE POLICY "Users see bilder in own org"
  ON public.oppgave_bilder FOR SELECT
  USING (
    -- Eksisterende oppgave-bilder
    EXISTS (
      SELECT 1 FROM public.oppgaver o
      JOIN public.plantegninger p ON p.id = o.plantegning_id
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE o.id = oppgave_bilder.oppgave_id
      AND b.org_id = public.get_user_org_id()
    )
    OR
    -- Nye punkt-bilder for fri befaringsrapporter
    EXISTS (
      SELECT 1 FROM public.befaring_punkter bp
      JOIN public.fri_befaringer fb ON fb.id = bp.fri_befaring_id
      WHERE bp.id = oppgave_bilder.befaring_punkt_id
      AND fb.org_id = public.get_user_org_id()
    )
  );

-- Oppdater eksisterende policy for å inkludere befaring_punkt_id
DROP POLICY IF EXISTS "Users upload bilder in own org" ON public.oppgave_bilder;
CREATE POLICY "Users upload bilder in own org"
  ON public.oppgave_bilder FOR INSERT
  WITH CHECK (
    -- Eksisterende oppgave-bilder
    EXISTS (
      SELECT 1 FROM public.oppgaver o
      JOIN public.plantegninger p ON p.id = o.plantegning_id
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE o.id = oppgave_bilder.oppgave_id
      AND b.org_id = public.get_user_org_id()
    )
    OR
    -- Nye punkt-bilder for fri befaringsrapporter
    EXISTS (
      SELECT 1 FROM public.befaring_punkter bp
      JOIN public.fri_befaringer fb ON fb.id = bp.fri_befaring_id
      WHERE bp.id = oppgave_bilder.befaring_punkt_id
      AND fb.org_id = public.get_user_org_id()
    )
  );

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to get image count for a befaring punkt
CREATE OR REPLACE FUNCTION public.get_befaring_punkt_image_count(punkt_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.oppgave_bilder
    WHERE befaring_punkt_id = punkt_id
      AND image_source = 'punkt'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get image count for an oppgave
CREATE OR REPLACE FUNCTION public.get_oppgave_image_count(oppgave_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.oppgave_bilder
    WHERE oppgave_id = oppgave_id
      AND image_source = 'oppgave'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. COMMENTS (Documentation)
-- =====================================================

COMMENT ON COLUMN public.oppgave_bilder.befaring_punkt_id IS 'Reference to befaring_punkter for fri befaringsrapporter';
COMMENT ON COLUMN public.oppgave_bilder.image_source IS 'Source type: oppgave (existing) or punkt (new for fri befaringsrapporter)';
COMMENT ON CONSTRAINT oppgave_bilder_oppgave_or_punkt_check ON public.oppgave_bilder IS 'Ensures either oppgave_id or befaring_punkt_id is set, but not both';
