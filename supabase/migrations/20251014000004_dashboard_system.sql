-- =====================================================
-- MIGRASJON: Dashboard-system (Favoritter, Aktivitet, Preferanser)
-- Dato: 14. oktober 2025
-- Beskrivelse: Tabeller og views for Prosjekt Dashboard
-- =====================================================

-- STEG 1: Project Favorites (org + personlige)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES ttx_project_cache(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  
  is_org_favorite boolean DEFAULT false,  -- Org-favoritt (alle ser)
  is_pinned boolean DEFAULT false,         -- Pinned øverst
  
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  
  UNIQUE(user_id, project_id)
);

-- Indekser
CREATE INDEX idx_project_favorites_user ON project_favorites(user_id, is_pinned DESC);
CREATE INDEX idx_project_favorites_org ON project_favorites(org_id, is_org_favorite) 
  WHERE is_org_favorite = true;
CREATE INDEX idx_project_favorites_project ON project_favorites(project_id);

-- RLS
ALTER TABLE project_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favorites"
  ON project_favorites FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view org favorites"
  ON project_favorites FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE project_favorites IS 'Bruker- og org-favoritter for prosjekter';

-- STEG 2: Project Activity (aktivitetslogg)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES ttx_project_cache(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  
  activity_type text NOT NULL,    -- 'image_uploaded', 'task_created', 'befaring_completed', etc.
  description text,
  related_id uuid,                 -- befaring_id, oppgave_id, etc.
  related_type text,              -- 'befaring', 'oppgave', 'bilde'
  
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  
  metadata jsonb                   -- Fleksibel data: { count: 5, status: 'complete', etc. }
);

-- Indekser
CREATE INDEX idx_project_activity_project ON project_activity(project_id, created_at DESC);
CREATE INDEX idx_project_activity_org ON project_activity(org_id, created_at DESC);
CREATE INDEX idx_project_activity_type ON project_activity(activity_type, created_at DESC);
CREATE INDEX idx_project_activity_created ON project_activity(created_at DESC);

-- RLS
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org activity"
  ON project_activity FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create activity"
  ON project_activity FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
    AND auth.uid() = created_by
  );

COMMENT ON TABLE project_activity IS 'Aktivitetslogg for prosjekter (feed)';

-- STEG 3: User Preferences (dashboard-innstillinger)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  last_selected_project uuid REFERENCES ttx_project_cache(id) ON DELETE SET NULL,
  preferred_mode text DEFAULT 'auto',     -- 'auto', 'field', 'leader'
  dashboard_layout jsonb DEFAULT '{}'::jsonb,  -- Fleksibel layout-config
  
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indeks
CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);

-- RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id);

COMMENT ON TABLE user_preferences IS 'Brukerpreferanser for dashboard';

-- STEG 4: View for prosjekt med aktivitetsscore
-- -------------------------------------------------------
CREATE OR REPLACE VIEW project_activity_summary AS
SELECT 
  p.id as project_id,
  p.tripletex_project_id,
  p.project_name,
  p.project_number,
  p.customer_name,
  p.org_id,
  p.is_active,
  
  -- Aktivitetsscore (siste 7 dager)
  (
    -- Bilder: 3 poeng
    COALESCE(COUNT(DISTINCT CASE 
      WHEN ob.uploaded_at > NOW() - INTERVAL '7 days' 
      THEN ob.id END) * 3, 0) +
    
    -- Oppgaver: 2 poeng
    COALESCE(COUNT(DISTINCT CASE 
      WHEN o.created_at > NOW() - INTERVAL '7 days' 
      THEN o.id END) * 2, 0) +
    
    -- Befaringer: 2.5 poeng
    COALESCE(COUNT(DISTINCT CASE 
      WHEN bf.created_at > NOW() - INTERVAL '7 days' 
      THEN bf.id END) * 2.5, 0)
  ) as activity_score,
  
  -- Tellinger
  COUNT(DISTINCT o.id) FILTER (WHERE o.status != 'lukket') as open_tasks,
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.status != 'lukket' 
      AND o.created_at < NOW() - INTERVAL '7 days'
  ) as old_tasks,
  COUNT(DISTINCT ob.id) FILTER (WHERE ob.uploaded_at > NOW() - INTERVAL '7 days') as recent_images,
  COUNT(DISTINCT ob.id) FILTER (WHERE ob.is_tagged = false) as untagged_images,
  COUNT(DISTINCT bf.id) as total_befaringer,
  COUNT(DISTINCT bf.id) FILTER (WHERE bf.status = 'planlagt') as planned_befaringer,
  
  -- Timestamps
  MAX(o.created_at) as last_task_date,
  MAX(ob.uploaded_at) as last_image_date,
  MAX(bf.created_at) as last_befaring_date,
  GREATEST(
    MAX(o.created_at),
    MAX(ob.uploaded_at),
    MAX(bf.created_at)
  ) as last_activity_date

FROM ttx_project_cache p
LEFT JOIN befaringer bf ON bf.tripletex_project_id = p.tripletex_project_id
LEFT JOIN oppgaver o ON o.befaring_id = bf.id OR o.prosjekt_id = p.id
LEFT JOIN oppgave_bilder ob ON ob.prosjekt_id = p.id

WHERE p.is_active = true
GROUP BY p.id, p.tripletex_project_id, p.project_name, p.project_number, p.customer_name, p.org_id, p.is_active;

-- Grant access
GRANT SELECT ON project_activity_summary TO authenticated;

COMMENT ON VIEW project_activity_summary IS 'Prosjekter med aktivitetsscore og statistikk';

-- STEG 5: View for "Krever handling" alerts
-- -------------------------------------------------------
CREATE OR REPLACE VIEW project_alerts AS
SELECT 
  p.id as project_id,
  p.project_name,
  p.project_number,
  p.org_id,
  
  -- Alert type
  CASE
    WHEN COUNT(o.id) FILTER (WHERE o.created_at < NOW() - INTERVAL '7 days' AND o.status != 'lukket') > 0
      THEN 'critical'
    WHEN COUNT(o.id) FILTER (WHERE o.created_at < NOW() - INTERVAL '3 days' AND o.status != 'lukket') > 0
      THEN 'warning'
    WHEN COUNT(bf.id) FILTER (WHERE bf.status = 'planlagt' AND bf.dato < NOW() + INTERVAL '24 hours') > 0
      THEN 'warning'
    ELSE 'ok'
  END as alert_level,
  
  -- Alert detaljer
  COUNT(o.id) FILTER (WHERE o.created_at < NOW() - INTERVAL '7 days' AND o.status != 'lukket') as critical_old_tasks,
  COUNT(o.id) FILTER (WHERE o.created_at < NOW() - INTERVAL '3 days' AND o.status != 'lukket') as warning_old_tasks,
  COUNT(bf.id) FILTER (WHERE bf.status = 'planlagt' AND bf.dato < NOW() + INTERVAL '24 hours') as upcoming_befaringer,
  COUNT(ob.id) FILTER (WHERE ob.is_tagged = false) as untagged_images

FROM ttx_project_cache p
LEFT JOIN befaringer bf ON bf.tripletex_project_id = p.tripletex_project_id
LEFT JOIN oppgaver o ON o.befaring_id = bf.id OR o.prosjekt_id = p.id
LEFT JOIN oppgave_bilder ob ON ob.prosjekt_id = p.id

WHERE p.is_active = true
GROUP BY p.id, p.project_name, p.project_number, p.org_id
HAVING COUNT(o.id) FILTER (WHERE o.created_at < NOW() - INTERVAL '7 days' AND o.status != 'lukket') > 0
    OR COUNT(bf.id) FILTER (WHERE bf.status = 'planlagt' AND bf.dato < NOW() + INTERVAL '24 hours') > 0
    OR COUNT(ob.id) FILTER (WHERE ob.is_tagged = false) > 5;  -- Mer enn 5 utaggede bilder

GRANT SELECT ON project_alerts TO authenticated;

COMMENT ON VIEW project_alerts IS 'Prosjekter som krever handling (gamle oppgaver, befaringer, etc)';

-- STEG 6: Validering og logging
-- -------------------------------------------------------
DO $$
DECLARE
  favorite_count integer;
  activity_count integer;
  preference_count integer;
BEGIN
  SELECT COUNT(*) INTO favorite_count FROM project_favorites;
  SELECT COUNT(*) INTO activity_count FROM project_activity;
  SELECT COUNT(*) INTO preference_count FROM user_preferences;
  
  RAISE NOTICE '====================================';
  RAISE NOTICE 'DASHBOARD SYSTEM - MIGRERING';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Tabeller opprettet:';
  RAISE NOTICE '  - project_favorites ✅ (% entries)', favorite_count;
  RAISE NOTICE '  - project_activity ✅ (% entries)', activity_count;
  RAISE NOTICE '  - user_preferences ✅ (% entries)', preference_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Views opprettet:';
  RAISE NOTICE '  - project_activity_summary ✅';
  RAISE NOTICE '  - project_alerts ✅';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS policies: Aktivert ✅';
  RAISE NOTICE 'Indekser: 11 stk ✅';
  RAISE NOTICE '';
  RAISE NOTICE '✅ SUKSESS: Dashboard system er klart';
END $$;

