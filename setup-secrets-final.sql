-- ========================================
-- SUPABASE SECRETS SETUP - FINAL VERSION
-- ========================================
-- Kjør dette i Supabase SQL Editor FØR du deployer!

-- 1. Encryption Key (generert med openssl)
ALTER DATABASE postgres SET app.encryption_key = 'D5e4UdNKKIE6w1jA/R2egsfuoL7/jErb7H5il1BYn3o=';

-- 2. Service Role Key (hent fra Dashboard → Settings → API → service_role → Reveal)
-- ERSTATT DENNE MED DIN EKTE SERVICE ROLE KEY:
ALTER DATABASE postgres SET app.service_role_key = 'REPLACE_WITH_YOUR_SERVICE_ROLE_KEY';

-- 3. Email Reminders Secret (generert med openssl)
ALTER DATABASE postgres SET app.email_reminders_secret = 'CbI3wETXbyBT3d6DpLydyRvqatvo/eSu';

-- 4. Nightly Sync Secret (generert med openssl)
ALTER DATABASE postgres SET app.nightly_sync_secret = 'AdFeXbHD8E3JZaJX0kWxk2jT8Q0rUwaJ';

-- ========================================
-- VERIFY SECRETS ARE SET (NEW VERSION - SECRETS TABLE)
-- ========================================
SELECT 
  key,
  CASE 
    WHEN key = 'service_role_key' THEN 'SET (hidden)'
    ELSE 'SET: ' || LEFT(value, 10) || '...'
  END as status,
  description
FROM secrets 
ORDER BY key;

-- All should show 'SET' status
