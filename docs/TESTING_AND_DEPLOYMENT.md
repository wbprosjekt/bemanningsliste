# Testing & Deployment Guide for Security Fixes

⚠️ **CRITICAL:** This document outlines how to safely test and deploy security fixes without breaking production.

---

## Phase 1: Pre-Deployment Preparation

### 1.1 Create Complete Backup

#### Database Backup (Supabase)

```bash
# Option 1: Using Supabase CLI (recommended)
supabase db dump --db-url "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M%S).sql

# Option 2: Via Supabase Dashboard
# 1. Go to Database → Backups
# 2. Click "Create Backup" 
# 3. Wait for completion
# 4. Download backup file
```

**Save this file in a secure location!** (1Password, encrypted drive, etc.)

#### Application Code Backup

```bash
# Create a git tag for current production state
git tag production-before-security-fixes-$(date +%Y%m%d)
git push origin --tags

# Create backup branch
git checkout -b backup-production-$(date +%Y%m%d)
git push origin backup-production-$(date +%Y%m%d)
```

#### Edge Functions Backup

```bash
# Download current deployed functions
mkdir -p backups/edge-functions-$(date +%Y%m%d)
supabase functions download tripletex-api --output backups/edge-functions-$(date +%Y%m%d)/
supabase functions download email-reminders --output backups/edge-functions-$(date +%Y%m%d)/
supabase functions download nightly-sync --output backups/edge-functions-$(date +%Y%m%d)/
```

#### Vercel Deployment Backup

```bash
# Note current deployment URL
vercel ls

# Take screenshot of current environment variables
# Vercel Dashboard → Settings → Environment Variables
```

---

## Phase 2: Local Testing Environment

### 2.1 Set Up Local Supabase

```bash
# Initialize local Supabase (if not already done)
supabase init

# Start local Supabase
supabase start

# This will give you:
# - Local API URL: http://localhost:54321
# - Local DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# - Studio URL: http://localhost:54323
```

### 2.2 Apply Migrations Locally

```bash
# Apply new security migrations
supabase db reset

# Or manually:
psql $LOCAL_DB_URL -f supabase/migrations/20251010120000_fix_integration_settings_rls.sql
psql $LOCAL_DB_URL -f supabase/migrations/20251010120100_encrypt_integration_tokens.sql
psql $LOCAL_DB_URL -f supabase/migrations/20251010120200_create_rate_limit_table.sql
```

### 2.3 Set Up Local Secrets

```bash
# Connect to local database
psql postgresql://postgres:postgres@localhost:54322/postgres

# Set secrets
ALTER DATABASE postgres SET app.encryption_key = 'test-key-32-bytes-for-local-dev';
ALTER DATABASE postgres SET app.service_role_key = 'your-local-service-role-key';
ALTER DATABASE postgres SET app.email_reminders_secret = 'local-email-secret';
ALTER DATABASE postgres SET app.nightly_sync_secret = 'local-nightly-secret';
```

### 2.4 Seed Test Data

```sql
-- Create test organization
INSERT INTO org (id, name) VALUES ('test-org-id', 'Test Organization');

-- Create test users with different roles
-- Admin user
INSERT INTO profiles (user_id, org_id, display_name, role) 
VALUES ('admin-user-id', 'test-org-id', 'Test Admin', 'admin');

-- Manager user
INSERT INTO profiles (user_id, org_id, display_name, role) 
VALUES ('manager-user-id', 'test-org-id', 'Test Manager', 'manager');

-- Regular user
INSERT INTO profiles (user_id, org_id, display_name, role) 
VALUES ('regular-user-id', 'test-org-id', 'Test User', 'user');

-- Different org (for cross-org testing)
INSERT INTO org (id, name) VALUES ('other-org-id', 'Other Organization');
INSERT INTO profiles (user_id, org_id, display_name, role) 
VALUES ('other-user-id', 'other-org-id', 'Other User', 'admin');

-- Test integration settings with plaintext tokens
INSERT INTO integration_settings (org_id, integration_type, settings, aktiv)
VALUES ('test-org-id', 'tripletex', 
  '{"consumer_token": "test-consumer-token", "employee_token": "test-employee-token"}'::jsonb, 
  true);
```

### 2.5 Deploy Functions Locally

```bash
# Deploy to local Supabase
supabase functions serve

# Or deploy specific function
supabase functions serve tripletex-api
```

---

## Phase 3: Automated Test Suite

### 3.1 Create Test Scripts

Create `test-security.sh`:

```bash
#!/bin/bash

# Configuration
LOCAL_URL="http://localhost:54321/functions/v1"
ADMIN_TOKEN="eyJ..." # Generate from local Supabase Studio
MANAGER_TOKEN="eyJ..."
USER_TOKEN="eyJ..."
OTHER_ORG_TOKEN="eyJ..."

echo "================================"
echo "Security Tests Starting"
echo "================================"

# Test 1: Regular user cannot access other org
echo "Test 1: Cross-org access prevention"
curl -X POST "$LOCAL_URL/tripletex-api" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"sync-employees","orgId":"other-org-id"}' \
  | jq '.error' | grep -q "Forbidden" && echo "✅ PASS" || echo "❌ FAIL"

# Test 2: Regular user cannot trigger sync
echo "Test 2: Regular user cannot sync"
curl -X POST "$LOCAL_URL/tripletex-api" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"sync-employees","orgId":"test-org-id"}' \
  | jq '.error' | grep -q "admin" && echo "✅ PASS" || echo "❌ FAIL"

# Test 3: Manager CAN trigger sync
echo "Test 3: Manager can sync"
curl -X POST "$LOCAL_URL/tripletex-api" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"sync-employees","orgId":"test-org-id"}' \
  | jq '.success' | grep -q "true" && echo "✅ PASS" || echo "❌ FAIL"

# Test 4: Admin CAN access integration settings (via RLS)
echo "Test 4: Admin can view integration settings"
# This needs to be tested via Supabase client, not direct HTTP

# Test 5: Regular user cannot trigger reminders
echo "Test 5: Regular user cannot trigger reminders"
curl -X POST "$LOCAL_URL/email-reminders" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"send-weekly-reminder","orgId":"test-org-id"}' \
  | jq '.error' | grep -q "admin" && echo "✅ PASS" || echo "❌ FAIL"

# Test 6: Nightly sync requires secret
echo "Test 6: Nightly sync requires valid secret"
curl -X POST "$LOCAL_URL/nightly-sync" \
  -H "Content-Type: application/json" \
  | jq '.error' | grep -q "secret" && echo "✅ PASS" || echo "❌ FAIL"

# Test 7: Nightly sync works WITH secret
echo "Test 7: Nightly sync works with valid secret"
curl -X POST "$LOCAL_URL/nightly-sync" \
  -H "Content-Type: application/json" \
  -H "X-Trigger-Secret: local-nightly-secret" \
  | jq '.message' | grep -q "completed" && echo "✅ PASS" || echo "❌ FAIL"

# Test 8: Rate limiting persists
echo "Test 8: Rate limiting"
for i in {1..22}; do
  curl -s -X POST "$LOCAL_URL/tripletex-api" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"action":"check-config","orgId":"test-org-id"}' > /dev/null
done
curl -X POST "$LOCAL_URL/tripletex-api" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"check-config","orgId":"test-org-id"}' \
  | jq '.error' | grep -q "Rate limit" && echo "✅ PASS" || echo "❌ FAIL"

# Test 9: Token encryption roundtrip
echo "Test 9: Token encryption"
psql postgresql://postgres:postgres@localhost:54322/postgres -c \
  "SELECT decrypt_token(encrypt_token('test-secret-123')) = 'test-secret-123' as works;" \
  | grep -q "t" && echo "✅ PASS" || echo "❌ FAIL"

echo "================================"
echo "Security Tests Completed"
echo "================================"
```

Make it executable:
```bash
chmod +x test-security.sh
```

### 3.2 Run Tests

```bash
./test-security.sh
```

**All tests must pass before proceeding to staging!**

---

## Phase 4: Staging Environment (Recommended)

### 4.1 Create Staging Supabase Project

1. Go to Supabase Dashboard
2. Create new project: "bemanningsliste-staging"
3. Note the new connection strings

### 4.2 Copy Production Data to Staging

```bash
# Dump production data
supabase db dump --db-url "$PRODUCTION_DB_URL" > prod-dump.sql

# Restore to staging
psql "$STAGING_DB_URL" < prod-dump.sql

# Or use Supabase dashboard to restore from backup
```

### 4.3 Apply Migrations to Staging

```bash
# Set staging as target
export SUPABASE_DB_URL=$STAGING_DB_URL

# Run migrations
supabase db push --db-url $STAGING_DB_URL
```

### 4.4 Set Up Staging Secrets

```sql
-- Connect to staging database
\c $STAGING_DB_URL

-- Set secrets (use different values than production!)
ALTER DATABASE postgres SET app.encryption_key = 'staging-encryption-key-32-bytes';
ALTER DATABASE postgres SET app.service_role_key = 'staging-service-role-key';
ALTER DATABASE postgres SET app.email_reminders_secret = 'staging-email-secret';
ALTER DATABASE postgres SET app.nightly_sync_secret = 'staging-nightly-secret';
```

### 4.5 Deploy Functions to Staging

```bash
# Deploy Edge Functions to staging project
supabase functions deploy --project-ref staging-project-ref tripletex-api
supabase functions deploy --project-ref staging-project-ref email-reminders
supabase functions deploy --project-ref staging-project-ref nightly-sync
```

### 4.6 Deploy Frontend to Vercel Staging

```bash
# Create staging environment in Vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL staging
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY staging

# Deploy to staging
vercel --prod --scope staging
```

### 4.7 Test on Staging

1. **Manual Testing:**
   - Log in as different user roles
   - Try to access other orgs (should fail)
   - Try to sync as regular user (should fail)
   - Try to sync as admin (should work)
   - Check that encrypted tokens work
   - Verify cron jobs execute

2. **Run Test Suite Against Staging:**
   ```bash
   STAGING_URL="https://staging-project.supabase.co" ./test-security.sh
   ```

3. **Performance Testing:**
   - Check response times
   - Monitor rate limiting
   - Verify no regressions

---

## Phase 5: Production Deployment

### 5.1 Pre-Deployment Checklist

- [ ] All local tests passed
- [ ] All staging tests passed
- [ ] Backup created and verified
- [ ] Rollback plan documented
- [ ] Team notified of deployment
- [ ] Monitoring dashboard ready
- [ ] Off-hours deployment scheduled (low traffic)

### 5.2 Deployment Steps (Execute in Order)

#### Step 1: Database Migrations (Read-Only)

```bash
# Apply migrations that don't break existing code
psql $PRODUCTION_DB_URL -f supabase/migrations/20251010120000_fix_integration_settings_rls.sql
psql $PRODUCTION_DB_URL -f supabase/migrations/20251010120100_encrypt_integration_tokens.sql
psql $PRODUCTION_DB_URL -f supabase/migrations/20251010120200_create_rate_limit_table.sql
```

**⏸️ CHECKPOINT 1:** Verify no errors, existing app still works

#### Step 2: Set Production Secrets

```sql
-- Connect to production database
\c $PRODUCTION_DB_URL

-- IMPORTANT: Use strong, unique secrets!
-- Generate with: openssl rand -base64 32

ALTER DATABASE postgres SET app.encryption_key = 'GENERATE_UNIQUE_32_BYTE_KEY';
ALTER DATABASE postgres SET app.service_role_key = 'YOUR_PROD_SERVICE_ROLE_KEY';
ALTER DATABASE postgres SET app.email_reminders_secret = 'GENERATE_UNIQUE_SECRET';
ALTER DATABASE postgres SET app.nightly_sync_secret = 'GENERATE_UNIQUE_SECRET';
```

**Save these secrets in password manager immediately!**

#### Step 3: Encrypt Existing Tokens

```sql
-- This can be done while app is running (non-blocking)

-- Encrypt consumer tokens
UPDATE integration_settings
SET settings = jsonb_set(
  settings,
  '{consumer_token_encrypted}',
  to_jsonb(encrypt_token(settings->>'consumer_token'))
)
WHERE settings->>'consumer_token' IS NOT NULL
  AND settings->>'consumer_token' != ''
  AND (settings->>'consumer_token_encrypted' IS NULL);

-- Encrypt employee tokens
UPDATE integration_settings
SET settings = jsonb_set(
  settings,
  '{employee_token_encrypted}',
  to_jsonb(encrypt_token(settings->>'employee_token'))
)
WHERE settings->>'employee_token' IS NOT NULL
  AND settings->>'employee_token' != '';

-- Verify encryption worked
SELECT 
  org_id,
  settings->>'consumer_token_encrypted' IS NOT NULL as consumer_encrypted,
  settings->>'employee_token_encrypted' IS NOT NULL as employee_encrypted
FROM integration_settings
WHERE integration_type = 'tripletex';
```

**⏸️ CHECKPOINT 2:** Verify tokens are encrypted

#### Step 4: Deploy Edge Functions (One at a Time)

```bash
# Deploy with caution, one function at a time

# 1. Deploy tripletex-api (highest risk)
supabase functions deploy tripletex-api
# Wait 2 minutes, monitor logs
supabase functions logs tripletex-api --tail

# 2. Deploy email-reminders
supabase functions deploy email-reminders
# Wait 2 minutes, monitor logs
supabase functions logs email-reminders --tail

# 3. Deploy nightly-sync
supabase functions deploy nightly-sync
# Wait 2 minutes, monitor logs
supabase functions logs nightly-sync --tail
```

**⏸️ CHECKPOINT 3:** Check each function's logs for errors

#### Step 5: Update Cron Jobs

```bash
# Run updated cron setup
psql $PRODUCTION_DB_URL -f update_cron_with_http.sql

# Verify cron jobs are scheduled
psql $PRODUCTION_DB_URL -c "SELECT jobname, schedule, active FROM cron.job;"
```

**⏸️ CHECKPOINT 4:** Verify cron jobs are active

#### Step 6: Deploy Frontend to Vercel

```bash
# Deploy to production
git push origin main

# Or manual deploy
vercel --prod
```

**⏸️ CHECKPOINT 5:** Test frontend immediately after deploy

#### Step 7: Remove Plaintext Tokens (After 24h of Verification)

```sql
-- ONLY after verifying everything works for 24+ hours!

UPDATE integration_settings
SET settings = settings - 'consumer_token' - 'employee_token' - 'session_token'
WHERE integration_type = 'tripletex'
  AND settings->>'consumer_token_encrypted' IS NOT NULL
  AND settings->>'employee_token_encrypted' IS NOT NULL;
```

---

## Phase 6: Post-Deployment Monitoring

### 6.1 Immediate Checks (First Hour)

```bash
# Monitor Edge Function logs
supabase functions logs tripletex-api --tail
supabase functions logs email-reminders --tail
supabase functions logs nightly-sync --tail

# Check for errors
supabase functions logs tripletex-api | grep -i error
```

### 6.2 Monitoring Queries

```sql
-- Check authorization failures
SELECT COUNT(*) as auth_failures
FROM auth.audit_log_entries
WHERE action = 'token_failed'
AND created_at > now() - INTERVAL '1 hour';

-- Check rate limit activity
SELECT identifier, MAX(request_count) as max_requests
FROM rate_limits
WHERE window_start > now() - INTERVAL '1 hour'
GROUP BY identifier
ORDER BY max_requests DESC;

-- Check successful function calls
-- (This requires setting up logging in your functions)
```

### 6.3 User Testing Checklist

Have different users test:

- [ ] Admin: Can sync Tripletex data
- [ ] Admin: Can view integration settings
- [ ] Manager: Can sync Tripletex data
- [ ] Manager: Can send test emails
- [ ] Regular user: Can view their own data
- [ ] Regular user: Cannot access other org data
- [ ] Regular user: Cannot trigger syncs
- [ ] All: Tripletex integration still works
- [ ] All: Email reminders work
- [ ] Cron jobs execute successfully

---

## Phase 7: Rollback Procedures

### If Things Go Wrong

#### Quick Rollback (Within 1 Hour)

```bash
# 1. Revert Edge Functions
supabase functions deploy tripletex-api --project-ref backup-folder
supabase functions deploy email-reminders --project-ref backup-folder
supabase functions deploy nightly-sync --project-ref backup-folder

# 2. Revert frontend (Vercel keeps previous deployments)
vercel rollback

# 3. Revert config.toml
git revert <commit-hash>
git push
```

#### Full Rollback (If Migrations Cause Issues)

```bash
# 1. Restore database from backup
psql $PRODUCTION_DB_URL < backup-YYYYMMDD-HHMMSS.sql

# 2. Revert all code changes
git revert <security-fixes-commit>
git push

# 3. Redeploy old functions
# (Use backed up versions)
```

#### Emergency Hotfixes

If only specific function is broken:

```typescript
// Add temporary bypass in broken function
// AT THE VERY TOP, before any logic:
if (Deno.env.get('EMERGENCY_BYPASS') === 'true') {
  console.warn('EMERGENCY BYPASS ACTIVE');
  // Old logic here
}
```

Then set environment variable in Supabase:
```bash
supabase secrets set EMERGENCY_BYPASS=true
```

---

## Phase 8: Communication Plan

### Before Deployment

**Email to team:**
```
Subject: Security Updates Deployment - [DATE] [TIME]

Team,

We will be deploying important security updates on [DATE] at [TIME].

Expected downtime: None (rolling deployment)
Expected issues: None (fully tested on staging)

What we're deploying:
- Enhanced authorization controls
- Token encryption
- Improved rate limiting

What to watch for:
- Any authorization errors
- Tripletex sync issues
- Email reminder problems

Rollback plan: Ready if needed

Please report any issues immediately to [CONTACT].
```

### During Deployment

Use Slack/Teams for real-time updates:
```
[14:00] Starting deployment - Phase 1 (Migrations)
[14:05] ✅ Migrations complete, no errors
[14:10] Starting Phase 2 (Edge Functions)
[14:15] ✅ tripletex-api deployed
[14:20] ✅ email-reminders deployed
[14:25] ✅ nightly-sync deployed
[14:30] ✅ All functions healthy
[14:35] Deployment complete - monitoring for 1 hour
```

### After Deployment

**Email to team:**
```
Subject: Security Updates Successfully Deployed

Team,

Security updates have been successfully deployed.

All systems are operating normally.

New security features:
✅ Enhanced authorization
✅ Encrypted API tokens
✅ Persistent rate limiting

Action required:
- None for regular users
- Admins: Review new security docs

Questions? Contact [ADMIN]
```

---

## Testing Matrix

| Feature | Test Case | Expected Result | Who Tests |
|---------|-----------|----------------|-----------|
| **Authorization** |
| | User accesses own org | ✅ Success | All users |
| | User accesses other org | ❌ 403 Forbidden | Regular user |
| | User triggers sync | ❌ 403 Forbidden | Regular user |
| | Manager triggers sync | ✅ Success | Manager |
| | Admin views integration settings | ✅ Success | Admin |
| | User views integration settings | ❌ Empty result | Regular user |
| **Encryption** |
| | Tripletex API works with encrypted tokens | ✅ Success | Admin |
| | Token roundtrip encrypt/decrypt | ✅ Returns original | DB Test |
| **Rate Limiting** |
| | 20 requests in 60s | ✅ All succeed | Any user |
| | 21st request in 60s | ❌ 429 Rate Limit | Any user |
| | After cold start | ✅ Limit persists | Test script |
| **Cron Jobs** |
| | Nightly sync without secret | ❌ 403 Forbidden | Test script |
| | Nightly sync with secret | ✅ Success | Cron |
| | Email reminders execute | ✅ Success | Cron |
| **General** |
| | Existing functionality unchanged | ✅ All works | All users |
| | Performance acceptable | ✅ < 200ms overhead | Monitoring |

---

## Success Criteria

Deployment is considered successful when:

- [ ] All automated tests pass
- [ ] No critical errors in logs (1 hour)
- [ ] User acceptance testing complete
- [ ] Performance metrics acceptable
- [ ] Cron jobs executing successfully
- [ ] No rollbacks required
- [ ] Documentation updated
- [ ] Team trained on new features

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing users locked out | Low | High | RLS policies tested, staging verified |
| Tripletex sync breaks | Medium | High | Encryption tested, fallback to env vars |
| Rate limiting too aggressive | Low | Medium | Tuned to 20 req/min, can adjust |
| Cron jobs fail | Medium | Medium | Secrets tested, manual trigger available |
| Performance degradation | Low | Low | Minimal overhead, tested on staging |

---

## Timeline Recommendation

**Week 1:**
- Day 1-2: Local testing
- Day 3-4: Staging deployment and testing
- Day 5: Team review and approval

**Week 2:**
- Day 1: Production deployment (off-hours)
- Day 2-5: Monitoring and user feedback
- Day 5: Remove plaintext tokens (if all OK)

**Total:** 2 weeks from start to completion

---

## Contact & Support

**Deployment Lead:** [Your Name]  
**Technical Support:** [Contact Info]  
**Emergency Rollback Authority:** [Admin Name]

**Deployment Window:** [Day] [Time] [Timezone]  
**Monitoring Period:** 48 hours post-deployment  
**Final Sign-off:** [Date] after successful monitoring

---

**Remember:** It's better to take 2 weeks to deploy safely than to rush and cause a production incident. 

**When in doubt, rollback and investigate!**

