# Refusjon - Historisk Data Plan

## Aktuell Status

**❌ Ingen automatisk henting i dag**
- Har `backfill` API, men ingen cron job
- Test-knappen i settings henter kun for testing
- Ingen automatisk lagring av historiske priser

## Hvor langt tilbake bør vi lagre?

### Scenario 1: Refusjon hjemmelading (anbefalt)
- **1 måned tilbake**: Nok for månedlig refusjon (forrige måned + buffer)
- **3 måneder**: Ekstra buffer for revisjon
- **Anbefaling**: Minst 3 måneder

### Scenario 2: Revisjon (mer robust)
- **12 måneder**: For ekstra revisjon/justering
- Krever mer database-plass

### Anbefaling
**Lagre siste 3 måneder** av spotpriser for alle soner (NO1-NO5)

## Automatisering - To Løsninger

### Løsning A: Edge Function Cron (Anbefalt)
```
Kjør daglig kl. 14:00 (når morgendagens priser er klare):
1. Hent i går (oppdater feilstående timer)
2. Hent i morgen (forecast)
3. Slett data eldre enn 3 måneder
```

**Fordeler:**
- Automatisk
- Alltid oppdatert
- Vercel/Edge Functions kjører 24/7

### Løsning B: Vercel Cron Jobs (Enklere)
Legg til i `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/admin/refusjon/priser/daily-fetch",
    "schedule": "0 14 * * *"
  }]
}
```

## Implementasjon - Anbefalt Struktur

```typescript
// src/app/api/admin/refusjon/priser/daily-fetch/route.ts
export async function GET() {
  // 1. Fetch yesterday and tomorrow for all areas
  // 2. Store in ref_energy_prices
  // 3. Delete old data (>3 months)
  // 4. Return summary
}
```

**Rate Limits:**
- Hva Koster Strømmen: Ingen dokumentert limit
- 200 requests/time burde være mer enn nok

## Hva med nettleie (Elvia TOU)?

**NEI - trenger ikke automatisk henting**
- Nettleie er manuelt konfigurert i TOU-profil
- Elvia-priser endrer seg kun noen ganger i året
- Update manuelt når nødvendig

## Neste Steg

1. Opprett `/api/admin/refusjon/priser/daily-fetch`
2. Legg til Vercel cron i `vercel.json`
3. Test med manuell trigger
4. Monitor første uke

**ESTIMAT:** 2-3 timer

