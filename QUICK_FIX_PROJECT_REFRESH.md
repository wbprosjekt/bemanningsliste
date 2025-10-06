# Quick Fix: Project Refresh Button

## Problem
Du fikk feilmeldingen:
```
POST https://jlndohflirfixbinqdwe.supabase.co/functions/v1/tripletex-api 400 (Bad Request)
Error: Missing action or orgId parameter
```

## Årsak
Mine endringer ble revertet (sannsynligvis ved git reset/checkout).

## Løsning
Bruk den eksisterende sync-knappen på admin-siden isteden:

### Midlertidig løsning (inntil vi implementerer på nytt):
1. Gå til `/admin/integrasjoner/tripletex`
2. Klikk "Synk prosjekter" knappen
3. Gå tilbake til bemanningsliste
4. Søk etter prosjektet igjen

### Permanent løsning (må implementeres):
Jeg må legge til refresh-funksjonalitet i ProjectSelector igjen, men denne gangen:
- Riktig parameter: `orgId` (ikke `org_id`)
- Riktig URL: Bruke `process.env.NEXT_PUBLIC_SUPABASE_URL`
- Riktig headers: Authorization + apikey

## Status
- ❌ Refresh-knapp i ProjectSelector - IKKE implementert (ble revertet)
- ✅ Sync-knapp i admin-siden - FUNGERER
- ⏸️ Webhook-kode - SLETTET (som planlagt)

## Neste steg
Vil du at jeg implementerer refresh-knappen på nytt?
Eller er det OK å bruke admin-siden for nå?

