# Refusjon hjemmelading - Gjenstående arbeid

## ⚠️ PRIORITET 1: Sikkerhet (MÅ FIKSES FØR PRODUKSJON)

### 1. Autentisering i API-ruter (1-2 timer)
**Problem**: Alle API-ruter har auth skrudd av for testing
**Løsning**:
- Opprett `src/lib/auth/serverAuth.ts` helper
- Bruk `cookies()` fra `next/headers` for server-side auth
- Legg til i alle refusjon API-ruter:
  - `/api/admin/refusjon/csv/parse`
  - `/api/admin/refusjon/csv/analyser`
  - `/api/admin/refusjon/csv/generer`
  - `/api/admin/refusjon/priser/fetch-historical`

**Implementering**:
```typescript
// src/lib/auth/serverAuth.ts
import { cookies } from 'next/headers';
import { createClient } from '@/integrations/supabase/server';

export async function requireAuth() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
    
  if (profile?.role !== 'admin') {
    throw new Error('Forbidden');
  }
  
  return { user, profile };
}
```

### 2. RLS policies (30 min)
**Problem**: All RLS disabled for testing
**Løsning**: Re-enable og opprett proper policies
- Run: `supabase/migrations/20250130000008_enable_rls.sql`
- Opprett policies som kun tillater admin-rolle

### 3. Employee settings FK (15 min)
**Problem**: `ref_employee_settings` peker til `profiles` i stedet for `person`
**Løsning**: Run `supabase/migrations/20250130000007_fix_employee_settings_fk.sql`

## 📋 PRIORITET 2: Funksjonalitet

### 4. Test full workflow (30 min)
- [ ] Last opp CSV med oktober-data
- [ ] Verifiser at analyser bruker faktiske priser
- [ ] Sjekk at total refusjon stemmer (ikke 0 kr)
- [ ] Test PDF-generering

### 5. Debug analyser-utdata (1 time)
**Problem**: UI viser 0 kWh/0 kr selv om data er korrekt
**Løsning**: Sjekk response mapping fra API → UI

### 6. PDF-visning og nedlasting (1 time)
- [ ] Vis download-lenker etter generering
- [ ] Test PDF vises riktig
- [ ] Test CSV-eksport

## 🚀 PRIORITET 3: Produksjon

### 7. Automatisk prishenting (2-3 timer)
- [ ] Opprett Vercel Cron job
- [ ] Kjør daglig kl. 14:00
- [ ] Email alert ved feil
- [ ] Slett data >3 måneder

### 8. Strømsone-per-ansatt (30 min)
- [ ] Legg til dropdown i settings
- [ ] Lagre i employee settings
- [ ] Bruk i analyser

### 9. Module access control (1-2 timer)
- [ ] UI for å enable/disable per ansatt
- [ ] Sjekk i employee view
- [ ] Default: disabled

## 📊 STATUS SNAPSHOT:

**✅ Ferdig:**
- Database schema
- CSV parsing
- Elvia TOU-profil
- Spotpris API-integrasjon
- Price storage (2209 priser)
- Settings UI
- Test API

**⚠️ Delvis:**
- RLS (disabled for testing)
- Auth (disabled for testing)
- Analyser (virker men viser 0 i UI)
- PDF-generering (ikke testet)

**❌ Ikke implementert:**
- Automatisk prishenting (cron job)
- PDF-visning/nedlasting
- Module access control
- Strømsone-per-ansatt


