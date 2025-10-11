# 🧪 Security Fixes - Testing Checklist

**Versjon:** v0.2.18  
**Dato:** 11. oktober 2025  
**Status:** Klar til testing

---

## 📋 **Forberedelser**

### **Før du starter:**
- [ ] Vercel deployment er ferdig (sjekk Vercel dashboard)
- [ ] Du har tilgang til både admin/manager og vanlig user-konto
- [ ] Supabase Dashboard er tilgjengelig
- [ ] Appen er tilgjengelig på Vercel URL

---

## 🎯 **Test 1: Integration Settings RLS (Admin/Manager Only)**

### **Som Admin/Manager:**
1. [ ] **Logg inn** som admin eller manager
2. [ ] **Gå til** Admin → Integrasjoner
3. [ ] **Verifiser** at du kan se Tripletex-innstillinger
4. [ ] **Verifiser** at du kan redigere/oppdatere innstillinger

### **Som Vanlig User:**
1. [ ] **Logg inn** som vanlig user (ikke admin/manager)
2. [ ] **Gå til** Admin → Integrasjoner
3. [ ] **Forventet resultat:** Du skal få "Access Denied" eller lignende
4. [ ] **Verifiser** at du IKKE kan se integration settings

### **Via Supabase Dashboard (SQL Editor):**
```sql
-- Test som vanlig user (ikke admin/manager)
-- Dette skal feile hvis RLS fungerer
SELECT * FROM integration_settings;
```

---

## 🎯 **Test 2: Tripletex API Authorization**

### **Som Vanlig User:**
1. [ ] **Logg inn** som vanlig user
2. [ ] **Prøv å aksessere** Tripletex-funksjonalitet (hvis tilgjengelig i UI)
3. [ ] **Forventet resultat:** "Forbidden" eller "Access Denied"

### **Som Admin/Manager:**
1. [ ] **Logg inn** som admin/manager
2. [ ] **Aksesser** Tripletex-funksjonalitet
3. [ ] **Forventet resultat:** Fungerer normalt

### **Direkte API Test:**
```bash
# Test med vanlig user token (skal feile)
curl -X POST "https://jlndohflirfixbinqdwe.supabase.co/functions/v1/tripletex-api" \
  -H "Authorization: Bearer VANLIG_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "sync-employees", "orgId": "din-org-id"}'

# Forventet: 403 Forbidden
```

---

## 🎯 **Test 3: Email Reminders Authorization**

### **Som Vanlig User:**
1. [ ] **Logg inn** som vanlig user
2. [ ] **Prøv å sende** test email (hvis tilgjengelig i UI)
3. [ ] **Forventet resultat:** Fungerer (send-test er tillatt for alle)

### **Som Admin/Manager:**
1. [ ] **Logg inn** som admin/manager
2. [ ] **Konfigurer** email-innstillinger
3. [ ] **Send** test email
4. [ ] **Forventet resultat:** Fungerer normalt

### **System-wide Operations:**
```bash
# Dette skal feile uten service role eller trigger secret
curl -X POST "https://jlndohflirfixbinqdwe.supabase.co/functions/v1/email-reminders" \
  -H "Content-Type: application/json" \
  -d '{"action": "send-weekly-reminder", "orgId": "all"}'

# Forventet: 403 Forbidden
```

---

## 🎯 **Test 4: Nightly Sync Protection**

### **Direkte API Test:**
```bash
# Dette skal feile uten trigger secret
curl -X POST "https://jlndohflirfixbinqdwe.supabase.co/functions/v1/nightly-sync" \
  -H "Content-Type: application/json" \
  -d '{"triggered_by": "test"}'

# Forventet: 403 Forbidden

# Med trigger secret (skal fungere)
curl -X POST "https://jlndohflirfixbinqdwe.supabase.co/functions/v1/nightly-sync" \
  -H "Content-Type: application/json" \
  -H "X-Trigger-Secret: DIN_NIGHTLY_SYNC_SECRET" \
  -d '{"triggered_by": "test"}'

# Forventet: 200 OK
```

---

## 🎯 **Test 5: Token Encryption**

### **Via Supabase SQL Editor:**
```sql
-- Test encryption
SELECT 
  'test-token-123' as original,
  encrypt_token('test-token-123') as encrypted,
  decrypt_token(encrypt_token('test-token-123')) as decrypted;

-- Forventet: original og decrypted skal være like
```

---

## 🎯 **Test 6: Rate Limiting**

### **Via Supabase SQL Editor:**
```sql
-- Test rate limiting
SELECT 
  check_rate_limit('test-user-123', 3, 60) as call_1,
  check_rate_limit('test-user-123', 3, 60) as call_2,
  check_rate_limit('test-user-123', 3, 60) as call_3,
  check_rate_limit('test-user-123', 3, 60) as call_4;

-- Forventet: t, t, t, f (4. call skal feile)
```

---

## 🎯 **Test 7: Secrets Management**

### **Via Supabase SQL Editor:**
```sql
-- Verifiser at secrets er satt
SELECT 
  key,
  CASE 
    WHEN key = 'service_role_key' THEN 'HIDDEN (length: ' || LENGTH(value) || ')'
    ELSE 'SET: ' || LEFT(value, 10) || '... (length: ' || LENGTH(value) || ')'
  END as status
FROM secrets 
ORDER BY key;

-- Forventet: Alle 4 secrets skal vises
```

---

## 🎯 **Test 8: End-to-End User Flow**

### **Som Vanlig User:**
1. [ ] **Logg inn** som vanlig user
2. [ ] **Naviger** gjennom appen
3. [ ] **Verifiser** at grunnleggende funksjonalitet fungerer
4. [ ] **Verifiser** at admin-funksjoner er utilgjengelige

### **Som Admin/Manager:**
1. [ ] **Logg inn** som admin/manager
2. [ ] **Naviger** gjennom appen
3. [ ] **Verifiser** at alle funksjoner fungerer
4. [ ] **Test** admin-spesifikke funksjoner

---

## 🎯 **Test 9: Error Handling**

### **Test Ugyldige Tokens:**
```bash
# Test med ugyldig token
curl -X POST "https://jlndohflirfixbinqdwe.supabase.co/functions/v1/tripletex-api" \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'

# Forventet: 401 Unauthorized
```

### **Test Ugyldig OrgId:**
```bash
# Test med orgId som user ikke tilhører
curl -X POST "https://jlndohflirfixbinqdwe.supabase.co/functions/v1/tripletex-api" \
  -H "Authorization: Bearer DIN_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "test", "orgId": "annet-org-id"}'

# Forventet: 403 Forbidden
```

---

## ✅ **Suksesskriterier**

**Alle tester skal passere:**
- [ ] Vanlige users kan IKKE aksessere admin-funksjoner
- [ ] Admin/manager kan aksessere alle funksjoner
- [ ] API-endepunkter returnerer riktige feilkoder
- [ ] Token encryption/decryption fungerer
- [ ] Rate limiting fungerer
- [ ] Secrets er sikkert lagret
- [ ] RLS policies blokkerer uautorisert tilgang

---

## 🚨 **Hvis Noe Feiler**

### **Vanlige Problemer:**

1. **"Permission denied" på RLS:**
   - Sjekk at user har riktig rolle i profiles tabellen
   - Sjekk at org_id matcher

2. **"Encryption key not found":**
   - Sjekk at secrets tabellen har encryption_key
   - Verifiser at funksjonen kan lese fra secrets

3. **"Rate limit exceeded":**
   - Vent 1-2 minutter før du tester igjen
   - Eller test med forskjellige user-identifiers

4. **"Forbidden" på API calls:**
   - Sjekk at Authorization header er riktig
   - Sjekk at user tilhører riktig org

### **Debugging:**
```sql
-- Sjekk user profil
SELECT * FROM profiles WHERE user_id = auth.uid();

-- Sjekk org tilhørighet
SELECT * FROM org WHERE id IN (
  SELECT org_id FROM profiles WHERE user_id = auth.uid()
);

-- Sjekk secrets
SELECT key, LENGTH(value) as length FROM secrets;
```

---

## 📞 **Hjelp**

**Hvis du støter på problemer:**
1. **Sjekk** Supabase Dashboard logs
2. **Sjekk** Vercel deployment logs
3. **Kjør** SQL debug-spørringer over
4. **Kontakt** meg med feilmeldinger og hvilke tester som feiler

**God testing!** 🚀
