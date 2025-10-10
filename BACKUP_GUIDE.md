# Backup Guide - Før Security Fixes

⚠️ **VIKTIG:** Ta denne backupen FØR du gjør noen endringer!

---

## Metode 1: Automatisk Backup (Anbefalt) ⚡

### Steg 1: Sett opp DATABASE_URL

```bash
# Finn din DATABASE_URL i Supabase Dashboard:
# Settings → Database → Connection string → URI

export DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
```

**Hvordan finne DATABASE_URL:**
1. Gå til [Supabase Dashboard](https://supabase.com/dashboard)
2. Velg ditt prosjekt
3. Settings → Database
4. Under "Connection string", velg "URI"
5. Kopier hele strengen (starter med `postgresql://`)

### Steg 2: Kjør backup-scriptet

```bash
# Gjør scriptet kjørbart
chmod +x backup-supabase.sh

# Kjør backupen
./backup-supabase.sh
```

### Steg 3: Verifiser backupen

```bash
# Se hva som ble backupet
ls -lh backups/[timestamp]/

# Les backup-manifestet
cat backups/[timestamp]/BACKUP_MANIFEST.md
```

### Steg 4: Lagre backupen trygt

```bash
# Opprett en zip-fil
cd backups
zip -r backup-$(date +%Y%m%d-%H%M%S).zip [timestamp]/

# Last opp til sikker lagring:
# - 1Password
# - Google Drive (encrypted)
# - External hard drive
# - Cloud backup service
```

---

## Metode 2: Manuell Backup (Hvis script ikke fungerer) 🔧

### 1. Database Backup

#### Via Supabase Dashboard (Enklest)

1. Gå til Supabase Dashboard
2. Database → Backups
3. Klikk "Create Backup"
4. Vent til backup er ferdig
5. Klikk "Download" for å laste ned `.sql` filen

#### Via Terminal

```bash
# Full database dump
pg_dump "$DATABASE_URL" > backup-database-$(date +%Y%m%d).sql

# Verifiser filen
ls -lh backup-database-*.sql
head -n 20 backup-database-*.sql  # Se begynnelsen av filen
```

### 2. Edge Functions Backup

```bash
# Opprett backup-mappe
mkdir -p backups/edge-functions-$(date +%Y%m%d)

# Kopier alle funksjoner
cp -r supabase/functions/* backups/edge-functions-$(date +%Y%m%d)/

# Verifiser
ls -la backups/edge-functions-*/
```

### 3. Migrations Backup

```bash
# Backup migrasjoner
cp -r supabase/migrations backups/migrations-backup-$(date +%Y%m%d)/

# Verifiser
ls -la backups/migrations-backup-*/
```

### 4. Config Backup

```bash
# Backup config
cp supabase/config.toml backups/config-backup-$(date +%Y%m%d).toml

# Verifiser
cat backups/config-backup-*.toml
```

---

## Metode 3: Git Backup (Ekstra Sikkerhet) 🔐

```bash
# Opprett backup-tag
git tag -a backup-before-security-fixes-$(date +%Y%m%d) -m "Backup før security fixes"

# Push tag til GitHub
git push origin --tags

# Opprett backup-branch
git checkout -b backup-production-$(date +%Y%m%d)
git push origin backup-production-$(date +%Y%m%d)

# Gå tilbake til main
git checkout main
```

---

## Viktige Notater ⚠️

### Hva backupes AUTOMATISK:
- ✅ Database schema (alle tabeller, kolonner, constraints)
- ✅ Database data (alt innhold)
- ✅ RLS policies
- ✅ Edge Functions kode
- ✅ Migrations
- ✅ Config-filer

### Hva MÅ backupes MANUELT:
- ⚠️ **Secrets** (encryption keys, API keys) - lagres IKKE i backup
- ⚠️ **Service role key** - finn i Dashboard → Settings → API
- ⚠️ **Environment variables** - finn i Vercel Dashboard
- ⚠️ **Auth providers** - screenshot av innstillinger

### Backup av Secrets

```bash
# Opprett en sikker note i 1Password eller lignende:

Title: Supabase Secrets Backup - [DATE]

Service Role Key: eyJ... (fra Supabase Dashboard)
Anon Key: eyJ... (fra Supabase Dashboard)
Project URL: https://[project-ref].supabase.co

Database URL: postgresql://postgres.[ref]:[pwd]@...

Vercel Env Vars:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

Tripletex (hvis du har satt det opp):
- Consumer Token: [hvis kryptert, noter det]
- Employee Token: [hvis kryptert, noter det]
```

---

## Test Backup (Anbefalt) 🧪

### Lokalt Test

```bash
# Start lokal Supabase
supabase start

# Restore backup lokalt
psql "postgresql://postgres:postgres@localhost:54322/postgres" < backup-database-*.sql

# Verifiser at data er der
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT COUNT(*) FROM profiles;"
```

### Verifiser Backup Integritet

```bash
# Sjekk at SQL-filen er gyldig
head -n 100 backup-database-*.sql | grep -i "PostgreSQL"

# Sjekk filstørrelse (bør være > 1MB hvis du har data)
ls -lh backup-database-*.sql

# Tell antall INSERT statements (indikerer data)
grep -c "INSERT INTO" backup-database-*.sql
```

---

## Gjenopprettingsprosedyre (Hvis noe går galt) 🔄

### Full Database Restore

```bash
# ADVARSEL: Dette SLETTER all eksisterende data!

# 1. Koble til database
psql "$DATABASE_URL"

# 2. Slett eksisterende schema (optional)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# 3. Restore fra backup
\i backup-database-[date].sql

# 4. Verifiser
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
```

### Selektiv Restore (Kun én tabell)

```bash
# Restore kun en spesifikk tabell
pg_restore -d "$DATABASE_URL" -t profiles backup-database-*.sql
```

### Edge Functions Restore

```bash
# Deploy gamle versjoner av functions
supabase functions deploy tripletex-api --project-ref backups/edge-functions-[date]/tripletex-api
```

---

## Backup Checklist ✅

Før du fortsetter med security fixes, sjekk at du har:

- [ ] Database backup (.sql fil)
- [ ] Edge Functions backup (alle funksjoner kopiert)
- [ ] Migrations backup
- [ ] Config.toml backup
- [ ] Git tag opprettet og pushet
- [ ] Secrets notert i password manager
- [ ] Backup testet (optional men anbefalt)
- [ ] Backup lagret på sikker lokasjon (IKKE kun på laptop)
- [ ] Backup-manifest lest og forstått

---

## Hvor Lagre Backup? 💾

### Gode alternativer:
1. **1Password** - Encrypted vault (anbefalt for secrets)
2. **Google Drive** - Med passord-beskyttet zip
3. **Dropbox** - Med passord-beskyttet zip
4. **External Hard Drive** - Fysisk backup
5. **Cloud Backup Service** - AWS S3, Backblaze, etc.

### Dårlige alternativer:
- ❌ Kun på laptop (kan miste hvis laptop krasjer under deployment)
- ❌ I git repo (secrets eksponert)
- ❌ På samme server som produksjon (ikke en backup!)
- ❌ Udelt i team chat (security risk)

---

## Backup Oppbevaring

### Anbefalt oppbevaringspolitikk:

- **Før store endringer:** Ta backup
- **Ukentlig:** Automatisk backup (sett opp i Supabase hvis mulig)
- **Før produksjon deployment:** Ta backup
- **Hold backups i:** Minimum 30 dager

### Sletting av gamle backups:

```bash
# Slett backups eldre enn 30 dager (kun lokale)
find backups/ -name "backup-*" -mtime +30 -delete
```

**VIKTIG:** Slett ALDRI den siste kjente gode backupen!

---

## Troubleshooting

### Problem: "pg_dump: command not found"

```bash
# På Mac med Homebrew
brew install postgresql

# På Ubuntu/Debian
sudo apt-get install postgresql-client

# På Windows
# Last ned fra: https://www.postgresql.org/download/windows/
```

### Problem: "connection refused" eller "authentication failed"

```bash
# Sjekk at DATABASE_URL er riktig
echo $DATABASE_URL

# Test connection
psql "$DATABASE_URL" -c "SELECT 1;"

# Hvis det ikke fungerer, prøv via Supabase Dashboard backup
```

### Problem: Backup-filen er tom eller veldig liten

```bash
# Sjekk filstørrelse
ls -lh backup-*.sql

# Hvis < 1KB, prøv på nytt med verbose mode
pg_dump "$DATABASE_URL" --verbose > backup-$(date +%Y%m%d-%H%M%S).sql
```

---

## Spørsmål & Svar

**Q: Hvor lang tid tar backupen?**  
A: 1-5 minutter avhengig av database-størrelse (vanligvis < 2 min)

**Q: Kan jeg ta backup mens appen kjører?**  
A: Ja! Backupen påvirker ikke kjørende applikasjon.

**Q: Hva om backupen feiler?**  
A: Ikke fortsett med endringer! Fiks backup-problemet først.

**Q: Trenger jeg virkelig en backup?**  
A: JA! Dette er omfattende endringer. Uten backup risikerer du å miste alt.

**Q: Kan jeg bruke Supabase's automatiske backups?**  
A: Ja, MEN ta også en manuell backup for ekstra sikkerhet.

---

## Kontakt

Hvis du har problemer med backup, IKKE fortsett med endringer før det er løst!

**Neste steg etter backup:**
1. ✅ Backup fullført og verifisert
2. 📝 Les `docs/TESTING_AND_DEPLOYMENT.md`
3. 🧪 Start lokal testing
4. 🚀 Deploy til staging (hvis mulig)
5. 🎯 Deploy til produksjon (kun når alt er testet)

---

**Status:** 
- [ ] Backup ikke tatt ennå
- [ ] Backup i prosess
- [ ] Backup fullført og verifisert
- [ ] Backup lagret på sikker lokasjon

**Dato backup tatt:** __________________  
**Backup lokasjon:** __________________  
**Testet restore:** Ja / Nei  
**Klar for deployment:** Ja / Nei

