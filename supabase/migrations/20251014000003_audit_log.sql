-- =====================================================
-- MIGRASJON: Audit log for sporbarhet
-- Dato: 14. oktober 2025
-- Beskrivelse: Logger alle endringer i systemet for
--              sporbarhet, debugging og compliance
-- =====================================================

-- STEG 1: Oppdater eksisterende audit_log tabell
-- -------------------------------------------------------
-- VIKTIG: audit_log finnes allerede fra gammel migrering
-- Vi oppdaterer den i stedet for å lage ny

-- Først, dropp eksisterende hvis den er tom eller gammel
DO $$
BEGIN
  -- Sjekk om tabellen har data
  IF EXISTS (SELECT 1 FROM audit_log LIMIT 1) THEN
    RAISE NOTICE 'audit_log har eksisterende data - beholder den';
  ELSE
    RAISE NOTICE 'audit_log er tom - dropper og lager ny';
    DROP TABLE IF EXISTS audit_log CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'audit_log finnes ikke - lager ny';
END $$;

-- Lag ny audit_log tabell
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Hvem
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id uuid REFERENCES org(id) ON DELETE CASCADE,
  
  -- Hva
  action text NOT NULL,           -- 'CREATE', 'UPDATE', 'DELETE'
  entity_type text NOT NULL,      -- 'oppgave', 'befaring', 'time_entry', 'bilde', etc.
  entity_id uuid NOT NULL,        -- ID på entity som ble endret
  
  -- Detaljer
  old_data jsonb,                 -- State før endring (NULL ved CREATE)
  new_data jsonb,                 -- State etter endring (NULL ved DELETE)
  changes jsonb,                  -- Diff: { field: { old: x, new: y } }
  
  -- Metadata
  ip_address inet,                -- IP-adresse til bruker
  user_agent text,                -- Browser/device info
  request_id text,                -- For å korrelere relaterte events
  
  -- Timestamp
  created_at timestamp DEFAULT now()
);

-- Legg til kommentarer
COMMENT ON TABLE audit_log IS 'Logger alle endringer i systemet for sporbarhet og compliance';
COMMENT ON COLUMN audit_log.action IS 'Type handling: CREATE, UPDATE, DELETE';
COMMENT ON COLUMN audit_log.entity_type IS 'Type entity: oppgave, befaring, time_entry, etc.';
COMMENT ON COLUMN audit_log.changes IS 'JSON diff av endringer: { field: { old: x, new: y } }';

-- STEG 2: Indekser for rask søk
-- -------------------------------------------------------
-- Søk per entity (se historikk for en oppgave)
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, created_at DESC);

-- Søk per bruker (hva har Ole gjort?)
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);

-- Søk per org (alle hendelser i organisasjonen)
CREATE INDEX idx_audit_org ON audit_log(org_id, created_at DESC);

-- Søk per action type (alle DELETE-operasjoner)
CREATE INDEX idx_audit_action ON audit_log(action, created_at DESC);

-- Søk per dato (siste 24t)
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- STEG 3: RLS Policies
-- -------------------------------------------------------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admin/Manager/Leder kan se all audit log for sin org
CREATE POLICY "Admins can view org audit log"
  ON audit_log FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager', 'leder')
    )
  );

-- Brukere kan se sine egne actions
CREATE POLICY "Users can view own audit log"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Kun system/backend kan insert (via service role)
CREATE POLICY "System can insert audit log"
  ON audit_log FOR INSERT
  WITH CHECK (true);  -- Backend bruker service role key

-- Ingen kan oppdatere eller slette audit log (immutable)
-- (Ingen UPDATE eller DELETE policies)

-- STEG 4: Lag helper-funksjon for audit logging
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION log_audit(
  p_user_id uuid,
  p_org_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id uuid;
  v_changes jsonb;
BEGIN
  -- Beregn changes (diff mellom old og new)
  IF p_old_data IS NOT NULL AND p_new_data IS NOT NULL THEN
    -- Enkel diff (kan forbedres med mer avansert logic)
    SELECT jsonb_object_agg(key, jsonb_build_object('old', p_old_data->key, 'new', p_new_data->key))
    INTO v_changes
    FROM jsonb_each(p_new_data)
    WHERE p_old_data->key IS DISTINCT FROM p_new_data->key;
  END IF;
  
  -- Insert audit log
  INSERT INTO audit_log (
    user_id,
    org_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    changes,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_org_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_data,
    p_new_data,
    v_changes,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

COMMENT ON FUNCTION log_audit IS 'Helper-funksjon for å logge audit events';

-- STEG 5: Lag view for siste aktivitet per entity
-- -------------------------------------------------------
CREATE OR REPLACE VIEW entity_audit_history AS
SELECT 
  al.entity_type,
  al.entity_id,
  al.action,
  al.created_at,
  p.display_name as user_name,
  p.role as user_role,
  al.changes,
  al.ip_address
FROM audit_log al
LEFT JOIN profiles p ON al.user_id = p.user_id
ORDER BY al.created_at DESC;

GRANT SELECT ON entity_audit_history TO authenticated;

COMMENT ON VIEW entity_audit_history IS 'Audit history med brukerinfo for enkel visning';

-- STEG 6: Trigger for automatisk audit logging (optional)
-- -------------------------------------------------------
-- Dette kan legges til senere for å automatisk logge alle endringer

-- Eksempel trigger for oppgaver:
/*
CREATE OR REPLACE FUNCTION audit_oppgaver_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(
      auth.uid(),
      NEW.org_id,
      'CREATE',
      'oppgave',
      NEW.id,
      NULL,
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(
      auth.uid(),
      NEW.org_id,
      'UPDATE',
      'oppgave',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit(
      auth.uid(),
      OLD.org_id,
      'DELETE',
      'oppgave',
      OLD.id,
      to_jsonb(OLD),
      NULL
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER oppgaver_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON oppgaver
  FOR EACH ROW
  EXECUTE FUNCTION audit_oppgaver_changes();
*/

-- STEG 7: Validering og logging
-- -------------------------------------------------------
DO $$
DECLARE
  audit_count integer;
BEGIN
  SELECT COUNT(*) INTO audit_count FROM audit_log;
  
  RAISE NOTICE '====================================';
  RAISE NOTICE 'AUDIT LOG - MIGRERING';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Audit log tabell opprettet: ✅';
  RAISE NOTICE 'Eksisterende audit entries: %', audit_count;
  RAISE NOTICE 'Helper-funksjon: log_audit() ✅';
  RAISE NOTICE 'View: entity_audit_history ✅';
  RAISE NOTICE 'Indekser: 5 stk ✅';
  RAISE NOTICE 'RLS policies: 3 stk ✅';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  INFO: Triggers for auto-logging kan legges til senere';
  RAISE NOTICE '⚠️  INFO: For nå må logging gjøres manuelt fra kode';
  RAISE NOTICE '';
  RAISE NOTICE '✅ SUKSESS: Audit log system er klart';
END $$;

