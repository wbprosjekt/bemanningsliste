# Secrets Setup Guide

This guide walks you through setting up all required secrets for the Bemanningsliste application.

## Overview

The application requires three types of secrets:

1. **Encryption Key** - For encrypting API tokens in database
2. **Trigger Secrets** - For authenticating cron jobs
3. **Service Role Key** - For cron jobs to call Edge Functions

## Prerequisites

- Access to Supabase SQL Editor
- Admin access to your Supabase project
- Password manager (recommended: 1Password, LastPass, or similar)

---

## Step 1: Generate Secure Random Keys

### Generate Encryption Key (32 bytes)

Use one of these methods:

**Option A: Using OpenSSL (Linux/Mac)**
```bash
openssl rand -base64 32
```

**Option B: Using Node.js**
```javascript
require('crypto').randomBytes(32).toString('base64')
```

**Option C: Using Python**
```python
import base64, os
base64.b64encode(os.urandom(32)).decode()
```

**Option D: Using Online Generator**
- Visit: https://generate-random.org/api-key-generator
- Length: 32 characters
- Format: Base64

Example output: `Xy9fK2mN8pQr5tVw3xZaB7cD1eF4gH6i`

⚠️ **Save this key immediately in your password manager!**

### Generate Trigger Secrets (16-24 bytes each)

Generate two separate secrets:

```bash
# Email reminders secret
openssl rand -base64 24

# Nightly sync secret
openssl rand -base64 24
```

Example outputs:
- Email: `A1b2C3d4E5f6G7h8I9j0K1l2M3n4`
- Nightly: `N5o6P7q8R9s0T1u2V3w4X5y6Z7a8`

---

## Step 2: Get Your Service Role Key

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Under **Project API keys**, copy the **service_role** key
4. It looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

⚠️ **Never commit this key to version control!**

---

## Step 3: Set Secrets in Database

### Connect to Supabase SQL Editor

1. Open your Supabase project
2. Go to **SQL Editor**
3. Click **New Query**

### Run the Following SQL

```sql
-- ======================================
-- SECRETS CONFIGURATION
-- ======================================
-- Replace the values with your actual secrets generated above
-- These settings are stored in PostgreSQL configuration and persist across restarts

-- 1. Encryption key for API tokens (32+ bytes, base64)
ALTER DATABASE postgres SET app.encryption_key = 'YOUR_ENCRYPTION_KEY_HERE';

-- 2. Email reminders trigger secret (16-24 bytes)
ALTER DATABASE postgres SET app.email_reminders_secret = 'YOUR_EMAIL_SECRET_HERE';

-- 3. Nightly sync trigger secret (16-24 bytes)
ALTER DATABASE postgres SET app.nightly_sync_secret = 'YOUR_NIGHTLY_SYNC_SECRET_HERE';

-- 4. Service role key for cron jobs (from Supabase dashboard)
ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE';

-- ======================================
-- VERIFICATION
-- ======================================
-- Verify that all secrets are set correctly
SELECT 
  current_setting('app.encryption_key', true) IS NOT NULL as has_encryption_key,
  current_setting('app.email_reminders_secret', true) IS NOT NULL as has_email_secret,
  current_setting('app.nightly_sync_secret', true) IS NOT NULL as has_nightly_secret,
  current_setting('app.service_role_key', true) IS NOT NULL as has_service_key;

-- All columns should return 'true' (t)
-- If any return 'false' (f), that secret was not set correctly
```

### Expected Output

```
| has_encryption_key | has_email_secret | has_nightly_secret | has_service_key |
|--------------------|------------------|---------------------|-----------------|
| t                  | t                | t                   | t               |
```

---

## Step 4: Encrypt Existing Tokens

If you already have Tripletex API keys stored in plaintext, encrypt them:

```sql
-- ======================================
-- ENCRYPT EXISTING TOKENS
-- ======================================
-- This migrates existing plaintext tokens to encrypted format

-- 1. Encrypt consumer_token
UPDATE integration_settings
SET settings = jsonb_set(
  settings,
  '{consumer_token_encrypted}',
  to_jsonb(encrypt_token(settings->>'consumer_token'))
)
WHERE settings->>'consumer_token' IS NOT NULL
  AND settings->>'consumer_token' != ''
  AND (settings->>'consumer_token_encrypted' IS NULL OR settings->>'consumer_token_encrypted' = '');

-- 2. Encrypt employee_token
UPDATE integration_settings
SET settings = jsonb_set(
  settings,
  '{employee_token_encrypted}',
  to_jsonb(encrypt_token(settings->>'employee_token'))
)
WHERE settings->>'employee_token' IS NOT NULL
  AND settings->>'employee_token' != ''
  AND (settings->>'employee_token_encrypted' IS NULL OR settings->>'employee_token_encrypted' = '');

-- 3. Encrypt session_token (if any)
UPDATE integration_settings
SET settings = jsonb_set(
  settings,
  '{session_token_encrypted}',
  to_jsonb(encrypt_token(settings->>'session_token'))
)
WHERE settings->>'session_token' IS NOT NULL
  AND settings->>'session_token' != ''
  AND (settings->>'session_token_encrypted' IS NULL OR settings->>'session_token_encrypted' = '');

-- ======================================
-- VERIFY ENCRYPTION
-- ======================================
-- Check that tokens are encrypted
SELECT 
  org_id,
  settings->>'consumer_token' IS NULL as consumer_removed,
  settings->>'consumer_token_encrypted' IS NOT NULL as consumer_encrypted,
  settings->>'employee_token' IS NULL as employee_removed,
  settings->>'employee_token_encrypted' IS NOT NULL as employee_encrypted
FROM integration_settings
WHERE integration_type = 'tripletex';

-- After verifying encrypted tokens work, remove plaintext tokens:
-- UPDATE integration_settings
-- SET settings = settings - 'consumer_token' - 'employee_token' - 'session_token'
-- WHERE integration_type = 'tripletex';
```

---

## Step 5: Configure Cron Jobs

### Update Cron Configuration

Run the updated cron setup script:

```bash
# From project root
psql $DATABASE_URL -f update_cron_with_http.sql
```

Or manually in SQL Editor:

```sql
-- Copy contents of update_cron_with_http.sql and run
```

### Verify Cron Jobs

```sql
-- List all configured cron jobs
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobname;

-- Expected output:
-- weekly-reminder-job (0 * * * *)
-- payroll-reminder-job (0 9 * * *)
-- nightly-sync-job (0 2 * * *)
```

---

## Step 6: Test the Setup

### Test Encryption

```sql
-- Test encrypt/decrypt roundtrip
SELECT decrypt_token(encrypt_token('test-secret-123')) = 'test-secret-123' as encryption_works;

-- Should return: encryption_works = true
```

### Test Edge Function Access

Use Supabase Functions in the dashboard or curl:

```bash
# Test nightly-sync with trigger secret
curl -X POST 'https://your-project.supabase.co/functions/v1/nightly-sync' \
  -H "Content-Type: application/json" \
  -H "X-Trigger-Secret: YOUR_NIGHTLY_SYNC_SECRET_HERE" \
  -d '{"triggered_by":"manual_test"}'

# Should return: Status 200 with sync results
```

### Test Cron Job Execution

```sql
-- Manually trigger a cron job to test
SELECT cron.schedule(
  'test-cron-once',
  '* * * * *', -- Run every minute
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/nightly-sync',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Trigger-Secret', current_setting('app.nightly_sync_secret')
    ),
    body:=jsonb_build_object('triggered_by', 'test')
  );
  $$
);

-- Wait 1-2 minutes, then check logs
-- Then remove test job:
SELECT cron.unschedule('test-cron-once');
```

---

## Step 7: Secure Your Secrets

### Store in Password Manager

Create a secure note in your password manager with:

```
Title: Bemanningsliste Secrets - Production

Encryption Key: Xy9fK2mN8pQr5tVw3xZaB7cD1eF4gH6i
Email Secret: A1b2C3d4E5f6G7h8I9j0K1l2M3n4
Nightly Secret: N5o6P7q8R9s0T1u2V3w4X5y6Z7a8
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Created: 2025-10-10
Rotation Schedule: Every 6 months
Next Rotation: 2026-04-10
```

### Document Rotation Schedule

| Secret | Rotation Frequency | Last Rotated | Next Rotation |
|--------|-------------------|--------------|---------------|
| Encryption Key | 6 months | 2025-10-10 | 2026-04-10 |
| Email Secret | 3 months | 2025-10-10 | 2026-01-10 |
| Nightly Secret | 3 months | 2025-10-10 | 2026-01-10 |
| Service Role | Only if compromised | N/A | N/A |

---

## Troubleshooting

### Error: "Encryption key not configured"

**Problem:** The `app.encryption_key` setting is not set or accessible.

**Solution:**
```sql
-- Re-run the ALTER DATABASE command
ALTER DATABASE postgres SET app.encryption_key = 'YOUR_KEY_HERE';

-- Verify it's set
SELECT current_setting('app.encryption_key', true);
```

### Error: "Invalid trigger secret"

**Problem:** The cron job secret doesn't match the configured secret.

**Solution:**
```sql
-- Check if secret is set
SELECT current_setting('app.nightly_sync_secret', true);

-- If NULL, set it:
ALTER DATABASE postgres SET app.nightly_sync_secret = 'YOUR_SECRET_HERE';

-- Update cron job to use new secret
-- Re-run update_cron_with_http.sql
```

### Cron Jobs Not Running

**Problem:** Cron jobs are scheduled but not executing.

**Solution:**
```sql
-- Check if jobs are active
SELECT jobid, jobname, active, schedule
FROM cron.job;

-- Check for errors in job runs
SELECT jobid, status, return_message, start_time
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 10;

-- Verify pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

### Tokens Not Decrypting

**Problem:** Encrypted tokens cannot be decrypted.

**Cause:** Wrong encryption key or corrupted data.

**Solution:**
```sql
-- Test decryption with known value
SELECT decrypt_token(encrypt_token('test')) = 'test' as works;

-- If false, encryption key might be wrong
-- Check if key matches the one used to encrypt

-- If true but tokens still fail, tokens might be corrupted
-- Re-encrypt tokens using current key
```

---

## Key Rotation Procedure

When it's time to rotate secrets:

### Rotating Trigger Secrets

1. Generate new secrets
2. Update database configuration
3. Update cron jobs
4. Test endpoints
5. Monitor for 24h
6. Update password manager

```sql
-- 1. Set new secrets
ALTER DATABASE postgres SET app.email_reminders_secret = 'NEW_SECRET_HERE';
ALTER DATABASE postgres SET app.nightly_sync_secret = 'NEW_SECRET_HERE';

-- 2. Re-run cron setup (updates jobs with new secrets)
-- Copy and run: update_cron_with_http.sql

-- 3. Test manually
-- (use curl commands from Step 6)
```

### Rotating Encryption Key

⚠️ **More complex - requires re-encrypting all data**

1. Generate new encryption key
2. Decrypt all tokens with old key
3. Set new encryption key
4. Re-encrypt all tokens with new key
5. Verify all tokens decrypt correctly
6. Update backups with new key

```sql
-- 1. Decrypt to temporary columns (using OLD key)
UPDATE integration_settings
SET settings = jsonb_set(
  settings,
  '{consumer_token_temp}',
  to_jsonb(decrypt_token(settings->>'consumer_token_encrypted'))
)
WHERE settings->>'consumer_token_encrypted' IS NOT NULL;

-- 2. Set NEW encryption key
ALTER DATABASE postgres SET app.encryption_key = 'NEW_KEY_HERE';

-- 3. Re-encrypt with NEW key
UPDATE integration_settings
SET settings = jsonb_set(
  jsonb_set(
    settings,
    '{consumer_token_encrypted}',
    to_jsonb(encrypt_token(settings->>'consumer_token_temp'))
  ),
  '{consumer_token_temp}',
  'null'
)
WHERE settings->>'consumer_token_temp' IS NOT NULL;

-- 4. Verify and clean up
SELECT 
  decrypt_token(settings->>'consumer_token_encrypted') IS NOT NULL as decrypts_ok
FROM integration_settings;

-- Remove temp fields
UPDATE integration_settings
SET settings = settings - 'consumer_token_temp';
```

---

## Security Checklist

After completing setup:

- [ ] All four secrets are configured in database
- [ ] Secrets are saved in password manager
- [ ] Existing tokens are encrypted
- [ ] Plaintext tokens are removed (after verification)
- [ ] Cron jobs are scheduled and active
- [ ] Test cron execution successful
- [ ] Edge Functions tested with secrets
- [ ] Rotation schedule documented
- [ ] Team members notified (if applicable)
- [ ] Backup of secrets created
- [ ] This guide bookmarked for future reference

---

## Support

If you encounter issues during setup:

1. Check the troubleshooting section above
2. Review Supabase logs in dashboard
3. Check Edge Function logs
4. Verify database configuration
5. Contact support if needed

---

**Last Updated:** October 10, 2025  
**Version:** 1.0

