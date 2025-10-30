# Codex Prompt: Skuddsikker Vehicle Compensation Recall

## Problemstilling

Vi har et problem med tilbakekalling (recall) av vehicle compensation entries (servicebil, km_utenfor, tilhenger) fra Tripletex. 

**Nåværende utfordringer:**
1. Linjer kan være opprettet med feil produkt i Tripletex (f.eks. "Km utenfor Oslo/Akershus" med produkt "Servicebil/transport")
2. Ved tilbakekalling søker vi kun på forventet produkt-ID, så vi finner ikke linjer med feil produkt
3. Linjer kan ha fått RevisionException (409) ved sletting og finnes fortsatt i Tripletex
4. Vi trenger å slette ALLE vehicle orderlines for en gitt vakt, uavhengig av hvilket produkt de faktisk har

## System-oversikt

**Database struktur:**
- `vehicle_entries` tabell med kolonner: `id`, `vakt_id`, `vehicle_type` ('servicebil' | 'km_utenfor' | 'tilhenger'), `distance_km`, `tripletex_entry_id`, `sync_status`
- `vehicle_products` tabell som mapper `vehicle_type` → `tripletex_product_id` per `org_id`

**Tripletex API:**
- `GET /project/orderline?projectId={id}&date={date}&productId={id}` - søk etter ordrelinjer
- `DELETE /project/orderline/{id}` - slett ordrelinje
- Beskrivelser i Tripletex: "{Employee Name} - {Vehicle Type Description}" (f.eks. "Kristian API Testuser - Km utenfor Oslo/Akershus (3 km)")

## Nåværende implementering

**Ved tilbakekalling (`delete_timesheet_entry`):**
1. Henter `vakt_id` fra `vakt_timer`
2. Henter alle `vehicle_entries` for `vakt_id`
3. For hver `vehicle_type`:
   - Henter forventet `tripletex_product_id` fra `vehicle_products`
   - Søker i Tripletex: `GET /project/orderline?projectId={id}&date={date}&productId={expected_product_id}`
   - Filtrerer linjer basert på employee-navn og beskrivelse
   - Sletter matching linjer

**Problem:** Hvis en linje er opprettet med feil produkt (f.eks. km_utenfor med servicebil-produkt), finnes den ikke i søket.

## Foreslått løsning

**Endre tilnærming:**
1. Hent `vakt_data` (project_id, date, employee)
2. Hent employee-navn
3. Hent ALLE `vehicle_products` for org (ikke bare forventet produkt)
4. Søk i Tripletex på ALLE vehicle produkter for dette prosjekt/dato
5. For hver vehicle_entry, match på:
   - Employee-navn (må være i beskrivelse)
   - Vehicle type pattern (fleksibel matching på beskrivelse)
6. Slett ALLE matching linjer (uavhengig av produkt)
7. Nullstill alle lokale entries til `pending`

**Fleksibel matching:**
- `servicebil`: Match på "servicebil", "servicebil oslo/akershus", "servicebil/transport", "service bil", "transport"
- `km_utenfor`: Match på "km utenfor", "km utenfor oslo/akershus", "kilometer", "km"
- `tilhenger`: Match på "tilhenger", "trailer"

**Håndtering av 409 RevisionException:**
- 409 ved DELETE betyr linjen finnes fortsatt, men er endret
- Behandle som success (linjen skal slettes, men kan ikke nå)
- Fortsett med å søke etter andre linjer og slette dem

## Krav til løsningen

1. **Skuddsikkerhet:** Fungerer uavhengig av hvor mange ganger entries har blitt sendt/tilbakekalt
2. **Produkt-uavhengig:** Finner linjer selv om de er opprettet med feil produkt
3. **Employee-match:** Kun sletter linjer for riktig ansatt (basert på navn i beskrivelse)
4. **Fleksibel matching:** Håndterer variasjoner i beskrivelser
5. **Robust logging:** Logger alle linjer som finnes, matching-results, og slettede linjer
6. **Performance:** Gjør så få API-kall som mulig (søk på alle produkter en gang, ikke per type)

## Eksempel scenario

**Scenario:**
- Vakt: Kristian API Testuser, 2025-10-28, Prosjekt 209419739
- Vehicle entries: `km_utenfor` (3 km), `tilhenger`
- I Tripletex finnes:
  - Linje med produkt "Servicebil/transport": "Kristian API Testuser - Km utenfor Oslo/Akershus (3 km)" ← Feil produkt!
  - Linje med produkt "Tilhenger": "Kristian API Testuser - Tilhenger"

**Ønsket oppførsel:**
1. Søk på ALLE vehicle produkter (servicebil, km_utenfor, tilhenger) for dette prosjekt/dato
2. Finn begge linjer (selv om km_utenfor har feil produkt)
3. Match på employee-navn + vehicle type pattern
4. Slett begge linjer
5. Nullstill lokale entries til `pending`

## Teknisk kontekst

**Kode-lokasjon:**
- Fil: `supabase/functions/tripletex-api/index.ts`
- Case: `delete_timesheet_entry`
- Funksjon: Deleting vehicle orderlines (linje ~2773-3072)

**Eksisterende kode-struktur:**
- Bruker `callTripletexAPI()` helper-funksjon
- Henter data fra Supabase via `supabase` client
- Logger med `console.log()`
- Håndterer errors med `console.error()`/`console.warn()`

**TypeScript types:**
- `vehicle_type`: `'servicebil' | 'km_utenfor' | 'tilhenger'`
- `sync_status`: `'pending' | 'synced' | 'failed' | 'pending_delete'`

## Spørsmål til Codex

1. Er tilnærmingen med å søke på ALLE vehicle produkter først, deretter matche på beskrivelse, den beste løsningen?
2. Er det risiko ved å matche kun på employee-navn + vehicle type pattern, eller bør vi også sjekke produkt-ID?
3. Hvordan kan vi optimalisere antall API-kall (kan vi søke på flere produkter samtidig)?
4. Hva er beste praksis for å håndtere 409 RevisionException ved DELETE - skal vi prøve flere ganger eller akseptere at linjen er "locked"?
5. Bør vi også søke på ALLE linjer for prosjekt/dato (uten produkt-filter) og deretter filtre, eller er produkt-filter viktig for performance?

## Viktige detaljer

- Tripletex API kan returnere 409 (RevisionException) når linjen er endret av annen prosess
- Beskrivelser kan variere (men følger mønster: "{Name} - {Type}" eller bare "{Type}")
- Det kan være flere ansatte på samme prosjekt/dato med samme vehicle type
- Vi må MATCH på employee-navn for å unngå å slette andres entries
- Employee-navn kan hentes fra `person` tabell eller `ttx_employee_cache`

---

**Dette dokumentet beskriver problemet og løsningsforslag. Vurder tilnærmingen og gi feedback på implementeringsplanen.**




