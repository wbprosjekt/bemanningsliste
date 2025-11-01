# Prosjektdeltakere - Plan og Wireframe

## Oversikt

Implementere visning og administrasjon av prosjektdeltakere (participants) per prosjekt i prosjektdetaljsiden. Deltakere er ansatte som er knyttet til et prosjekt i Tripletex og kan føre timer på prosjektet.

## Relaterte Endringer på Prosjektdetaljside

Dette arbeidet inngår i en større oppdatering av prosjektdetaljsiden. Se også:
- `docs/prosjekt-timer-kort-plan.md` - Timer-kort i stats overview (vis total timer, link til `/admin/timer`)

**Rekkefølge anbefaling:**
1. **Først: Timer-kort** - Enklere implementering (2.5-4.5 timer), kan gjøres først
2. **Deretter: Prosjektdeltakere** (dette dokumentet) - Mer kompleks funksjonalitet (7-10 timer)

**Sammendrag av endringer på prosjektdetaljsiden:**
- ✅ **Stats Overview:** "Oppgaver"-kort → "Timer"-kort (vis total timer, link til `/admin/timer`)
- 📋 **Mellom Hurtighandlinger og Prosjektinfo:** Nytt "Prosjektdeltakere"-kort (vis, legg til, fjern deltakere)

Begge kan implementeres uavhengig, men gir sammen en mer komplett prosjektopplevelse. Timer-kort kan prioriteres først siden det er enklere og gir rask verdi.

## API Analyse

### Tripletex API Endpoints

✅ **Allerede implementert i systemet:**
- `GET /project/{id}?fields=participants` - Henter alle participant IDs for et prosjekt
- `GET /project/participant/{id}?fields=employee` - Henter employee info for en participant
- `POST /project/participant` - Legger til ny participant
  ```json
  {
    "project": { "id": 123 },
    "employee": { "id": 456 }
  }
  ```

⚠️ **Må sjekkes/testes:**
- `DELETE /project/participant/{id}` - Fjerner participant fra prosjekt
  - **Hypotese:** Finnes sannsynligvis, men må verifiseres i Tripletex API docs

### Eksisterende Funksjonalitet

Systemet har allerede:
- ✅ `getProjectParticipantIds()` - Henter participant IDs
- ✅ `isEmployeeParticipant()` - Sjekker om ansatt er participant
- ✅ `ensureParticipant()` - Legger automatisk til participant når timer sendes
- ✅ Participant caching (60 sek TTL) for å redusere API-kall

## Funksjonelle Krav

### Visning
1. **Liste over prosjektdeltakere**
   - Vis navn (fra `employee` data)
   - Sorter alfabetisk på fornavn
   - Vis loading state mens data hentes
   - Vis feilmelding hvis henting feiler

2. **Legge til deltakere**
   - Dropdown/combobox med søk for å finne ansatte
   - Kun vis ansatte som IKKE allerede er deltakere
   - Validering: Kunne ikke legge til hvis allerede deltaker
   - Loading state under tillegg
   - Feilhåndtering (429 rate limit, 404 employee not found, etc.)

3. **Fjerne deltakere**
   - "Fjern" knapp per deltaker
   - Bekreftelsesdialog for å unngå uhell
   - Loading state under fjerning
   - Feilhåndtering

4. **Synkronisering**
   - "Oppdater fra Tripletex" knapp for å manuelt synkronisere
   - Vis sist synkronisert timestamp
   - Toast meldinger ved suksess/feil

## UI/UX Design

### Plassering på siden

**KRITISK:** Plasseres mellom "Hurtighandlinger" kortet og "Prosjektinfo" kortet på prosjektdetaljsiden (`src/app/prosjekt/[projectId]/page.tsx`).

**Rekkefølge fra topp:**
1. Top Navigation (Favoritt, Innstillinger, + Ny befaring)
2. "Utaggede" kort (hvis relevant)
3. **"Hurtighandlinger" kort** (eksisterende)
4. **"Prosjektdeltakere" kort** (NYTT - skal være her)
5. **"Prosjektinfo" kort** (eksisterende)
6. Stats cards (Befaringer, Oppgaver, Bilder, etc.)

### Wireframe - Prosjektdetaljside

```
┌─────────────────────────────────────────────────────────────┐
│  Top Navigation: [⭐ Favoritt] [⚙️ Innstillinger] [+ Ny befaring] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [Utaggede: 1] (hvis relevant)                               │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  Hurtighandlinger                                            │
│  ──────────────────────────────────────────────────────────  │
│  [+ Ny befaring]                                             │
│  [📅 Ny oppgave]                                              │
│  [🖼️ Last opp bilder]                                          │
│  [📍 Vis på kart]                                             │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  👥 Prosjektdeltakere                          [🔄 Oppdater] │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  Deltakere (4):                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 👤 Anne Sørensen                        [🗑️ Fjern]    │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ 👤 Kari Hansen                          [🗑️ Fjern]    │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ 👤 Ola Nordmann                         [🗑️ Fjern]    │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ 👤 Per Olsen                            [🗑️ Fjern]    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                               │
│  [🔍 Søk etter ansatt...]  [+ Legg til deltaker]             │
│                                                               │
│  [Ingen deltakere] (hvis tomt)                               │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  Prosjektinfo                                                │
│  ──────────────────────────────────────────────────────────  │
│  Prosjektnavn:           1 Aller første prosjekt          │
│  Prosjektnummer:         1                                  │
│  Prosjekt-ID:            209419739                         │
│  Beskrivelse:            ASFpoajfopSAhgpoAehgpo...        │
│                                                               │
│  🏢 Kundeinformasjon                                         │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  [Statistikk kort]  [Befaringer kort]  [Oppgaver kort]      │
│  [Foto-bibliotek kort]  [Aktivitetsfeed]                     │
└─────────────────────────────────────────────────────────────┘
```

**Viktige detaljer:**
- **Kun vis navn** (ikke e-post eller telefonnummer)
- **Sorter alfabetisk på fornavn** (Anne, Kari, Ola, Per)
- Hver deltaker har en "Fjern" knapp (🗑️ ikon)
- Søkefelt og "Legg til deltaker" knapp under listen
- "Oppdater" knapp i header (ikke nødvendig, kan være optional)

### Detaljert Wireframe - "Legg til deltaker" Dropdown/Search

**Alternativ 1: Inline søkeboks (anbefalt)**
```
Prosjektdeltakere kort:
┌─────────────────────────────────────────────────────────────┐
│  [Søkefelt og "Legg til" knapp allerede i kortet]           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 [Søk etter ansatt...]          [+ Legg til]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Dropdown-resultater vises når bruker skriver:]          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👤 Jan Johansen                          [Legg til] │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 👤 Tom Tomassen                          [Legg til] │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 👤 Lisa Larsen                             [Legg til]│   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Alternativ 2: Dialog/modal (hvis inline blir for rotete)**
```
┌─────────────────────────────────────────────────────────────┐
│  Legg til prosjektdeltaker                       [×]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Søk etter ansatt:                                           │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🔍 [Søk etter navn...]                                  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                               │
│  Resultater (3):                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 👤 Jan Johansen                          [Legg til]   │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ 👤 Tom Tomassen                          [Legg til]   │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ 👤 Lisa Larsen                             [Legg til]│ │
│  └───────────────────────────────────────────────────────┘ │
│                                                               │
│  [Avbryt]                                           [Ferdig] │
└─────────────────────────────────────────────────────────────┘
```

### Detaljert Wireframe - "Fjern deltaker" Bekreftelsesdialog

```
┌─────────────────────────────────────────────────────────────┐
│  Bekreft fjerning av deltaker                   [×]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Er du sikker på at du vil fjerne                           │
│  Ola Nordmann fra prosjektet?                                │
│                                                               │
│  ⚠️ Denne handlingen kan ikke angres.                       │
│                                                               │
│  [Avbryt]                               [Fjern deltaker]    │
└─────────────────────────────────────────────────────────────┘
```

## Teknisk Implementering

### 1. Database Schema

**Ingen nye tabeller nødvendig** - All data kommer fra Tripletex API.

**Optional: Cache-tabell (for ytelse)**
```sql
-- Optional: Cache participants for å redusere API-kall
CREATE TABLE IF NOT EXISTS project_participants_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  project_id integer NOT NULL, -- tripletex_project_id
  employee_id integer NOT NULL, -- tripletex_employee_id
  participant_id integer NOT NULL, -- tripletex participant ID
  employee_name text,
  employee_email text,
  employee_phone text,
  synced_at timestamp with time zone DEFAULT now(),
  UNIQUE(org_id, project_id, employee_id)
);
```

**Anbefaling:** Start uten cache-tabell, bruk direkte API-kall med caching i Edge Function (allerede implementert).

### 2. Edge Function Endpoints

**Nye actions i `tripletex-api` Edge Function:**

1. **`get-project-participants`**
   ```typescript
   action: 'get-project-participants'
   params: { projectId: number }
   returns: {
     success: boolean,
     data?: {
       participants: Array<{
         participantId: number,
         employee: {
           id: number,
           firstName: string,
           lastName: string,
           email?: string,
           phoneNumber?: string
         }
       }>
     },
     error?: string
   }
   ```

2. **`add-project-participant`**
   ```typescript
   action: 'add-project-participant'
   params: { projectId: number, employeeId: number }
   returns: {
     success: boolean,
     data?: { participantId: number },
     error?: string
   }
   ```
   - Bruk eksisterende `ensureParticipant()` funksjon
   - Håndter 429 rate limits med exponential backoff

3. **`remove-project-participant`**
   ```typescript
   action: 'remove-project-participant'
   params: { participantId: number }
   returns: {
     success: boolean,
     error?: string
   }
   ```
   - **Må verifiseres:** Finnes DELETE `/project/participant/{id}` i Tripletex?

### 3. Frontend Komponenter

**Ny komponent:** `src/components/prosjekt/ProjectParticipants.tsx`

```typescript
interface ProjectParticipant {
  participantId: number;
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
  };
}

interface ProjectParticipantsProps {
  projectId: string; // UUID fra ttx_project_cache
  tripletexProjectId: number;
  orgId: string;
}
```

**Funksjonalitet:**
- `loadParticipants()` - Henter participants fra API
  - Henter participant IDs fra Tripletex
  - Henter employee info for hver participant
  - Matcher med `ttx_employee_cache` for navn
  - Sorterer alfabetisk på fornavn
- `addParticipant(employeeId)` - Legger til ny participant
  - Validerer at ansatt ikke allerede er deltaker
  - Viser loading state under API-kall
  - Oppdaterer liste etter suksess
- `removeParticipant(participantId)` - Fjerner participant
  - Viser bekreftelsesdialog før fjerning
  - Viser loading state under API-kall
  - Oppdaterer liste etter suksess
- `refreshParticipants()` - Oppdaterer liste fra Tripletex
  - Manuell synkronisering fra Tripletex
- Debounced søk i ansatte-dropdown (300ms debounce)
  - Filtrerer bort ansatte som allerede er deltakere

### 4. Ansatte-søk

**Kilde:** Bruk eksisterende `person` tabell i Supabase (synkronisert fra Tripletex).

**Komponent:** Dropdown/combobox med:
- Søkefelt (navn, e-post)
- Filtrer bort ansatte som allerede er deltakere
- Vis loading state
- Vis "Ingen resultater" hvis ingen ansatte funnet

### 5. Error Handling

**Rate Limits (429):**
- Vis "For mange forespørsler - prøv igjen om X sekunder"
- Disable knapper under cooldown
- Bruk `TripletexRateLimiter` (eksisterende)

**Andre feil:**
- 404: "Ansatt ikke funnet" / "Prosjekt ikke funnet"
- 422: "Kunne ikke legge til deltaker - validering feilet"
- 500: "Tripletex API feil - prøv igjen senere"

**Toast notifications:**
- ✅ "Deltaker lagt til"
- ✅ "Deltaker fjernet"
- ✅ "Liste oppdatert"
- ❌ Feilmeldinger med detaljer

## Implementeringsfasen

### Fase 1: API-endpoints (Backend)
1. ✅ Verifiser DELETE endpoint i Tripletex API docs
2. Implementer `get-project-participants` action
3. Implementer `add-project-participant` action
4. Implementer `remove-project-participant` action (hvis DELETE finnes)
5. Test alle endpoints i Supabase Edge Function

### Fase 2: Frontend-komponent
1. Opprett `ProjectParticipants.tsx` komponent
2. Implementer visning av deltakere
3. Implementer "Legg til" funksjonalitet
4. Implementer "Fjern" funksjonalitet
5. Implementer "Oppdater" funksjonalitet
6. Implementer loading states og error handling

### Fase 3: Integrasjon
1. Legg til komponenten i `prosjekt/[projectId]/page.tsx`
   - **VIKTIG:** Plasser mellom "Hurtighandlinger" kortet og "Prosjektinfo" kortet
   - Sjekk at rekkefølgen er korrekt: Hurtighandlinger → Prosjektdeltakere → Prosjektinfo
2. Test hele flyten (hent, legg til, fjern)
3. Test error scenarios (rate limits, 404, etc.)
4. Test på mobile enheter (responsive design)
5. Verifiser at visning kun viser navn (ikke e-post/telefon)
6. Verifiser at sortering er på fornavn (alfabetisk)

### Fase 4: Forbedringer (Optional)
1. Implementer cache-tabell hvis nødvendig
2. Legg til real-time oppdateringer (Supabase Realtime)
3. Legg til historikk (hvem la til/fjernet deltakere og når)
4. Legg til eksport av deltakerliste (CSV)

## Spørsmål som må besvares

1. ✅ **Finnes DELETE `/project/participant/{id}` i Tripletex API?**
   - Må sjekkes i Tripletex API dokumentasjon
   - Hvis ikke: Kan vi bare "ignore" participants (ikke fjerne, men ikke aktivt bruke)?

2. ✅ **Skal vi cache participants i egen tabell?**
   - **Anbefaling:** Nei, bruk direkte API med caching i Edge Function
   - Edge Function cache er allerede implementert (60 sek TTL)

3. ✅ **Skal deltakere vises andre steder også?**
   - For eksempel i bemanningsliste eller timer-godkjenning?
   - **Anbefaling:** Start med kun prosjektdetaljsiden, utvid senere hvis nødvendig

4. ✅ **Hva skjer hvis en ansatt fjernes fra Tripletex?**
   - Skal deltakeren automatisk fjernes fra prosjekt?
   - **Anbefaling:** Håndter i webhook (`employee.delete`) eller ved neste synkronisering

## Test Plan

### Unit Tests
- Edge Function actions (get, add, remove)
- Error handling (429, 404, 422, 500)
- Caching logic

### Integration Tests
- Hent participants for prosjekt
- Legg til participant
- Fjern participant
- Søk i ansatte-dropdown
- Oppdater liste

### UI Tests
- Responsive design (mobile, tablet, desktop)
- Loading states
- Error messages
- Toast notifications
- Keyboard navigation

## Risiko og Mitigering

### Risiko 1: Tripletex DELETE endpoint finnes ikke
**Mitigering:** Hvis DELETE ikke finnes, kan vi markere participants som "inactive" i stedet for å fjerne. Eller be Tripletex om å legge til DELETE endpoint.

### Risiko 2: For mange API-kall ved refresh
**Mitigering:** Bruk caching (allerede implementert). Debounce "Oppdater" knapp (maks 1 kall per 5 sekunder).

### Risiko 3: Rate limits ved bulk-operasjoner
**Mitigering:** Bruk eksisterende `exponentialBackoff` wrapper. Vis tydelig feilmeldinger med cooldown-timer.

## Estimert Tid

- **Fase 1 (API):** 2-3 timer
- **Fase 2 (Frontend):** 3-4 timer
- **Fase 3 (Integrasjon):** 1 timer
- **Fase 4 (Testing):** 1-2 timer

**Total: 7-10 timer**

## Konklusjon

Dette er en fornuftig og verdi-bringende funksjonalitet som:
- ✅ Gjør det enklere å administrere hvem som kan føre timer på et prosjekt
- ✅ Reduserer behovet for å gå inn i Tripletex for å administrere deltakere
- ✅ Gjør prosjektinformasjonen mer komplett i FieldNote
- ✅ Bruker eksisterende Tripletex API-integrasjon

**Anbefaling:** Implementer i 2 faser:
1. **Fase 1:** Visning og "Legg til" (hvis DELETE ikke finnes)
2. **Fase 2:** "Fjern" funksjonalitet (hvis DELETE finnes i Tripletex)

## Relasjon til Timer-kort plan

Se `docs/prosjekt-timer-kort-plan.md` for relatert funksjonalitet som også legges til på prosjektdetaljsiden. Disse to planene er relatert men uavhengige - kan implementeres i hvilken som helst rekkefølge, men Timer-kort anbefales først siden det er enklere (2.5-4.5 timer vs. 7-10 timer).

