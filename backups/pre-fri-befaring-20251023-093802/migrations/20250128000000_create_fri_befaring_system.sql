-- =====================================================
-- FRI BEFARING MODULE - Complete Database Schema
-- =====================================================
-- Multi-tenant sikker med RLS policies
-- Inkluderer ChatGPT-forbedringer:
-- - Signatur-integritet med hash
-- - Snapshot-versjonering
-- - Single-use tokens
-- - Untagged befaringsrapporter
-- - Audit-logging

-- =====================================================
-- 1. KJERNE-TABELLER FOR FRI BEFARING
-- =====================================================

-- FRI BEFARINGER (Hoved-tabell)
CREATE TABLE IF NOT EXISTS public.fri_befaringer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  tripletex_project_id integer REFERENCES public.ttx_project_cache(tripletex_project_id), -- NULL = untagged befaring
  title text NOT NULL,
  description text,
  befaring_date date,
  status text DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'signert', 'arkivert')),
  version text DEFAULT '1.0',
  parent_befaring_id uuid REFERENCES public.fri_befaringer(id), -- For kopiering
  reopen_reason text, -- Grunn for gjenåpning
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- BEFARING PUNKTER
CREATE TABLE IF NOT EXISTS public.befaring_punkter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fri_befaring_id uuid NOT NULL REFERENCES public.fri_befaringer(id) ON DELETE CASCADE,
  punkt_nummer int NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'lukket')),
  fag text,
  prioritet text DEFAULT 'medium' CHECK (prioritet IN ('kritisk', 'høy', 'medium', 'lav')),
  frist date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint per befaring
  UNIQUE(fri_befaring_id, punkt_nummer)
);

-- BEFARING OPPGAVER
CREATE TABLE IF NOT EXISTS public.befaring_oppgaver (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  befaring_punkt_id uuid NOT NULL REFERENCES public.befaring_punkter(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'apen' CHECK (status IN ('apen', 'under_arbeid', 'lukket')),
  prioritet text DEFAULT 'medium' CHECK (prioritet IN ('kritisk', 'høy', 'medium', 'lav')),
  frist date,
  underleverandor_id uuid REFERENCES public.underleverandorer(id),
  ansvarlig_person_id uuid REFERENCES public.profiles(id),
  epost_sendt boolean DEFAULT false,
  epost_sendt_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- BEFARING SIGNATURER (Canvas-signatur med integritet)
CREATE TABLE IF NOT EXISTS public.befaring_signaturer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fri_befaring_id uuid NOT NULL REFERENCES public.fri_befaringer(id) ON DELETE CASCADE,
  signatur_navn text NOT NULL,
  signatur_data text NOT NULL, -- Canvas data URL
  signatur_png_url text, -- ChatGPT-forbedring: PNG-rendering
  content_hash text, -- ChatGPT-forbedring: SHA-256 hash
  signatur_dato timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- BEFARING VERSIONS (Immutable snapshots)
CREATE TABLE IF NOT EXISTS public.befaring_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fri_befaring_id uuid NOT NULL REFERENCES public.fri_befaringer(id) ON DELETE CASCADE,
  version text NOT NULL,
  payload jsonb NOT NULL, -- Immutable snapshot
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- BEFARING OPPGAVE TOKENS (Single-use tokens)
CREATE TABLE IF NOT EXISTS public.befaring_oppgave_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  befaring_oppgave_id uuid NOT NULL REFERENCES public.befaring_oppgaver(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  scope text DEFAULT 'reply' CHECK (scope IN ('view', 'reply', 'ack')),
  used_at timestamptz, -- ChatGPT-forbedring: Single-use tracking
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now()
);

-- BEFARING OPPGAVE SVAR (E-post svar)
CREATE TABLE IF NOT EXISTS public.befaring_oppgave_svar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  befaring_oppgave_id uuid NOT NULL REFERENCES public.befaring_oppgaver(id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.befaring_oppgave_tokens(id),
  svar_text text NOT NULL,
  svar_fra_epost text NOT NULL,
  svar_fra_navn text,
  vedlegg_urls text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- AUDIT EVENTS (ChatGPT-forbedring: Comprehensive logging)
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('SIGN', 'REOPEN', 'EMAIL_SENT', 'TOKEN_USED', 'BEFARING_CREATED', 'BEFARING_UPDATED')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 2. INDEXES (Performance + ChatGPT-forbedringer)
-- =====================================================

-- Fri befaringsrapporter
CREATE INDEX IF NOT EXISTS idx_fri_befaringer_org_id ON public.fri_befaringer(org_id);
CREATE INDEX IF NOT EXISTS idx_fri_befaringer_status ON public.fri_befaringer(status);
CREATE INDEX IF NOT EXISTS idx_fri_befaringer_tripletex_project ON public.fri_befaringer(tripletex_project_id);
CREATE INDEX IF NOT EXISTS idx_fri_befaringer_created_at ON public.fri_befaringer(created_at DESC, id); -- Keyset-pagination

-- Befaring punkter
CREATE INDEX IF NOT EXISTS idx_befaring_punkter_fri_befaring_id ON public.befaring_punkter(fri_befaring_id);
CREATE INDEX IF NOT EXISTS idx_befaring_punkter_status ON public.befaring_punkter(status);
CREATE INDEX IF NOT EXISTS idx_befaring_punkter_frist ON public.befaring_punkter(frist) WHERE frist IS NOT NULL;

-- Befaring oppgaver
CREATE INDEX IF NOT EXISTS idx_befaring_oppgaver_befaring_punkt_id ON public.befaring_oppgaver(befaring_punkt_id);
CREATE INDEX IF NOT EXISTS idx_befaring_oppgaver_status ON public.befaring_oppgaver(status);
CREATE INDEX IF NOT EXISTS idx_befaring_oppgaver_frist ON public.befaring_oppgaver(frist) WHERE frist IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_befaring_oppgaver_underleverandor ON public.befaring_oppgaver(underleverandor_id);
CREATE INDEX IF NOT EXISTS idx_befaring_oppgaver_ansvarlig ON public.befaring_oppgaver(ansvarlig_person_id);

-- Befaring signaturer
CREATE INDEX IF NOT EXISTS idx_befaring_signaturer_fri_befaring_id ON public.befaring_signaturer(fri_befaring_id);
CREATE INDEX IF NOT EXISTS idx_befaring_signaturer_content_hash ON public.befaring_signaturer(content_hash);

-- Befaring versions
CREATE INDEX IF NOT EXISTS idx_befaring_versions_fri_befaring_id ON public.befaring_versions(fri_befaring_id);
CREATE INDEX IF NOT EXISTS idx_befaring_versions_version ON public.befaring_versions(fri_befaring_id, version);

-- Befaring oppgave tokens
CREATE INDEX IF NOT EXISTS idx_befaring_oppgave_tokens_befaring_oppgave_id ON public.befaring_oppgave_tokens(befaring_oppgave_id);
CREATE INDEX IF NOT EXISTS idx_befaring_oppgave_tokens_token ON public.befaring_oppgave_tokens(token);
CREATE INDEX IF NOT EXISTS idx_befaring_oppgave_tokens_expires_at ON public.befaring_oppgave_tokens(expires_at);

-- Befaring oppgave svar
CREATE INDEX IF NOT EXISTS idx_befaring_oppgave_svar_befaring_oppgave_id ON public.befaring_oppgave_svar(befaring_oppgave_id);
CREATE INDEX IF NOT EXISTS idx_befaring_oppgave_svar_token_id ON public.befaring_oppgave_svar(token_id);

-- Audit events
CREATE INDEX IF NOT EXISTS idx_audit_events_org_id ON public.audit_events(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON public.audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity_type ON public.audit_events(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC, id); -- Keyset-pagination

-- =====================================================
-- 3. RLS POLICIES (Multi-tenant sikkerhet)
-- =====================================================

-- Enable RLS
ALTER TABLE public.fri_befaringer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.befaring_punkter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.befaring_oppgaver ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.befaring_signaturer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.befaring_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.befaring_oppgave_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.befaring_oppgave_svar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- FRI BEFARINGER: Users see own org befaringsrapporter
DROP POLICY IF EXISTS "Users see own org fri befaringsrapporter" ON public.fri_befaringer;
CREATE POLICY "Users see own org fri befaringsrapporter"
  ON public.fri_befaringer FOR SELECT
  USING (org_id = public.get_user_org_id());

DROP POLICY IF EXISTS "Admins manage own org fri befaringsrapporter" ON public.fri_befaringer;
CREATE POLICY "Admins manage own org fri befaringsrapporter"
  ON public.fri_befaringer FOR ALL
  USING (
    org_id = public.get_user_org_id()
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- BEFARING PUNKTER: Users see punkter in own org befaringsrapporter
DROP POLICY IF EXISTS "Users see punkter in own org" ON public.befaring_punkter;
CREATE POLICY "Users see punkter in own org"
  ON public.befaring_punkter FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fri_befaringer fb
      WHERE fb.id = befaring_punkter.fri_befaring_id
      AND fb.org_id = public.get_user_org_id()
    )
  );

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

-- BEFARING OPPGAVER: Users see oppgaver in own org befaringsrapporter
DROP POLICY IF EXISTS "Users see oppgaver in own org" ON public.befaring_oppgaver;
CREATE POLICY "Users see oppgaver in own org"
  ON public.befaring_oppgaver FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.befaring_punkter bp
      JOIN public.fri_befaringer fb ON fb.id = bp.fri_befaring_id
      WHERE bp.id = befaring_oppgaver.befaring_punkt_id
      AND fb.org_id = public.get_user_org_id()
    )
  );

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

-- BEFARING SIGNATURER: Same as fri befaringsrapporter
DROP POLICY IF EXISTS "Users see signaturer in own org" ON public.befaring_signaturer;
CREATE POLICY "Users see signaturer in own org"
  ON public.befaring_signaturer FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fri_befaringer fb
      WHERE fb.id = befaring_signaturer.fri_befaring_id
      AND fb.org_id = public.get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Admins manage signaturer in own org" ON public.befaring_signaturer;
CREATE POLICY "Admins manage signaturer in own org"
  ON public.befaring_signaturer FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.fri_befaringer fb
      WHERE fb.id = befaring_signaturer.fri_befaring_id
      AND fb.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- BEFARING VERSIONS: Read-only for all in org
DROP POLICY IF EXISTS "Users see versions in own org" ON public.befaring_versions;
CREATE POLICY "Users see versions in own org"
  ON public.befaring_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fri_befaringer fb
      WHERE fb.id = befaring_versions.fri_befaring_id
      AND fb.org_id = public.get_user_org_id()
    )
  );

-- System can insert versions
DROP POLICY IF EXISTS "System can insert versions" ON public.befaring_versions;
CREATE POLICY "System can insert versions"
  ON public.befaring_versions FOR INSERT
  WITH CHECK (true);

-- BEFARING OPPGAVE TOKENS: Public read with valid token
DROP POLICY IF EXISTS "Public can read with valid token" ON public.befaring_oppgave_tokens;
CREATE POLICY "Public can read with valid token"
  ON public.befaring_oppgave_tokens FOR SELECT
  USING (expires_at > now() AND used_at IS NULL);

-- System can manage tokens
DROP POLICY IF EXISTS "System can manage tokens" ON public.befaring_oppgave_tokens;
CREATE POLICY "System can manage tokens"
  ON public.befaring_oppgave_tokens FOR ALL
  USING (true);

-- BEFARING OPPGAVE SVAR: Same as oppgaver
DROP POLICY IF EXISTS "Users see svar in own org" ON public.befaring_oppgave_svar;
CREATE POLICY "Users see svar in own org"
  ON public.befaring_oppgave_svar FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.befaring_oppgaver bo
      JOIN public.befaring_punkter bp ON bp.id = bo.befaring_punkt_id
      JOIN public.fri_befaringer fb ON fb.id = bp.fri_befaring_id
      WHERE bo.id = befaring_oppgave_svar.befaring_oppgave_id
      AND fb.org_id = public.get_user_org_id()
    )
  );

-- System can insert svar
DROP POLICY IF EXISTS "System can insert svar" ON public.befaring_oppgave_svar;
CREATE POLICY "System can insert svar"
  ON public.befaring_oppgave_svar FOR INSERT
  WITH CHECK (true);

-- AUDIT EVENTS: Read-only for admins in org
DROP POLICY IF EXISTS "Admins see audit events in own org" ON public.audit_events;
CREATE POLICY "Admins see audit events in own org"
  ON public.audit_events FOR SELECT
  USING (
    org_id = public.get_user_org_id()
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- System can insert audit events
DROP POLICY IF EXISTS "System can insert audit events" ON public.audit_events;
CREATE POLICY "System can insert audit events"
  ON public.audit_events FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 4. TRIGGERS (Auto-update timestamps + audit)
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
DROP TRIGGER IF EXISTS update_fri_befaringer_updated_at ON public.fri_befaringer;
CREATE TRIGGER update_fri_befaringer_updated_at
  BEFORE UPDATE ON public.fri_befaringer
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_befaring_punkter_updated_at ON public.befaring_punkter;
CREATE TRIGGER update_befaring_punkter_updated_at
  BEFORE UPDATE ON public.befaring_punkter
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_befaring_oppgaver_updated_at ON public.befaring_oppgaver;
CREATE TRIGGER update_befaring_oppgaver_updated_at
  BEFORE UPDATE ON public.befaring_oppgaver
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.log_fri_befaring_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_events (org_id, event_type, entity_type, entity_id, user_id, details)
    VALUES (
      NEW.org_id,
      'BEFARING_UPDATED',
      'fri_befaringer',
      NEW.id,
      auth.uid(),
      jsonb_build_object(
        'field', 'status',
        'old_value', OLD.status,
        'new_value', NEW.status
      )
    );
  END IF;

  -- Log reopen reason
  IF OLD.reopen_reason IS DISTINCT FROM NEW.reopen_reason THEN
    INSERT INTO public.audit_events (org_id, event_type, entity_type, entity_id, user_id, details)
    VALUES (
      NEW.org_id,
      'REOPEN',
      'fri_befaringer',
      NEW.id,
      auth.uid(),
      jsonb_build_object(
        'field', 'reopen_reason',
        'old_value', OLD.reopen_reason,
        'new_value', NEW.reopen_reason
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_fri_befaring_changes_trigger ON public.fri_befaringer;
CREATE TRIGGER log_fri_befaring_changes_trigger
  AFTER UPDATE ON public.fri_befaringer
  FOR EACH ROW
  EXECUTE FUNCTION public.log_fri_befaring_changes();

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to create snapshot when signing
CREATE OR REPLACE FUNCTION public.create_befaring_snapshot(fri_befaring_id uuid)
RETURNS uuid AS $$
DECLARE
  snapshot_id uuid;
  snapshot_data jsonb;
BEGIN
  -- Create comprehensive snapshot
  SELECT jsonb_build_object(
    'befaring', row_to_json(fb.*),
    'punkter', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'punkt', row_to_json(bp.*),
          'oppgaver', (
            SELECT jsonb_agg(row_to_json(bo.*))
            FROM public.befaring_oppgaver bo
            WHERE bo.befaring_punkt_id = bp.id
          )
        )
      )
      FROM public.befaring_punkter bp
      WHERE bp.fri_befaring_id = fri_befaring_id
    ),
    'signaturer', (
      SELECT jsonb_agg(row_to_json(bs.*))
      FROM public.befaring_signaturer bs
      WHERE bs.fri_befaring_id = fri_befaring_id
    )
  )
  INTO snapshot_data
  FROM public.fri_befaringer fb
  WHERE fb.id = fri_befaring_id;

  -- Insert snapshot
  INSERT INTO public.befaring_versions (fri_befaring_id, version, payload, created_by)
  VALUES (
    fri_befaring_id,
    (SELECT version FROM public.fri_befaringer WHERE id = fri_befaring_id),
    snapshot_data,
    auth.uid()
  )
  RETURNING id INTO snapshot_id;

  RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate single-use tokens
CREATE OR REPLACE FUNCTION public.validate_and_use_token(token_text text)
RETURNS uuid AS $$
DECLARE
  token_record record;
BEGIN
  -- Find valid token
  SELECT * INTO token_record
  FROM public.befaring_oppgave_tokens
  WHERE token = token_text
    AND expires_at > now()
    AND used_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  -- Mark as used
  UPDATE public.befaring_oppgave_tokens
  SET used_at = now()
  WHERE id = token_record.id;

  -- Log usage
  INSERT INTO public.audit_events (org_id, event_type, entity_type, entity_id, details)
  VALUES (
    (SELECT fb.org_id FROM public.befaring_oppgaver bo
     JOIN public.befaring_punkter bp ON bp.id = bo.befaring_punkt_id
     JOIN public.fri_befaringer fb ON fb.id = bp.fri_befaring_id
     WHERE bo.id = token_record.befaring_oppgave_id),
    'TOKEN_USED',
    'befaring_oppgave_tokens',
    token_record.id,
    jsonb_build_object('token', token_text)
  );

  RETURN token_record.befaring_oppgave_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE public.fri_befaringer IS 'Fri befaringsrapporter (without floor plans) - Multi-tenant isolated by org_id';
COMMENT ON TABLE public.befaring_punkter IS 'Points/items in fri befaringsrapporter';
COMMENT ON TABLE public.befaring_oppgaver IS 'Tasks/issues for each point in fri befaringsrapporter';
COMMENT ON TABLE public.befaring_signaturer IS 'Canvas-based signatures with integrity hash';
COMMENT ON TABLE public.befaring_versions IS 'Immutable snapshots of befaringsrapporter for versioning';
COMMENT ON TABLE public.befaring_oppgave_tokens IS 'Single-use tokens for external access via email';
COMMENT ON TABLE public.befaring_oppgave_svar IS 'Email replies from external users';
COMMENT ON TABLE public.audit_events IS 'Comprehensive audit log for all critical events';

COMMENT ON COLUMN public.fri_befaringer.tripletex_project_id IS 'Project ID from Tripletex - NULL for untagged befaringsrapporter';
COMMENT ON COLUMN public.fri_befaringer.status IS 'Status: aktiv (ongoing), signert (signed), arkivert (archived)';
COMMENT ON COLUMN public.fri_befaringer.reopen_reason IS 'Reason for reopening signed befaringsrapporter (admin only)';
COMMENT ON COLUMN public.befaring_signaturer.content_hash IS 'SHA-256 hash for signature integrity verification';
COMMENT ON COLUMN public.befaring_oppgave_tokens.used_at IS 'Timestamp when token was used (single-use enforcement)';
COMMENT ON COLUMN public.befaring_oppgave_tokens.scope IS 'Token scope: view, reply, ack';
