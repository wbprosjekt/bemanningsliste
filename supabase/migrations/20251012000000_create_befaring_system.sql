-- =====================================================
-- BEFARING MODULE - Complete Database Schema
-- =====================================================
-- Multi-tenant sikker med RLS policies
-- Inkluderer APEX-inspirerte features:
-- - Tekstbasert signatur
-- - Befaringstyper
-- - Automatisk rapportutsending

-- =====================================================
-- 1. OPPDATER ORG-TABELL (Modulær Pricing)
-- =====================================================

-- Legg til kolonner for modulær SaaS-arkitektur
DO $$ 
BEGIN
  -- subscription_plan
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'org' AND column_name = 'subscription_plan'
  ) THEN
    ALTER TABLE public.org ADD COLUMN subscription_plan text DEFAULT 'gratis';
  END IF;

  -- modules (array av tilgjengelige moduler)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'org' AND column_name = 'modules'
  ) THEN
    ALTER TABLE public.org ADD COLUMN modules text[] DEFAULT '{"bemanningsliste"}';
  END IF;

  -- subscription_expires_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'org' AND column_name = 'subscription_expires_at'
  ) THEN
    ALTER TABLE public.org ADD COLUMN subscription_expires_at timestamptz;
  END IF;
END $$;

-- =====================================================
-- 2. KJERNE-TABELLER
-- =====================================================

-- BEFARINGER (Hoved-tabell)
CREATE TABLE IF NOT EXISTS public.befaringer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  tripletex_project_id int REFERENCES public.ttx_project_cache(tripletex_project_id),
  title text NOT NULL,
  description text,
  adresse text,
  befaring_date date NOT NULL,
  befaring_type text DEFAULT 'standard' CHECK (befaring_type IN ('forbefaring', 'mellombefaring', 'ferdigbefaring', 'fellesarealer', 'standard')),
  status text DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'arkivert', 'avsluttet')),
  
  -- APEX-feature: Tekstbasert signatur
  signatur_navn text,
  signatur_dato timestamptz,
  signatur_rolle text CHECK (signatur_rolle IN ('klient', 'prosjektleder', 'byggherre')),
  
  -- APEX-feature: Automatisk rapportutsending
  rapport_mottakere jsonb DEFAULT '[]'::jsonb, -- Array av {email, navn, type}
  
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- PLANTEGNINGER
CREATE TABLE IF NOT EXISTS public.plantegninger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  befaring_id uuid NOT NULL REFERENCES public.befaringer(id) ON DELETE CASCADE,
  title text NOT NULL,
  image_url text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- UNDERLEVERANDØRER
CREATE TABLE IF NOT EXISTS public.underleverandorer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  navn text NOT NULL,
  epost text NOT NULL,
  telefon text,
  fag text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- OPPGAVER
CREATE TABLE IF NOT EXISTS public.oppgaver (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantegning_id uuid NOT NULL REFERENCES public.plantegninger(id) ON DELETE CASCADE,
  oppgave_nummer int NOT NULL,
  fag text NOT NULL,
  fag_color text NOT NULL DEFAULT '#6366f1',
  x_position float NOT NULL,
  y_position float NOT NULL,
  underleverandor_id uuid REFERENCES public.underleverandorer(id),
  ansvarlig_person_id uuid REFERENCES public.profiles(id),
  title text,
  description text,
  status text DEFAULT 'apen' CHECK (status IN ('apen', 'under_arbeid', 'lukket')),
  prioritet text DEFAULT 'medium' CHECK (prioritet IN ('kritisk', 'høy', 'medium', 'lav')),
  frist date,
  epost_sendt boolean DEFAULT false,
  epost_sendt_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint per plantegning
  UNIQUE(plantegning_id, oppgave_nummer)
);

-- =====================================================
-- 3. STØTTE-TABELLER (Kommentarer, Historikk, etc.)
-- =====================================================

-- OPPGAVE KOMMENTARER
CREATE TABLE IF NOT EXISTS public.oppgave_kommentarer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oppgave_id uuid NOT NULL REFERENCES public.oppgaver(id) ON DELETE CASCADE,
  kommentar text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- OPPGAVE HISTORIKK
CREATE TABLE IF NOT EXISTS public.oppgave_historikk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oppgave_id uuid NOT NULL REFERENCES public.oppgaver(id) ON DELETE CASCADE,
  felt_navn text NOT NULL,
  gammel_verdi text,
  ny_verdi text,
  endret_av uuid NOT NULL REFERENCES public.profiles(id),
  endret_at timestamptz DEFAULT now()
);

-- NOTIFIKASJONER
CREATE TABLE IF NOT EXISTS public.notifikasjoner (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bruker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  oppgave_id uuid REFERENCES public.oppgaver(id) ON DELETE CASCADE,
  type text NOT NULL,
  melding text NOT NULL,
  lest boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- OPPGAVE BILDER
CREATE TABLE IF NOT EXISTS public.oppgave_bilder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oppgave_id uuid NOT NULL REFERENCES public.oppgaver(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  image_type text DEFAULT 'standard' CHECK (image_type IN ('før', 'etter', 'standard')),
  uploaded_by uuid REFERENCES public.profiles(id),
  uploaded_by_email text,
  created_at timestamptz DEFAULT now()
);

-- OPPGAVE E-POST TOKENS (For ekstern tilgang)
CREATE TABLE IF NOT EXISTS public.oppgave_epost_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oppgave_id uuid NOT NULL REFERENCES public.oppgaver(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 4. INDEXES (Performance)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_befaringer_org_id ON public.befaringer(org_id);
CREATE INDEX IF NOT EXISTS idx_befaringer_status ON public.befaringer(status);
CREATE INDEX IF NOT EXISTS idx_befaringer_tripletex_project ON public.befaringer(tripletex_project_id);

CREATE INDEX IF NOT EXISTS idx_plantegninger_befaring_id ON public.plantegninger(befaring_id);
CREATE INDEX IF NOT EXISTS idx_plantegninger_display_order ON public.plantegninger(befaring_id, display_order);

CREATE INDEX IF NOT EXISTS idx_underleverandorer_org_id ON public.underleverandorer(org_id);
CREATE INDEX IF NOT EXISTS idx_underleverandorer_epost ON public.underleverandorer(epost);

CREATE INDEX IF NOT EXISTS idx_oppgaver_plantegning_id ON public.oppgaver(plantegning_id);
CREATE INDEX IF NOT EXISTS idx_oppgaver_status ON public.oppgaver(status);
CREATE INDEX IF NOT EXISTS idx_oppgaver_frist ON public.oppgaver(frist) WHERE frist IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oppgaver_underleverandor ON public.oppgaver(underleverandor_id);
CREATE INDEX IF NOT EXISTS idx_oppgaver_ansvarlig ON public.oppgaver(ansvarlig_person_id);

CREATE INDEX IF NOT EXISTS idx_oppgave_kommentarer_oppgave_id ON public.oppgave_kommentarer(oppgave_id);
CREATE INDEX IF NOT EXISTS idx_oppgave_historikk_oppgave_id ON public.oppgave_historikk(oppgave_id);

CREATE INDEX IF NOT EXISTS idx_notifikasjoner_bruker_id ON public.notifikasjoner(bruker_id);
CREATE INDEX IF NOT EXISTS idx_notifikasjoner_lest ON public.notifikasjoner(bruker_id, lest);

CREATE INDEX IF NOT EXISTS idx_oppgave_bilder_oppgave_id ON public.oppgave_bilder(oppgave_id);
CREATE INDEX IF NOT EXISTS idx_oppgave_epost_tokens_oppgave_id ON public.oppgave_epost_tokens(oppgave_id);
CREATE INDEX IF NOT EXISTS idx_oppgave_epost_tokens_token ON public.oppgave_epost_tokens(token);

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.befaringer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantegninger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.underleverandorer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oppgaver ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oppgave_kommentarer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oppgave_historikk ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifikasjoner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oppgave_bilder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oppgave_epost_tokens ENABLE ROW LEVEL SECURITY;

-- Helper function: Get user's org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- BEFARINGER: Users see own org befaringer
DROP POLICY IF EXISTS "Users see own org befaringer" ON public.befaringer;
CREATE POLICY "Users see own org befaringer"
  ON public.befaringer FOR SELECT
  USING (org_id = public.get_user_org_id());

DROP POLICY IF EXISTS "Admins manage own org befaringer" ON public.befaringer;
CREATE POLICY "Admins manage own org befaringer"
  ON public.befaringer FOR ALL
  USING (
    org_id = public.get_user_org_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- PLANTEGNINGER: Users see befaringer in own org
DROP POLICY IF EXISTS "Users see plantegninger in own org" ON public.plantegninger;
CREATE POLICY "Users see plantegninger in own org"
  ON public.plantegninger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.befaringer b
      WHERE b.id = plantegninger.befaring_id
      AND b.org_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Admins manage plantegninger in own org" ON public.plantegninger;
CREATE POLICY "Admins manage plantegninger in own org"
  ON public.plantegninger FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.befaringer b
      WHERE b.id = plantegninger.befaring_id
      AND b.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- UNDERLEVERANDØRER: Users see own org underleverandører
DROP POLICY IF EXISTS "Users see own org underleverandører" ON public.underleverandorer;
CREATE POLICY "Users see own org underleverandører"
  ON public.underleverandorer FOR SELECT
  USING (org_id = public.get_user_org_id());

DROP POLICY IF EXISTS "Admins manage own org underleverandører" ON public.underleverandorer;
CREATE POLICY "Admins manage own org underleverandører"
  ON public.underleverandorer FOR ALL
  USING (
    org_id = public.get_user_org_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- OPPGAVER: Users see oppgaver in own org befaringer
DROP POLICY IF EXISTS "Users see oppgaver in own org" ON public.oppgaver;
CREATE POLICY "Users see oppgaver in own org"
  ON public.oppgaver FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.plantegninger p
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE p.id = oppgaver.plantegning_id
      AND b.org_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Admins manage oppgaver in own org" ON public.oppgaver;
CREATE POLICY "Admins manage oppgaver in own org"
  ON public.oppgaver FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plantegninger p
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE p.id = oppgaver.plantegning_id
      AND b.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- OPPGAVE_KOMMENTARER: Same as oppgaver
DROP POLICY IF EXISTS "Users see kommentarer in own org" ON public.oppgave_kommentarer;
CREATE POLICY "Users see kommentarer in own org"
  ON public.oppgave_kommentarer FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.oppgaver o
      JOIN public.plantegninger p ON p.id = o.plantegning_id
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE o.id = oppgave_kommentarer.oppgave_id
      AND b.org_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Users create kommentarer in own org" ON public.oppgave_kommentarer;
CREATE POLICY "Users create kommentarer in own org"
  ON public.oppgave_kommentarer FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.oppgaver o
      JOIN public.plantegninger p ON p.id = o.plantegning_id
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE o.id = oppgave_kommentarer.oppgave_id
      AND b.org_id = public.get_user_org_id()
    )
  );

-- OPPGAVE_HISTORIKK: Read-only for all in org
DROP POLICY IF EXISTS "Users see historikk in own org" ON public.oppgave_historikk;
CREATE POLICY "Users see historikk in own org"
  ON public.oppgave_historikk FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.oppgaver o
      JOIN public.plantegninger p ON p.id = o.plantegning_id
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE o.id = oppgave_historikk.oppgave_id
      AND b.org_id = public.get_user_org_id()
    )
  );

-- System can insert historikk
DROP POLICY IF EXISTS "System can insert historikk" ON public.oppgave_historikk;
CREATE POLICY "System can insert historikk"
  ON public.oppgave_historikk FOR INSERT
  WITH CHECK (true);

-- NOTIFIKASJONER: Users see only own notifications
DROP POLICY IF EXISTS "Users see own notifikasjoner" ON public.notifikasjoner;
CREATE POLICY "Users see own notifikasjoner"
  ON public.notifikasjoner FOR SELECT
  USING (bruker_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifikasjoner" ON public.notifikasjoner;
CREATE POLICY "Users update own notifikasjoner"
  ON public.notifikasjoner FOR UPDATE
  USING (bruker_id = auth.uid());

-- System can insert notifikasjoner
DROP POLICY IF EXISTS "System can insert notifikasjoner" ON public.notifikasjoner;
CREATE POLICY "System can insert notifikasjoner"
  ON public.notifikasjoner FOR INSERT
  WITH CHECK (true);

-- OPPGAVE_BILDER: Same as oppgaver + public read with token
DROP POLICY IF EXISTS "Users see bilder in own org" ON public.oppgave_bilder;
CREATE POLICY "Users see bilder in own org"
  ON public.oppgave_bilder FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.oppgaver o
      JOIN public.plantegninger p ON p.id = o.plantegning_id
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE o.id = oppgave_bilder.oppgave_id
      AND b.org_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Users upload bilder in own org" ON public.oppgave_bilder;
CREATE POLICY "Users upload bilder in own org"
  ON public.oppgave_bilder FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.oppgaver o
      JOIN public.plantegninger p ON p.id = o.plantegning_id
      JOIN public.befaringer b ON b.id = p.befaring_id
      WHERE o.id = oppgave_bilder.oppgave_id
      AND b.org_id = public.get_user_org_id()
    )
  );

-- OPPGAVE_EPOST_TOKENS: Public read with valid token
DROP POLICY IF EXISTS "Public can read with valid token" ON public.oppgave_epost_tokens;
CREATE POLICY "Public can read with valid token"
  ON public.oppgave_epost_tokens FOR SELECT
  USING (expires_at > now());

-- System can manage tokens
DROP POLICY IF EXISTS "System can manage tokens" ON public.oppgave_epost_tokens;
CREATE POLICY "System can manage tokens"
  ON public.oppgave_epost_tokens FOR ALL
  USING (true);

-- =====================================================
-- 6. TRIGGERS (Auto-update timestamps + historikk)
-- =====================================================

-- Updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_befaringer_updated_at ON public.befaringer;
CREATE TRIGGER update_befaringer_updated_at
  BEFORE UPDATE ON public.befaringer
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_underleverandorer_updated_at ON public.underleverandorer;
CREATE TRIGGER update_underleverandorer_updated_at
  BEFORE UPDATE ON public.underleverandorer
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_oppgaver_updated_at ON public.oppgaver;
CREATE TRIGGER update_oppgaver_updated_at
  BEFORE UPDATE ON public.oppgaver
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Historikk trigger function
CREATE OR REPLACE FUNCTION public.log_oppgave_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.oppgave_historikk (oppgave_id, felt_navn, gammel_verdi, ny_verdi, endret_av)
    VALUES (NEW.id, 'status', OLD.status, NEW.status, auth.uid());
  END IF;

  -- Log frist changes
  IF OLD.frist IS DISTINCT FROM NEW.frist THEN
    INSERT INTO public.oppgave_historikk (oppgave_id, felt_navn, gammel_verdi, ny_verdi, endret_av)
    VALUES (NEW.id, 'frist', OLD.frist::text, NEW.frist::text, auth.uid());
  END IF;

  -- Log prioritet changes
  IF OLD.prioritet IS DISTINCT FROM NEW.prioritet THEN
    INSERT INTO public.oppgave_historikk (oppgave_id, felt_navn, gammel_verdi, ny_verdi, endret_av)
    VALUES (NEW.id, 'prioritet', OLD.prioritet, NEW.prioritet, auth.uid());
  END IF;

  -- Log underleverandør changes
  IF OLD.underleverandor_id IS DISTINCT FROM NEW.underleverandor_id THEN
    INSERT INTO public.oppgave_historikk (oppgave_id, felt_navn, gammel_verdi, ny_verdi, endret_av)
    VALUES (NEW.id, 'underleverandor_id', OLD.underleverandor_id::text, NEW.underleverandor_id::text, auth.uid());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_oppgave_changes_trigger ON public.oppgaver;
CREATE TRIGGER log_oppgave_changes_trigger
  AFTER UPDATE ON public.oppgaver
  FOR EACH ROW
  EXECUTE FUNCTION public.log_oppgave_changes();

-- =====================================================
-- 7. COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE public.befaringer IS 'Befaringer (inspections) - Multi-tenant isolated by org_id';
COMMENT ON TABLE public.plantegninger IS 'Floor plans/drawings for befaringer';
COMMENT ON TABLE public.underleverandorer IS 'Subcontractors for an organization';
COMMENT ON TABLE public.oppgaver IS 'Tasks/issues found during befaring, placed on floor plans';
COMMENT ON TABLE public.oppgave_kommentarer IS 'Comments on tasks';
COMMENT ON TABLE public.oppgave_historikk IS 'Audit log of all task changes';
COMMENT ON TABLE public.notifikasjoner IS 'User notifications for deadlines and updates';
COMMENT ON TABLE public.oppgave_bilder IS 'Images attached to tasks (before/after/standard)';
COMMENT ON TABLE public.oppgave_epost_tokens IS 'Tokens for external access via email links';

COMMENT ON COLUMN public.befaringer.befaring_type IS 'Type: forbefaring, mellombefaring, ferdigbefaring, fellesarealer, standard';
COMMENT ON COLUMN public.befaringer.status IS 'Status: aktiv (ongoing), arkivert (archived), avsluttet (completed)';
COMMENT ON COLUMN public.befaringer.signatur_navn IS 'APEX-feature: Text-based signature name';
COMMENT ON COLUMN public.befaringer.rapport_mottakere IS 'APEX-feature: Auto-send report to these emails on completion';
COMMENT ON COLUMN public.oppgaver.prioritet IS 'Priority: kritisk, høy, medium, lav';
COMMENT ON COLUMN public.oppgave_bilder.image_type IS 'Type: før (before), etter (after), standard';

