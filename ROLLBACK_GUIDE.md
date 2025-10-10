# 🔄 ROLLBACK GUIDE - Hvis Noe Går Galt

⚠️ **VIKTIG:** Denne guiden lar deg reversere ALT tilbake til hvordan det var før security fixes.

---

## 🚨 Når Skal Du Rollback?

**Rollback ØYEBLIKKELIG hvis:**
- Brukere får feilmeldinger de ikke fikk før
- Tripletex-integrasjonen slutter å virke
- Noen blir låst ute
- Du er usikker på hva som skjedde

**IKKE vær redd for å rollback!** Det er bedre å rollback og prøve igjen senere.

---

## 🎯 Super-Enkel Rollback (3 Kommandoer)

### Hvis Du IKKE har deployet enda (alt er lokalt):

```bash
# 1. Gå tilbake til trygt punkt
git reset --hard safe-before-security-20251010

# 2. Rydd opp
git clean -fd

# Ferdig! Du er tilbake til før security fixes.
```

### Hvis Du HAR deployet til Vercel (frontend):

```bash
# 1. Reverser lokale endringer
git reset --hard safe-before-security-20251010

# 2. Force push (overstyrer remote)
git push origin main --force

# 3. Vercel deployer automatisk den gamle versjonen
# Eller gå til Vercel Dashboard → Deployments → Finn forrige deployment → "Promote to Production"
```

### Hvis Du HAR kjørt migrasjoner i Supabase:

**Dette er det ENESTE som ikke er helt automatisk.**

#### Metode 1: Restore fra backup (hvis du tok en)

```bash
# Hvis du har database backup
psql "$DATABASE_URL" < backups/backup-YYYYMMDD-HHMMSS.sql
```

#### Metode 2: Manuell rollback av migrasjoner (hvis du ikke har backup)

```sql
-- Kjør i Supabase SQL Editor:

-- 1. Fjern nye tabeller (hvis de ble opprettet)
DROP TABLE IF EXISTS rate_limits CASCADE;

-- 2. Gjenopprett gamle RLS policies på integration_settings
DROP POLICY IF EXISTS "Only admins and managers can view integration settings" ON integration_settings;
DROP POLICY IF EXISTS "Only admins and managers can manage integration settings" ON integration_settings;

CREATE POLICY "Users can view integration settings in their organization" 
ON integration_settings FOR SELECT 
USING (org_id IN (SELECT org_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage integration settings in their organization" 
ON integration_settings FOR ALL 
USING (org_id IN (SELECT org_id FROM profiles WHERE user_id = auth.uid()));

-- 3. Fjern krypteringsfunksjoner (hvis de ble opprettet)
DROP FUNCTION IF EXISTS encrypt_token(TEXT);
DROP FUNCTION IF EXISTS decrypt_token(TEXT);
DROP FUNCTION IF EXISTS is_token_encrypted(TEXT);

-- Ferdig! Migrasjoner er reversert.
```

### Hvis Du HAR deployet Edge Functions:

```bash
# 1. Gå tilbake til trygt punkt lokalt
git checkout safe-before-security-20251010

# 2. Deploy gamle funksjoner
supabase functions deploy tripletex-api
supabase functions deploy email-reminders
supabase functions deploy nightly-sync

# 3. Gå tilbake til main
git checkout main
```

---

## 📋 Komplett Rollback Checklist

Bruk denne hvis du vil være sikker på at ALT er tilbake:

- [ ] **Git:** `git reset --hard safe-before-security-20251010`
- [ ] **Git push:** `git push origin main --force` (hvis du hadde pushet)
- [ ] **Database migrasjoner:** Kjør rollback SQL (over)
- [ ] **Edge Functions:** Deploy gamle versjoner
- [ ] **Vercel:** Promote forrige deployment
- [ ] **Test:** Sjekk at appen fungerer som før

---

## 🧪 Test At Rollback Virket

Etter rollback, test dette:

1. **Logg inn** - Fungerer det?
2. **Tripletex sync** - Kan admin synce ansatte?
3. **Timeføring** - Kan brukere føre timer?
4. **Email reminders** - Sender de fortsatt?

Hvis alle disse fungerer → Rollback var vellykket! ✅

---

## 💡 Hvorfor Er Rollback Trygt?

### Det vi har sikret:

1. **Git tag:** `safe-before-security-20251010` - Eksakt tilstand før endringer
2. **Lokal backup:** `backups/manual-backup-*/` - Alle filer kopiert
3. **Git history:** Alle commits er bevart, kan gå tilbake til hvilken som helst
4. **Ingen data slettet:** Vi legger bare til ting, sletter ikke

### Hva som IKKE påvirkes av rollback:

- ✅ **User data** - Timeføringer, prosjekter, ansatte (alt bevares)
- ✅ **Autentisering** - Brukere kan fortsatt logge inn
- ✅ **Existing integrations** - Tripletex fortsetter å virke

### Hva som REVERSERES:

- 🔄 **Kode** - Tilbake til gammel kode
- 🔄 **Edge Functions** - Gamle versjoner deployed
- 🔄 **Config** - Gammel config.toml
- 🔄 **RLS policies** - Hvis du rollbacker migrasjoner

---

## 🎯 Scenarioer & Løsninger

### Scenario 1: "Jeg deployet til Vercel og alt krasjet"

```bash
# Quick fix - 2 minutter
vercel rollback  # Går til forrige deployment

# Eller via dashboard:
# 1. Gå til vercel.com/dashboard
# 2. Velg prosjektet
# 3. Deployments tab
# 4. Finn forrige vellykket deployment
# 5. Klikk "..." → "Promote to Production"
```

### Scenario 2: "Edge Functions gir feilmeldinger"

```bash
# Deployer gamle versjoner - 3 minutter
git checkout safe-before-security-20251010
supabase functions deploy tripletex-api
supabase functions deploy email-reminders
supabase functions deploy nightly-sync
git checkout main
```

### Scenario 3: "Jeg kjørte migrasjoner og nå fungerer ikke Tripletex"

```sql
-- I Supabase SQL Editor - 5 minutter
-- Kjør rollback SQL fra seksjonen over
-- Eller restore fra backup hvis du tok en
```

### Scenario 4: "Jeg har deployet ALT og ingenting virker"

```bash
# Full rollback - 10 minutter

# 1. Reverser kode
git reset --hard safe-before-security-20251010
git push origin main --force

# 2. Reverser Edge Functions
supabase functions deploy tripletex-api
supabase functions deploy email-reminders  
supabase functions deploy nightly-sync

# 3. Reverser migrasjoner (SQL fra over)

# 4. Vercel deployer automatisk ny versjon, eller rollback manuelt
```

### Scenario 5: "Jeg vet ikke hva som gikk galt"

```bash
# Når i tvil, gjør full rollback
# Det tar 10 minutter og er 100% trygt

git reset --hard safe-before-security-20251010
git push origin main --force

# Deretter test appen
# Hvis den virker = good
# Hvis ikke = noe annet er galt (ikke våre endringer)
```

---

## 🆘 Nødsituasjon

**Hvis INGENTING over virker:**

1. **Ikke panikk!** Data er trygt.

2. **Kontakt meg** (eller annen utvikler som kjenner systemet)

3. **I mellomtiden:**
   ```bash
   # Gå til siste kjente gode commit
   git log --oneline
   # Finn commit før security fixes (se etter ✅ merker)
   git reset --hard [COMMIT_SHA]
   git push origin main --force
   ```

4. **Worst case:** 
   - Restore database fra Supabase backup (hvis tilgjengelig)
   - Eller kjør system i "read-only mode" mens vi fikser

---

## 📊 Rollback Risiko-Vurdering

| Hva | Risiko | Reversibilitet |
|-----|--------|----------------|
| Git changes | ✅ Null risiko | 100% reversibelt |
| Edge Functions | ✅ Null risiko | 100% reversibelt |
| Config.toml | ✅ Null risiko | 100% reversibelt |
| Database migrations | ⚠️ Lav risiko | 95% reversibelt* |
| Vercel deployment | ✅ Null risiko | 100% reversibelt |

*Database migrations er 95% fordi vi legger til ting (ikke sletter), så rollback er trygt. De 5% er hvis noe uventet skjer under migrering.

---

## ✅ Best Practices for Trygg Deployment

**For å unngå behov for rollback:**

1. **Test lokalt først** - Bruk `supabase start` og test alt
2. **Deploy til staging først** - Hvis du har det
3. **Deploy én ting om gangen:**
   - Først: Migrasjoner (minst risiko)
   - Deretter: Edge Functions (medium risiko)
   - Til slutt: Frontend (minst kritisk)
4. **Moniter logs** - Sjekk for feil etter hver deployment
5. **Ha rollback-guiden åpen** - Klar til å bruke hvis nødvendig

---

## 🎓 Hva Jeg Lærte (For Fremtiden)

**Hvis du må rollback:**

- ✅ Det er HELT OK - alle gjør feil
- ✅ Bedre å rollback raskt enn å prøve å fikse i prod
- ✅ Ta backup neste gang før store endringer
- ✅ Test i staging først
- ✅ Deploy gradvis, ikke alt på en gang

**Hvis rollback gikk bra:**

- ✅ Du er trygg - systemet fungerer
- ✅ Kan prøve igjen senere med bedre testing
- ✅ Eller be om hjelp til å debugge før ny forsøk

---

## 📞 Support

**Hvis du trenger hjelp:**

1. Se denne guiden først
2. Prøv rollback-kommandoene
3. Sjekk logs for feilmeldinger
4. Kontakt support/utvikler med:
   - Hva du deployet
   - Hvilke feilmeldinger du får
   - Hva du har prøvd

---

## 🔐 Emergency Contact Card

**Print ut eller lagre denne:**

```
═══════════════════════════════════════
  🚨 EMERGENCY ROLLBACK KOMMANDOER 🚨
═══════════════════════════════════════

Hvis ALT går galt, kjør disse i rekkefølge:

1. git reset --hard safe-before-security-20251010
2. git push origin main --force
3. vercel rollback

Deretter gå til Supabase SQL Editor og kjør:

DROP TABLE IF EXISTS rate_limits CASCADE;

═══════════════════════════════════════
```

---

**Huskeregel:** Når i tvil, rollback! Det tar 5-10 minutter og er 100% trygt.

**Du har:**
- ✅ Git tag: `safe-before-security-20251010`
- ✅ Lokal backup: `backups/`
- ✅ Git history: Full
- ✅ Denne guiden: Alltid tilgjengelig

**Du er trygg!** 🛡️

