# 🔒 RLS (Row Level Security) - TODO for Skalering

**Status:** ⚠️ RLS er DISABLET (Oktober 2025)
**Sikkerhet nå:** App-level (ProtectedRoute, auth checks)
**Akseptabelt for:** 1-10 organisasjoner, kjente brukere

---

## 📅 Når må RLS implementeres?

### 🟢 GRØNT (OK uten RLS):
- Færre enn 10 organisasjoner
- Alle brukere er interne/kjente
- Kan fikse sikkerhetsproblemer manuelt ved behov

### 🟡 GUL (Begynn planlegge):
- 10-20 organisasjoner
- Noen eksterne brukere
- Compliance-krav begynner å dukke opp

### 🔴 RØD (KRITISK - må ha RLS):
- 20+ organisasjoner
- Mange ukjente brukere
- Kan ikke stole på app-level sikkerhet alene
- GDPR/compliance-krav
- Data fra konkurrerende bedrifter i samme database

---

## ✅ Implementeringsplan (når tiden kommer)

### Steg 1: Planlegging (1 dag)
1. Liste alle tabeller som inneholder org-spesifikke data:
   - `profiles` (user_id = auth.uid())
   - `vakt` (org_id filter)
   - `person` (org_id filter)
   - `org` (id filter)
   - `ttx_project_cache` (org_id filter)
   - `ttx_employee_cache` (org_id filter)
   - `invite_codes` (org_id filter)
   - `invite_code_uses` (invite_code_id → org_id)

2. Dokumenter hvilke roller som skal ha tilgang til hva
3. Lag test-cases for hver policy

### Steg 2: Implementer ENKLE policies (2-3 dager)
**Viktig: UNNGÅ funksjoner som leser fra samme tabell!**

```sql
-- ✅ GOD POLICY (ingen loops):
CREATE POLICY "Users view own org vakt" 
ON vakt FOR SELECT 
USING (
  org_id IN (
    SELECT org_id FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- ❌ DÅRLIG POLICY (kan skape loops):
CREATE POLICY "Complex policy"
ON profiles FOR SELECT
USING (
  user_has_profile() AND  -- ❌ Funksjon som leser profiles!
  org_id = get_user_org_id()  -- ❌ Kan skape loop!
);
```

**Anbefalt rekkefølge:**
1. `profiles` først (enklest, ingen avhengigheter)
2. `org` (direkte lookup på profiles)
3. `vakt`, `person` (bruker org_id fra profiles)
4. Cache-tabeller (`ttx_*`)
5. Invite-tabeller

### Steg 3: Test grundig (2-3 dager)
1. Test med flere brukere i ulike organisasjoner
2. Sjekk at brukere IKKE kan se andres data
3. Test med admin/superadmin/employee roller
4. Performance-test (RLS kan gjøre queries tregere)

### Steg 4: Deploy gradvis
1. Implementer i staging først
2. Test i 1-2 uker
3. Deploy til produksjon (én tabell om gangen)
4. Overvåk for feil

---

## 🔧 Når dere er klare:

**Ikke kjør gamle SQL-filer!** De har bugs. Lag nye fra bunnen av.

**Mal for enkel policy:**
```sql
-- 1. Enable RLS
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- 2. Simple read policy
CREATE POLICY "users_read_own_org"
ON <table_name>
FOR SELECT
USING (
  org_id = (
    SELECT org_id FROM profiles 
    WHERE user_id = auth.uid() 
    LIMIT 1
  )
);

-- 3. Simple write policy (admin only)
CREATE POLICY "admins_write_own_org"
ON <table_name>
FOR INSERT
WITH CHECK (
  org_id = (
    SELECT org_id FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'superadmin')
    LIMIT 1
  )
);
```

---

## 📚 Ressurser:
- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Best Practices](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

**Oppdatert:** 8. oktober 2025  
**Neste review:** Når dere har 10+ organisasjoner eller eksterne brukere


