-- ========================================
-- SECRETS TABLE SETUP (Alternativ 3)
-- ========================================
-- Kjør dette i Supabase SQL Editor

-- 1. Opprett secrets tabell
CREATE TABLE IF NOT EXISTS secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS på secrets tabell
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy: Kun service role kan lese/skrive secrets
CREATE POLICY "Only service role can manage secrets"
ON secrets
FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- 4. Sett opp secrets (fungerer med Free Plan!)
INSERT INTO secrets (key, value, description) VALUES 
  ('encryption_key', 'D5e4UdNKKIE6w1jA/R2egsfuoL7/jErb7H5il1BYn3o=', 'Key for encrypting API tokens'),
  ('email_reminders_secret', 'CbI3wETXbyBT3d6DpLydyRvqatvo/eSu', 'Secret for email reminder cron jobs'),
  ('nightly_sync_secret', 'AdFeXbHD8E3JZaJX0kWxk2jT8Q0rUwaJ', 'Secret for nightly sync cron jobs')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- 5. Legg til Service Role Key (du må erstatte denne!)
-- Gå til Dashboard → Settings → API → service_role → Reveal
-- Kopier hele teksten og erstatt 'REPLACE_WITH_YOUR_SERVICE_ROLE_KEY'
INSERT INTO secrets (key, value, description) VALUES 
  ('service_role_key', 'REPLACE_WITH_YOUR_SERVICE_ROLE_KEY', 'Supabase Service Role Key for cron jobs')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- 6. Verifiser at secrets er satt
SELECT 
  key,
  CASE 
    WHEN key = 'service_role_key' THEN 'SET (hidden)'
    ELSE 'SET: ' || LEFT(value, 10) || '...'
  END as status,
  description
FROM secrets 
ORDER BY key;

-- 7. Test at vi kan hente secrets
SELECT 
  key,
  LENGTH(value) as value_length,
  created_at
FROM secrets;
