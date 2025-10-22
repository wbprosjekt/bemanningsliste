# Tripletex Compliance – Statusrapport

Oppdatert: 21. oktober 2025

## ✅ Ferdigstilte faser

### Fase 1 · Minimal compliance
- Alle Tripletex-kall bruker `fields=` slik at vi bare henter nødvendige felt.
- Basis-checksum (ETag) lagres i `tripletex_sync_state` for employee/project/activity «list»-ressurser.
- `changesSince` aktiveres for alle sync-endepunkt og tidsstempler URL-encodes.
- Bygg/test mot Tripletex sitt testmiljø verifisert (`npx next build`, `npx tsc --noEmit`).

### Fase 2 · Webhook-støtte
- Supabase edge-funksjon `tripletex-webhook` validerer HMAC-signatur (HMAC-SHA256) når `TRIPLETEX_WEBHOOK_SECRET` er satt.
- Next.js-proxy (`/api/webhooks/tripletex`) beholder rå request-body, videresender signatur-header og bruker Service Role key mot edge-funksjonen.
- Webhookregistrering rydder opp gamle abonnement og registrerer employee/project/product/customer events mot proxy-URL.

### Fase 3 · Optimalisering
- Hvis Tripletex svarer med ETag eller `versionDigest`, lagres verdien som både lokal checksum og `tripletex_checksum`.
- `Last-Modified`-header (eller meta-felt) lagres som `tripletex_last_modified` og brukes videre som kilde for `changesSince`.
- Sync-kall for employee/project/activity sender `If-None-Match`, håndterer 304 Not Modified og oppdaterer cache kun ved reelle endringer.
- `tripletex_sync_state` oppdateres med `updated_at` slik at audit og monitorering fungerer.

## 🔍 Videre anbefalinger
- Sett `TRIPLETEX_WEBHOOK_SECRET` i både Supabase og Tripletex-portalen dersom det ikke allerede er gjort (kreves for signaturvalidering).
- Kjør en full end-to-end synk i staging for å bekrefte at Tripletex faktisk returnerer `Last-Modified`/ETag i alle relevante miljø (loggene viser fallback om felt mangler).
- Overvåk første produksjonskjøringer for å verifisere at `changesSince` faktisk reduserer volumet (se `tripletex_sync_state` og sync-log-tabeller).

## Tekniske hovedpunkter
- `supabase/functions/tripletex-api/index.ts`
  - `updateSyncState` støtter nå Tripletex-egne markører (`tripletex_checksum`, `tripletex_last_modified`).
  - Employee-/project-/activity-sync henter headere via `getHeader`, normaliserer tidsstempler og oppdaterer sync state etter hver runde.
  - `getLastSyncTime` bruker `tripletex_last_modified` for `changesSince`, med fallback til `last_synced`.
- `src/app/api/webhooks/tripletex/route.ts`
  - Leser rå body, håndterer JSON-feil og videresender signatur-header(e) og uendret payload til Supabase Edge Function.

Med disse endringene oppfyller integrasjonen Tripletex’ anbefalinger: reduserte kall via `changesSince`, bruk av checksums/ETag, feltfiltrering og sikre webhooks. Neste steg er primært verifikasjon i levende miljø og oppfølging av monitorering.
