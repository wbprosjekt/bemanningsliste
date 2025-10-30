# Timer Godkjenning - Komplett Forbedringsplan

## Oversikt

Dette dokumentet beskriver alle forbedringer til timer-godkjenningssiden (`/admin/timer`), inkludert UI/UX forbedringer og API-integrasjon med Tripletex. Planen kombinerer gjenbruk av eksisterende logikk fra bemanningsliste med nye funksjoner for bedre brukeropplevelse.

## Nåværende Situasjon

### Funksjonalitet som finnes:
- ✅ Tabell-visning med checkbox-seleksjon
- ✅ Filtrering på status, dato (fra/til), søk
- ✅ Batch-operasjoner: Godkjenn, Send til Tripletex, Eksporter CSV
- ✅ Viser: Ansatt, Dato, Prosjekt, Aktivitet, Type, Timer, Notat, Status, Kilde
- ✅ Bruker `export-timesheet` action for batch-sending

### Hva som mangler:

#### UI/UX Mangler:
1. **Redigering av Timer** ❌ - Ingen mulighet for rask redigering direkte i tabellen
2. **Forbedret Filtrering** ❌ - Mangler hurtigknapper: "Denne måneden", "Forrige måned", "Denne uken"
3. **Kjøretøy-valg Ikke Synlig** ❌ - `vehicle_entries` eksisterer men hentes ikke i query
4. **Aktiviteter Ikke Tydelig Nok** ⚠️ - Mangler ikoner/badges for å skille aktivitetstyper
5. **Ingen Per-linje Tripletex Knapp** ❌ - Må velge checkbox → batch-operasjon
6. **Ingen Inline Redigering** ❌ - Ingen dialog/sheet for rask redigering

#### API/Integrasjon Mangler:
- ❌ Rate limiting checks før sending
- ❌ Retry-After parsing og cooldown håndtering
- ❌ Per-linje sending med cooldown state
- ❌ `TripletexRateLimiter` integrasjon
- ❌ Button disable under cooldown
- ❌ Visuell feedback (countdown, disabled state)

## Best Practice Referanse: Bemanningsliste

Bemanningsliste (`/bemanningsliste`) har allerede implementert best practices som skal gjenbrukes:

- ✅ Bruker `send_timesheet_entry` action (per aktivitet)
- ✅ Bruker `TripletexRateLimiter` for cooldown tracking
- ✅ Sjekker cooldown før sending
- ✅ Disable buttons under cooldown
- ✅ Viser countdown i button text ("Vent 15s")
- ✅ Håndterer Retry-After fra backend
- ✅ Støtter både enkelt-sending og batch
- ✅ Error handling med spesifikke feilmeldinger

## Foreslåtte Løsninger

### 1. UI Forbedringer

#### 1.1 Filtrering - Hurtigknapper
```
┌─────────────────────────────────────────┐
│ [Denne måneden] [Forrige måned] [Dag]   │  ← Nye hurtigknapper
│ Fra dato: [___]  Til dato: [___]       │  ← Eksisterende
│ Status: [Alle]  Søk: [________]          │
└─────────────────────────────────────────┘
```

#### 1.2 Tabell - Utvidet Kolonnevisning
```
┌─────┬────────┬──────┬───────────┬───────────┬──────────┬─────────┬──────────┬─────────┬────────┬──────┐
│ ✓   │ Ansatt │ Dato │ Prosjekt  │ Aktivitet │ Kjøretøy │ Type    │ Timer    │ Notat   │ Status│ Aksjon│
├─────┼────────┼──────┼───────────┼───────────┼──────────┼─────────┼──────────┼─────────┼────────┼──────┤
│ ☐   │ Ola... │ 15/1 │ #123 Navn │ [🔧 Verk] │ [🚗 50km]│ Normal  │ 8.00     │ Notat...│ 🟢    │ [✏️]│
│     │        │      │           │           │          │         │          │         │ Godkj.│ [📤]│
└─────┴────────┴──────┴───────────┴───────────┴──────────┴─────────┴──────────┴─────────┴────────┴──────┘
```

**Nye kolonner:**
- **Kjøretøy**: Badge/ikon visning (🚗 Servicebil 50km, 🛣️ Km utenfor 30km, 🚛 Tilhenger)
- **Aktivitet**: Bedre visning med ikon/badge
- **Aksjon-kolonnen utvidet**: Rediger (✏️) + Send Tripletex (📤) per linje

#### 1.3 Redigeringsdialog
- Åpnes ved klikk på ✏️ eller dobbeltklikk på rad
- Sheet/Dialog med:
  - Timer (time/minutter input)
  - Prosjekt (dropdown)
  - Aktivitet (dropdown)
  - Notat (textarea)
  - Kjøretøy-valg (checkboxes: Servicebil, Km utenfor, Tilhenger)
  - Distance input (hvis relevant)
  - Lagre / Avbryt

### 2. API Strategi - Gjenbruk fra Bemanningsliste

#### 2.1 Backend (Allerede Riktig)

Backend (`supabase/functions/tripletex-api/index.ts`) er allerede implementert riktig:

**Eksisterende Funksjoner (Kan Gjenbrukes):**
- ✅ `callTripletexAPI()` - Allerede håndterer Retry-After parsing
- ✅ `exponentialBackoff()` - Allerede implementert med retry logic
- ✅ `send_timesheet_entry` action - Allerede støtter per-entry sending
- ✅ `export-timesheet` action - Allerede støtter batch sending

**Hva Backend Gjør Riktig:**
- Parser Retry-After header automatisk
- Returnerer retryInfo i response
- Exponential backoff håndterer 429/5xx
- Sjekker om entry allerede er sendt
- Lagrer original values før sending
- Oppdaterer vakt_timer med tripletex_entry_id

#### 2.2 Frontend - TripletexRateLimiter

```typescript
// src/lib/tripletexRateLimiter.ts
// ✅ Allerede implementert med:
// - setLimit(key, retryAfterSeconds)
// - isLimited(key) 
// - getCountdown(key)
// - clearAll() (for testing)
```

**Key-strategi:**
- Bemanningsliste: `tripletex_send_{orgId}` (shared cooldown)
- Timer-godkjenning: **SAMME KEY** → `tripletex_send_{orgId}`

**Hvorfor samme key?**
- Tripletex rate limiting er per org, ikke per side
- Deler cooldown state mellom bemanningsliste og timer-godkjenning
- Forhindrer spam når bruker sender fra begge steder

#### 2.3 Per-linje Sending Pattern

```typescript
// Adaptasjonsforslag for Timer-godkjenning:
const sendSingleTimerToTripletex = async (entry: TimerEntry) => {
  // 1. Valideringer (status, project, employee, activity)
  // 2. Check cooldown: TripletexRateLimiter.isLimited(key)
  // 3. Set per-entry loading state
  // 4. Send via send_timesheet_entry (SAMME som bemanningsliste)
  // 5. Parse retryInfo fra response
  // 6. Set cooldown: TripletexRateLimiter.setLimit(key, retryAfter)
  // 7. Update local state + refresh
  // 8. Show toast
};
```

#### 2.4 Batch Sending Forbedring

```typescript
const sendBatchToTripletex = async () => {
  // 1. Check cooldown: TripletexRateLimiter.isLimited(key)
  // 2. Hvis limited: Vis toast + return
  // 3. Send via eksisterende export-timesheet flow
  // 4. Parse retryInfo fra første feilede entry (hvis noen)
  // 5. Set cooldown: TripletexRateLimiter.setLimit(key, retryAfter)
  // 6. Show results
};
```

#### 2.5 UI - Button States

```tsx
// Per-linje knapp i tabell:
const isLimited = TripletexRateLimiter.isLimited(`tripletex_send_${orgId}`);
const countdown = TripletexRateLimiter.getCountdown(`tripletex_send_${orgId}`);

<Button
  size="sm"
  variant="outline"
  disabled={isLimited || sendingStates.has(entry.id)}
  onClick={() => sendSingleTimerToTripletex(entry)}
>
  {isLimited ? `Vent ${countdown}s` : '📤 Send'}
</Button>

// Batch knapp (hovedknapp):
<Button
  disabled={isLimited || actionLoading.export}
  onClick={sendBatchToTripletex}
>
  {isLimited 
    ? `Vent ${countdown}s` 
    : actionLoading.export 
      ? 'Sender...' 
      : 'Send til Tripletex'
  }
</Button>
```

## Wireframes

### Topp-seksjon (Filtre)
```
┌──────────────────────────────────────────────────────────────────┐
│ Timer - Godkjenning                                              │
│ WB Prosjekt AS - Administrer og godkjenn timelister   [Oppdater] │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Filtre og søk                                                 │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ [Denne måneden] [Forrige måned] [Denne uken] [Dag]           │ │
│ │                                                              │ │
│ │ Fra dato: [2025-01-01]  Til dato: [2025-01-31]              │ │
│ │ Status: [Alle statuser ▼]  Søk: [________]                  │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Batch-operasjoner (Når valgt)
```
┌──────────────────────────────────────────────────────────────────┐
│ ✓ 12 av 64 timer valgt                                           │
│ [✓ Dry-run] [Merk godkjent] [Send til Tripletex] [Eksport CSV] │
└──────────────────────────────────────────────────────────────────┘
```

### Tabell (Utvidet)
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ✓ │ Ansatt │ Dato  │ Prosjekt      │ Aktivitet    │ Kjøretøy    │ Type  │ Timer │ Notat      │ Status │ Aksjon   │
├───┼────────┼───────┼───────────────┼──────────────┼─────────────┼───────┼───────┼────────────┼────────┼──────────┤
│ ☐ │ Ola N. │ 15/1  │ #123 Prosjekt │ 🔧 Verktøy   │ 🚗 50km     │ Normal│ 8.00  │ Merknad... │ 🟢     │ ✏️ [📤]  │
│ ☐ │ Kari P.│ 16/1  │ #456 Bygg     │ 🏗️ Arbeid    │ ─           │ Normal│ 7.50  │ ─          │ 🟠 Klar│ ✏️ [📤]  │
│ ☐ │ Per L. │ 16/1  │ #789 Riving   │ 🚧 Riving    │ 🛣️ 30km     │ Overtid│ 9.00 │ ─          │ 📝 Kladd│ ✏️ [📤]  │
└───┴────────┴───────┴───────────────┴──────────────┴─────────────┴───────┴───────┴────────────┴────────┴──────────┘
```

### Redigeringsdialog (Sheet)
```
┌──────────────────────────────────────────────────────────────┐
│ Rediger timer                                [X]              │
├──────────────────────────────────────────────────────────────┤
│ Ansatt: Ola Nordmann                                         │
│ Dato: 15. januar 2025                                        │
│                                                              │
│ Timer:    [8] t  [0] m                                       │
│           [1t] [7.5t] [8t] ← Hurtigvalg                      │
│                                                              │
│ Prosjekt: [▼ #123 - Prosjektnavn]                           │
│ Aktivitet: [▼ 🔧 Verktøy]                                   │
│                                                              │
│ Notat: [_____________________________________]               │
│        [_____________________________________]               │
│                                                              │
│ Kjøretøy:                                                    │
│ ☑ Servicebil  [Distance: 50] km                              │
│ ☐ Km utenfor  [Distance: __] km                              │
│ ☑ Tilhenger                                                  │
│                                                              │
│        [Avbryt]  [Lagre endringer]                          │
└──────────────────────────────────────────────────────────────┘
```

## Database-endringer

**Query må utvides:**
```sql
-- I dag: Kun vakt_timer med relasjoner
-- Må også: Hente vehicle_entries basert på vakt_id

SELECT 
  vt.*,
  v.dato,
  p.fornavn, p.etternavn,
  proj.project_name, proj.project_number,
  act.navn as aktivitet_navn,
  -- NYTT: Vehicle entries
  ve.vehicle_type,
  ve.distance_km,
  ve.tripletex_entry_id as vehicle_tripletex_id
FROM vakt_timer vt
LEFT JOIN vakt v ON vt.vakt_id = v.id
LEFT JOIN person p ON v.person_id = p.id
LEFT JOIN ttx_project_cache proj ON v.project_id = proj.id
LEFT JOIN ttx_activity_cache act ON vt.aktivitet_id = act.id
-- NY JOIN:
LEFT JOIN vehicle_entries ve ON v.id = ve.vakt_id
WHERE vt.org_id = ? AND ...
```

**Merk:** En `vakt` kan ha flere `vehicle_entries` (f.eks. servicebil + tilhenger), så vi må håndtere:
- Enten: Group by og vis alle som en kommaseparert liste
- Eller: Separate rader (én per vehicle_entry kombinasjon)

**Foreslått løsning:** JSON aggregation for å beholde én rad per `vakt_timer`:
```sql
SELECT ...,
  COALESCE(json_agg(DISTINCT jsonb_build_object(
    'type', ve.vehicle_type,
    'distance_km', ve.distance_km,
    'tripletex_entry_id', ve.tripletex_entry_id
  )) FILTER (WHERE ve.id IS NOT NULL), '[]'::json) as vehicles
FROM vakt_timer vt
...
GROUP BY vt.id, v.id, p.id, proj.id, act.id
```

## Implementasjonsplan

### Fase 1: Database & Query
1. ✅ Utvid `loadTimerEntries` query til å inkludere `vehicle_entries`
2. ✅ Håndter multiple vehicle entries per vakt (JSON aggregation)
3. ✅ Oppdater `TimerEntry` interface med `vehicles` array

### Fase 2: Filtrering
1. ✅ Legg til hurtigknapper: "Denne måneden", "Forrige måned", "Denne uken", "Dag"
2. ✅ Auto-fyll datoer når knapper klikkes
3. ✅ Implementer `setPeriodFilter()` funksjon

### Fase 3: API Integrasjon - TripletexRateLimiter
1. ✅ Import `TripletexRateLimiter` i timer-godkjenning page
2. ✅ Definer key: `const rateLimitKey = \`tripletex_send_${orgId}\`;`
3. ✅ Sjekk cooldown før ALLE sending-operasjoner
4. ✅ Vis toast hvis cooldown aktiv

### Fase 4: Tabell Forbedringer
1. ✅ Legg til "Kjøretøy"-kolonne med badge-visning
2. ✅ Forbedre "Aktivitet"-kolonne med ikoner/badges
3. ✅ Legg til "Aksjon"-kolonne med ✏️ og 📤 knapper

### Fase 5: Per-linje Tripletex Sending
1. ✅ Lag `sendSingleTimerToTripletex(entry)` funksjon
2. ✅ Bruk `send_timesheet_entry` action (SAMME som bemanningsliste)
3. ✅ Parse retryInfo fra response
4. ✅ Sett cooldown: `TripletexRateLimiter.setLimit(key, retryAfter)`
5. ✅ Legg til loading state per rad
6. ✅ Legg til 📤 knapp i tabell (per rad) med cooldown state

### Fase 6: Batch Sending Forbedring
1. ✅ Legg til cooldown check i eksisterende `sendToTripletex()`
2. ✅ Parse retryInfo fra batch response
3. ✅ Sett cooldown etter batch sending
4. ✅ Forbedre error handling med cooldown messages
5. ✅ Disable batch-knapp under cooldown med countdown

### Fase 7: Redigeringsdialog
1. ✅ Lag `EditTimerSheet` komponent (lik `TimeEntrySheet`)
2. ✅ Åpne ved ✏️-knapp eller dobbeltklikk
3. ✅ Støtt redigering av: timer, prosjekt, aktivitet, notat, kjøretøy
4. ✅ Integrer med eksisterende vehicle entries logikk

### Fase 8: UI States & Loading
1. ✅ Disable per-linje knapper under cooldown
2. ✅ Vis countdown: `"Vent {countdown}s"`
3. ✅ Loading states per rad (spinner/disabled)
4. ✅ Loading state for batch-operasjoner

### Fase 9: Error Handling
1. ✅ Gjenbruk samme error messages som bemanningsliste
2. ✅ Håndter spesifikke feiltyper (period_locked, employee_not_participant, etc.)
3. ✅ Vis cooldown i error toast hvis relevant

## Tekniske Detaljer

### Vehicle Entries Grouping
```typescript
// Interface oppdatering:
interface TimerEntry {
  // ... existing fields
  vehicles: Array<{
    type: 'servicebil' | 'km_utenfor' | 'tilhenger';
    distance_km: number;
    tripletex_entry_id?: number;
  }>;
}

// I query, bruk JSON aggregation:
SELECT ...,
  COALESCE(json_agg(DISTINCT jsonb_build_object(
    'type', ve.vehicle_type,
    'distance_km', ve.distance_km,
    'tripletex_entry_id', ve.tripletex_entry_id
  )) FILTER (WHERE ve.id IS NOT NULL), '[]'::json) as vehicles
FROM vakt_timer vt
...
GROUP BY vt.id, ...
```

### Tripletex Rate Limiting
- Gjenbruk samme `TripletexRateLimiter` fra bemanningsliste
- Disable knapper under cooldown
- Vis countdown per rad når sending pågår
- Samme key-strategi: `tripletex_send_{orgId}` (delt cooldown)

### Hurtigknapper Logikk
```typescript
const setPeriodFilter = (period: 'today' | 'week' | 'month' | 'lastMonth') => {
  const today = new Date();
  let from: Date, to: Date;
  
  switch(period) {
    case 'today':
      from = to = today;
      break;
    case 'week':
      from = startOfWeek(today);
      to = endOfWeek(today);
      break;
    case 'month':
      from = startOfMonth(today);
      to = endOfMonth(today);
      break;
    case 'lastMonth':
      from = startOfMonth(addMonths(today, -1));
      to = endOfMonth(addMonths(today, -1));
      break;
  }
  
  setFilters({
    ...filters,
    dateFrom: toLocalDateString(from),
    dateTo: toLocalDateString(to)
  });
};
```

### Response Parsing (Fra Backend)
```typescript
// Backend returnerer allerede:
{
  success: boolean,
  error?: string,
  retryInfo?: {
    retryAfter: number, // seconds
    retryAfterDate: string // ISO date
  }
}

// Frontend må parse:
const { data, error } = await supabase.functions.invoke('tripletex-api', {...});
if (data?.retryInfo?.retryAfter) {
  TripletexRateLimiter.setLimit(key, data.retryInfo.retryAfter);
}
```

### State Management
```typescript
// Per-entry loading:
const [sendingStates, setSendingStates] = useState<Set<string>>(new Set());

// Per-entry update:
setSendingStates(prev => new Set(prev).add(entry.id));
// ... send ...
setSendingStates(prev => {
  const next = new Set(prev);
  next.delete(entry.id);
  return next;
});
```

## Konsistens-Sjekkliste

### Backend (tripletex-api):
- ✅ `callTripletexAPI()` - Parser Retry-After ✅
- ✅ `exponentialBackoff()` - Håndterer 429/5xx ✅
- ✅ `send_timesheet_entry` - Støtter per-entry ✅
- ✅ `export-timesheet` - Støtter batch ✅
- ✅ Error responses - Konsistent format ✅

### Frontend:
- ✅ `TripletexRateLimiter` - Eksisterer og er klar ✅
- ❌ **Mangler**: Import og bruk av RateLimiter
- ❌ **Mangler**: Cooldown checks
- ❌ **Mangler**: Button disable states
- ❌ **Mangler**: Per-linje sending funksjon
- ❌ **Mangler**: Countdown visning
- ❌ **Mangler**: Vehicle entries i query
- ❌ **Mangler**: Redigeringsdialog
- ❌ **Mangler**: Hurtigknapper filtrering

## Fordeler med Denne Strategien

1. **100% Konsistens**: Samme logikk, samme cooldown, samme UX som bemanningsliste
2. **Kun Frontend-endringer**: Backend allerede riktig
3. **Rask Implementering**: Gjenbruker eksisterende kode
4. **Mindre Bugs**: Prøvd og testet logikk
5. **Enklere Vedlikehold**: Én kilde til sannhet
6. **Bedre UX**: Raskere redigering, bedre filtrering, tydeligere visning

## Prioritering

### Høy Prioritet:
1. **Redigering** - Kritiskt for effektivitet
2. **Hurtigknapper filtrering** - Mange forespørsler om dette
3. **Kjøretøy-visning** - Viktig informasjon som mangler
4. **TripletexRateLimiter integrasjon** - Forhindrer API-feil

### Medium Prioritet:
1. **Per-linje Tripletex** - Forbedrer brukeropplevelse
2. **Forbedret aktivitet-visning** - Bedre oversikt
3. **Cooldown UI states** - Forhindrer brukerfeil

### Lav Prioritet:
1. **Batch-forbedringer** - Fungerer allerede, men kan optimaliseres

## Neste Steg

1. ✅ Review denne komplett planen
2. ⏳ Implementer i faser (1-9) når godkjent
3. ⏳ Test sammen med bemanningsliste (delt cooldown)
4. ⏳ Dokumenter endringer i kode
5. ⏳ Test i staging før produksjon

