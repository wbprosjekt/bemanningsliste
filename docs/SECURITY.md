# Security Documentation

This document describes the security architecture and best practices implemented in the Bemanningsliste application.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Authentication & Authorization](#authentication--authorization)
3. [Data Encryption](#data-encryption)
4. [Rate Limiting](#rate-limiting)
5. [Cron Job Security](#cron-job-security)
6. [Security Best Practices](#security-best-practices)
7. [Incident Response](#incident-response)

---

## Security Architecture

The application implements **defense-in-depth** with multiple layers of security:

```
┌─────────────────────────────────────────────────┐
│ 1. Network Layer (CORS, Rate Limiting)         │
├─────────────────────────────────────────────────┤
│ 2. Authentication Layer (JWT Verification)      │
├─────────────────────────────────────────────────┤
│ 3. Authorization Layer (Role-Based Access)      │
├─────────────────────────────────────────────────┤
│ 4. Database Layer (RLS Policies)                │
├─────────────────────────────────────────────────┤
│ 5. Encryption Layer (Data at Rest)              │
└─────────────────────────────────────────────────┘
```

### Security Principles

- **Zero Trust:** Every request is verified at multiple layers
- **Least Privilege:** Users only get access to what they need
- **Defense in Depth:** Multiple security layers prevent single points of failure
- **Encryption Everywhere:** Sensitive data encrypted at rest and in transit
- **Audit Logging:** All privileged operations are logged

---

## Authentication & Authorization

### JWT Authentication

All Edge Functions (except `nightly-sync`) require valid JWT tokens:

```typescript
// Automatic JWT verification via config.toml
[functions.tripletex-api]
verify_jwt = true

[functions.email-reminders]
verify_jwt = true
```

### Role-Based Access Control (RBAC)

Three role levels with hierarchical permissions:

| Role | Level | Permissions |
|------|-------|-------------|
| `user` | 1 | Read own data, submit timesheets |
| `manager` | 2 | + Approve timesheets, trigger syncs, send reminders |
| `admin` | 3 | + Manage integrations, configure settings, manage users |

### Authorization Helpers

Reusable auth functions in `supabase/functions/_shared/auth-helpers.ts`:

```typescript
// Check if user belongs to org with minimum role
await requireOrgAccess(authHeader, orgId, 'user');

// Require admin or manager role
await requireAdminOrManager(authHeader, orgId);

// Validate trigger secrets for cron jobs
validateTriggerSecret(req, 'SECRET_NAME');
```

### Protected Actions

#### Tripletex API

**Privileged Actions** (require admin/manager):
- `sync-employees`
- `sync-projects`
- `sync-activities`
- `export-timesheet`
- `approve_timesheet_entries`
- `test-session`
- `check-config`

**Read-Only Actions** (require user in org):
- `search-projects`
- `get_project_details`
- `verify-timesheet-entry`

#### Email Reminders

- **Test emails:** Any user in org
- **Send reminders:** Admin/manager only
- **System-wide (`orgId="all"`):** Service role or valid secret only

### Row Level Security (RLS)

Database-level security policies:

```sql
-- Only admins/managers can view integration settings
CREATE POLICY "Only admins and managers can view integration settings"
ON integration_settings FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);
```

**Protected Tables:**
- `integration_settings` - Admin/manager only (contains API keys)
- `email_settings` - Admin/manager only
- `reminder_settings` - Admin/manager only
- All other tables - Org-scoped access

---

## Data Encryption

### Encryption at Rest

API keys and tokens are encrypted using PostgreSQL's `pgcrypto` extension with AES encryption.

#### Encrypted Fields

In `integration_settings.settings` JSONB:
- `consumer_token_encrypted` - Tripletex consumer token
- `employee_token_encrypted` - Tripletex employee token
- `session_token_encrypted` - Tripletex session token

#### Encryption Functions

```sql
-- Encrypt a token
SELECT encrypt_token('my-secret-token');

-- Decrypt a token
SELECT decrypt_token('base64-encrypted-string');

-- Check if token is encrypted
SELECT is_token_encrypted(token);
```

#### Key Management

Encryption key is stored in database configuration:

```sql
ALTER DATABASE postgres SET app.encryption_key = 'your-32-byte-random-key';
```

⚠️ **Important:** 
- Use a cryptographically secure random key (32+ bytes)
- Store backup of key in secure vault (e.g., 1Password, AWS Secrets Manager)
- Never commit encryption key to version control
- Rotate keys periodically (requires re-encryption of existing data)

### Encryption in Transit

- All API calls use HTTPS/TLS
- Supabase enforces TLS 1.2+ for all connections
- Edge Functions communicate over encrypted channels only

---

## Rate Limiting

### Database-Backed Rate Limiting

Persistent rate limiting survives Edge Function cold starts:

```typescript
// Check rate limit (20 requests per 60 seconds)
const allowed = await checkRateLimit(clientId, 20, 60);
```

### Implementation

- Stored in `rate_limits` table
- Atomic operations prevent race conditions
- Automatic cleanup of old entries
- Per-client tracking by IP address

### Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `tripletex-api` | 20 req | 60 sec |
| `email-reminders` | 10 req | 60 sec |
| `nightly-sync` | N/A | Internal only |

### Monitoring

```sql
-- Check current rate limits
SELECT * FROM rate_limits 
WHERE window_start > now() - INTERVAL '5 minutes';

-- Clean up old entries manually
SELECT cleanup_old_rate_limits();
```

---

## Cron Job Security

### Trigger Secrets

Cron jobs authenticate using secrets instead of JWTs:

```http
X-Trigger-Secret: your-random-secret-key
```

### Secret Configuration

```sql
-- Set secrets in database configuration
ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';
ALTER DATABASE postgres SET app.email_reminders_secret = 'random-secret-1';
ALTER DATABASE postgres SET app.nightly_sync_secret = 'random-secret-2';
```

### Cron Job Endpoints

| Job | Endpoint | Secret | Frequency |
|-----|----------|--------|-----------|
| Weekly reminders | `email-reminders` | `EMAIL_REMINDERS_SECRET` | Hourly |
| Payroll reminders | `email-reminders` | `EMAIL_REMINDERS_SECRET` | Daily 9 AM |
| Nightly sync | `nightly-sync` | `NIGHTLY_SYNC_SECRET` | Daily 2 AM |

### Security Checks

```typescript
// In nightly-sync function
if (!validateTriggerSecret(req, 'NIGHTLY_SYNC_SECRET')) {
  return 403 Forbidden;
}
```

---

## Security Best Practices

### For Developers

1. **Never log sensitive data**
   ```typescript
   // ❌ BAD
   console.log('Token:', apiToken);
   
   // ✅ GOOD
   console.log('Token:', maskToken(apiToken));
   ```

2. **Always validate org access**
   ```typescript
   // ❌ BAD
   const { data } = await supabase
     .from('integration_settings')
     .select('*')
     .eq('org_id', orgId); // No auth check!
   
   // ✅ GOOD
   const profile = await requireAdminOrManager(authHeader, orgId);
   if ('error' in profile) return createErrorResponse(profile);
   ```

3. **Use service role sparingly**
   - Only for system operations
   - Never expose service role key to client
   - Log all service role operations

4. **Encrypt sensitive data**
   ```typescript
   // ❌ BAD
   settings: {
     api_key: 'plaintext-key'
   }
   
   // ✅ GOOD
   settings: {
     api_key_encrypted: await encrypt_token('plaintext-key')
   }
   ```

### For Administrators

1. **Rotate secrets regularly**
   - Encryption keys: Every 6 months
   - Trigger secrets: Every 3 months
   - Service role key: Only if compromised

2. **Monitor access logs**
   ```sql
   -- Check recent authorization failures
   SELECT * FROM auth.audit_log_entries
   WHERE action = 'token_failed'
   AND created_at > now() - INTERVAL '1 day';
   ```

3. **Review user roles**
   ```sql
   -- List all admin/manager users
   SELECT p.display_name, p.role, o.name as org_name
   FROM profiles p
   JOIN org o ON p.org_id = o.id
   WHERE p.role IN ('admin', 'manager')
   ORDER BY o.name, p.role;
   ```

4. **Enable audit logging**
   - Track all integration setting changes
   - Log reminder sends
   - Monitor failed auth attempts

### For Users

1. **Use strong passwords**
   - Minimum 12 characters
   - Mix of letters, numbers, symbols
   - Never reuse passwords

2. **Enable 2FA** (when available)

3. **Report suspicious activity**
   - Unexpected email reminders
   - Unauthorized data access
   - Strange timesheet entries

---

## Incident Response

### Security Incident Protocol

1. **Detect**
   - Monitor logs for anomalies
   - Watch for authorization failures
   - Check rate limit violations

2. **Contain**
   ```sql
   -- Revoke user access immediately
   UPDATE profiles 
   SET role = 'user' 
   WHERE user_id = 'compromised-user-id';
   
   -- Disable integration if keys compromised
   UPDATE integration_settings
   SET aktiv = false
   WHERE org_id = 'affected-org-id';
   ```

3. **Investigate**
   - Check audit logs
   - Review access patterns
   - Identify affected data

4. **Remediate**
   - Rotate compromised keys
   - Update affected passwords
   - Patch vulnerabilities
   - Re-encrypt data if needed

5. **Document**
   - Record incident details
   - Document response actions
   - Update security procedures

### Common Security Issues

#### Suspicious API Activity

```sql
-- Find users with excessive failed auth attempts
SELECT user_id, COUNT(*) as failures
FROM auth.audit_log_entries
WHERE action = 'token_failed'
AND created_at > now() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 10;
```

#### Unauthorized Access Attempts

```sql
-- Check rate limit violations
SELECT identifier, MAX(request_count) as max_requests
FROM rate_limits
WHERE window_start > now() - INTERVAL '1 day'
GROUP BY identifier
HAVING MAX(request_count) > 100;
```

#### Compromised API Keys

If Tripletex API keys are compromised:

1. Disable integration immediately
2. Generate new keys in Tripletex
3. Update encrypted keys in database
4. Review audit logs for unauthorized activity
5. Notify affected users

---

## Security Checklist

### Initial Setup

- [ ] Set encryption key (`app.encryption_key`)
- [ ] Set trigger secrets (Email + Nightly Sync)
- [ ] Configure service role key in cron
- [ ] Enable RLS on all tables
- [ ] Test authorization flows
- [ ] Verify rate limiting works
- [ ] Encrypt existing tokens

### Regular Maintenance

- [ ] Review user roles monthly
- [ ] Check audit logs weekly
- [ ] Rotate secrets quarterly
- [ ] Update dependencies monthly
- [ ] Test security controls quarterly
- [ ] Review RLS policies semi-annually

### Before Production

- [ ] All secrets configured
- [ ] All tokens encrypted
- [ ] RLS policies tested
- [ ] Authorization flows verified
- [ ] Rate limiting enabled
- [ ] Audit logging active
- [ ] Security scan completed
- [ ] Incident response plan ready

---

## Contact

For security concerns or to report vulnerabilities:

- Email: security@bemanningsliste.no (hvis du har denne)
- Create private GitHub issue
- Contact administrator directly

**Do not** disclose security issues publicly until they are resolved.

---

**Last Updated:** October 10, 2025  
**Security Version:** 2.0

