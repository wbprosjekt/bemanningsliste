# 🔑 Supabase Keys - Super-Enkel Guide

**For folk som ikke er eksperter på Supabase!**

---

## 🤔 Hva Er Supabase Keys Egentlig?

**Enkel forklaring:**
Supabase keys er som "passord" eller "nøkler" som gir tilgang til forskjellige deler av databasen din.

**Analogi:**
Tenk på Supabase som et hus:
- **Anon Key** = Nøkkel til inngangsdøren (alle besøkende får denne)
- **Service Role Key** = Mester-nøkkel som åpner alle dører (kun eiere har denne)
- **Database Password** = Passord til safe'en i huset

---

## 📋 De 3 Viktigste Keys

### 1. **Anon Key** (Public Key)

**Hva er det:**
- En nøkkel som alle brukere av appen din får
- Den er "public" = OK å dele med frontend-kode
- Har begrenset tilgang (kun det RLS policies tillater)

**Hvor finnes den:**
1. Gå til https://supabase.com/dashboard
2. Velg ditt prosjekt
3. Klikk **Settings** (⚙️ helt nederst i venstremenyen)
4. Velg **API**
5. Under "Project API keys" → se **"anon" / "public"**

**Hvordan ser den ut:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsb...
```
(Lang tekst som starter med `eyJ`)

**Når bruker du den:**
- I frontend-kode (Next.js, React)
- I `.env.local` filen som `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Trygg å dele:**
- ✅ Ja, denne er "public" (men ikke del den unødvendig)

---

### 2. **Service Role Key** (Secret Key)

**Hva er det:**
- En "super-admin" nøkkel
- Har FULL tilgang til alt i databasen
- Hopper over RLS policies (Row Level Security)
- **MYE farligere** enn Anon Key

**Hvor finnes den:**
1. Gå til https://supabase.com/dashboard
2. Velg ditt prosjekt
3. Klikk **Settings** (⚙️)
4. Velg **API**
5. Under "Project API keys" → se **"service_role"**
6. **Klikk på øye-ikonet** for å vise den (den er skjult som standard)

**Hvordan ser den ut:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsb...
```
(Også lang tekst som starter med `eyJ`, men FORSKJELLIG fra Anon Key)

**Når bruker du den:**
- I Edge Functions (backend-kode)
- I cron jobs
- I admin-scripts
- **ALDRI i frontend!**

**Trygg å dele:**
- ❌ **NEI! Hold denne hemmelig!**
- Som å dele PIN-koden til bankkontoen din
- Aldri commit til git
- Aldri del i chat/email

---

### 3. **Database Password**

**Hva er det:**
- Passordet for å koble direkte til PostgreSQL-databasen
- Trengs for å ta backup med `pg_dump`
- Trengs for å kjøre SQL-kommandoer fra terminalen

**Hvor finnes den:**
1. Gå til https://supabase.com/dashboard
2. Velg ditt prosjekt
3. Klikk **Settings** (⚙️)
4. Velg **Database**
5. Scroll ned til **"Database password"**
6. **Klikk "Reset database password"** hvis du ikke har den

**Hvordan ser den ut:**
```
SuperSecret123Password
```
(Vanlig passord-format, ikke en lang JWT-token)

**Connection String:**
Sammen med passordet får du en "Connection String" som ser slik ut:
```
postgresql://postgres.jlndohflirfixbinqdwe:[DITT-PASSORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

**Når bruker du den:**
- Når du tar database backup
- Når du kjører migrasjoner fra terminalen
- Når du bruker `psql` kommandoen

**Trygg å dele:**
- ❌ **NEI! Hold hemmelig!**

---

## 🎯 Praktisk: Hvor Finner Jeg Alt?

### Metode 1: Via Dashboard (Enklest!)

```
1. Gå til: https://supabase.com/dashboard
2. Logg inn
3. Velg prosjekt: "bemanningsliste" (eller hva det heter)
4. Settings (⚙️) → API
   - Her finner du: Anon Key og Service Role Key
5. Settings (⚙️) → Database  
   - Her finner du: Database Password og Connection String
```

### Metode 2: Via Supabase CLI

```bash
# Fra terminalen i prosjektmappen:
supabase status

# Dette viser (for LOKAL database):
# - API URL
# - DB URL
# - Anon key
# - Service Role key
```

**⚠️ MERK:** `supabase status` viser LOKAL database, ikke produksjon!

---

## 📝 Hvor Skal Du Bruke Keys?

### For Lokal Utvikling (`.env.local`)

```env
# .env.local (i prosjekt-root)
NEXT_PUBLIC_SUPABASE_URL=https://jlndohflirfixbinqdwe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...din-anon-key...
```

**⚠️ Service Role Key skal IKKE være her!**

### For Edge Functions (Supabase Environment)

Edge Functions får automatisk tilgang til keys via:
```typescript
Deno.env.get('SUPABASE_URL')
Deno.env.get('SUPABASE_ANON_KEY')
Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
```

**Du trenger ikke sette disse manuelt!** Supabase gjør det automatisk.

### For Database Secrets (Nye Ting Vi Lager)

Dette er **ikke** standard Supabase keys, men **egne secrets** vi lager:

```sql
-- Kjør i Supabase SQL Editor:
ALTER DATABASE postgres SET app.encryption_key = 'din-random-key';
ALTER DATABASE postgres SET app.service_role_key = 'kopier-fra-settings';
ALTER DATABASE postgres SET app.email_reminders_secret = 'random-secret';
ALTER DATABASE postgres SET app.nightly_sync_secret = 'random-secret';
```

---

## 🔐 Hvordan Generere Random Keys?

For de nye secrets vi trenger:

### På Mac/Linux (Terminal):

```bash
# Generer encryption key (32 bytes)
openssl rand -base64 32

# Generer trigger secrets (24 bytes)
openssl rand -base64 24
```

### På Windows (PowerShell):

```powershell
# Generer random key
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### Online (Hvis du ikke har openssl):

Gå til: https://generate-random.org/api-key-generator
- Length: 32 characters
- Format: Base64
- Klikk "Generate"

---

## 📊 Oppsummering: Hvilke Keys Trenger Du?

| Key | Hvor finnes | Når trenger du den | Trygt å dele? |
|-----|-------------|-------------------|---------------|
| **Anon Key** | Settings → API | Frontend-kode, `.env.local` | ✅ OK (public) |
| **Service Role Key** | Settings → API (skjult) | Edge Functions, cron jobs | ❌ NEI! Hemmelig |
| **Database Password** | Settings → Database | Backup, migrations | ❌ NEI! Hemmelig |
| **Encryption Key** | Du lager selv | For å kryptere tokens | ❌ NEI! Hemmelig |
| **Trigger Secrets** | Du lager selv | Cron job sikkerhet | ❌ NEI! Hemmelig |

---

## 🎯 For Vårt Security Deployment

**Det vi trenger å gjøre:**

### Steg 1: Hent Eksisterende Keys

```
1. Service Role Key:
   - Dashboard → Settings → API → service_role (klikk øye-ikon)
   - Kopier hele teksten
   - Lagre i password manager

2. Database Password:
   - Dashboard → Settings → Database
   - Se "Database password" eller reset hvis du ikke har den
   - Lagre i password manager
```

### Steg 2: Generer Nye Keys

```bash
# I terminalen:
# 1. Encryption key
openssl rand -base64 32
# Kopier resultatet

# 2. Email reminders secret
openssl rand -base64 24
# Kopier resultatet

# 3. Nightly sync secret  
openssl rand -base64 24
# Kopier resultatet
```

### Steg 3: Lagre Alt Trygt

**I 1Password (eller lignende):**

```
Title: Bemanningsliste Supabase Keys

Service Role Key: eyJ... [den lange teksten]
Database Password: [ditt passord]
Encryption Key: [fra openssl rand]
Email Reminders Secret: [fra openssl rand]
Nightly Sync Secret: [fra openssl rand]

Date: [dagens dato]
```

---

## ❓ Vanlige Spørsmål

### Q: Hva om jeg mister en key?

**A: Anon Key og Service Role Key:**
- Kan ikke "mistes" - de finnes alltid i Dashboard
- Men hvis de kommer på avveie, kan du regenerere dem
- Dashboard → Settings → API → "Reset" knapp

**A: Database Password:**
- Kan resettes i Dashboard → Settings → Database
- Trykk "Reset database password"

**A: Egne secrets (encryption, trigger):**
- Hvis du mister disse, må du generere nye
- Og oppdatere databasen med nye verdier

### Q: Kan jeg bruke samme key flere steder?

**A: Nei!**
- Anon Key = Frontend
- Service Role Key = Backend/Edge Functions  
- Database Password = Database connections
- Hver har sin rolle!

### Q: Hva om jeg committet en key til git ved uhell?

**A: STANS!**
1. Regenerer key'en ØYEBLIKKELIG i Dashboard
2. Oppdater alle steder den brukes
3. Aldri commit secrets til git igjen

### Q: Hvorfor trenger vi så mange keys?

**A: Sikkerhet!**
- Forskjellige keys for forskjellige formål
- Hvis en key blir kompromittert, påvirker det ikke alt
- "Least privilege" - hver key har kun den tilgangen den trenger

---

## 🚀 Neste Steg for Deg

**Nå som du vet hva keys er:**

1. ✅ Gå til Supabase Dashboard
2. ✅ Finn Service Role Key (Settings → API)
3. ✅ Generer 3 nye random keys (med `openssl`)
4. ✅ Lagre ALT i password manager
5. ✅ Fortell meg når du er klar - da setter vi dem opp i Supabase!

**Du trenger:**
- [ ] Service Role Key (fra Dashboard)
- [ ] Encryption Key (generer med openssl)
- [ ] Email Reminders Secret (generer med openssl)
- [ ] Nightly Sync Secret (generer med openssl)

---

## 💬 Trenger Du Hjelp?

**Si fra hvis:**
- Du ikke finner en key i Dashboard
- Du får feilmelding når du genererer keys
- Du er usikker på hva du skal gjøre
- Noe er uklart

**Vi tar det steg for steg!** 🐢

---

**TL;DR (Too Long, Didn't Read):**

1. **Anon Key** = Frontend-nøkkel (trygg å bruke)
2. **Service Role Key** = Backend-nøkkel (hemmelig!)
3. **Database Password** = For direktetilgang til database
4. **Finn dem i:** Dashboard → Settings → API / Database
5. **Lagre trygt i** 1Password eller lignende

**Klar til neste steg?** 🚀

