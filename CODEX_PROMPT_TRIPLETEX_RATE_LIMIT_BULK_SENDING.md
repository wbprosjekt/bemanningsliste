# CODEX PROMPT: Tripletex Rate Limit ved Bulk Sending

## Problem

Vi sender mange timer samtidig til Tripletex API via Edge Function `send_timesheet_entry`, og får masse HTTP 429 (rate limit) feil. Selv med caching og exponential backoff, klarer vi ikke å unngå rate limits når vi sender mange entries parallelt.

## Kontekst

- **Edge Function**: `supabase/functions/tripletex-api/index.ts`
- **Action**: `send_timesheet_entry` 
- **Problemområde**: Bulk sending fra `/admin/timer` sender mange entries parallelt
- **Tripletex Rate Limit**: ~100 requests per minutt

## Nåværende Implementering

### 1. Caching (allerede implementert)
- ✅ Participant cache: `${orgId}-${projectId}-${employeeId}`
- ✅ Entity cache: Employee, Project, Activity checks
- ✅ TTL: 60 sekunder

### 2. Exponential Backoff (allerede implementert)
- ✅ Wrapper rundt `send_timesheet_entry` case
- ✅ Max 3 retries med exponential backoff
- ✅ Re-thrower 429-feil fra `callTripletexAPI`

### 3. Problem: For mange samtidige kall

Når vi sender 20 timer samtidig:
- Frontend kaller Edge Function 20 ganger parallelt
- Hver call gjør:
  - Employee check (cached, men første gang = API-kall)
  - Project check (cached, men første gang = API-kall)
  - Activity check (cached, men første gang = API-kall)
  - Participant check (kan være flere API-kall: `getProjectParticipantIds` → `isEmployeeParticipant` → mulig POST)
  - Activity lookup for overtime (hvis relevant)
  - POST `/timesheet/entry`

**Resultat**: Selv med caching, starter vi 20+ parallele requests samtidig → rate limit nås raskt.

## Feil vi får

1. **HTTP 429** fra Tripletex API
   - `callTripletexAPI` kaster 429-feil
   - `exponentialBackoff` retrier, men alle 20 requests prøver samtidig
   - Etter 3 retries: feil går videre

2. **Edge Function returnerer 500/tom response**
   - Når `exponentialBackoff` kaster etter alle retries, blir feilen ikke fanget
   - Frontend får: `{ success: false }` eller tom response
   - Error: "Edge Function returned a non-2xx status code"

3. **422 Validation Error** (fikset)
   - Vi prøvde å sjekke eksisterende entries med GET `/timesheet/entry?date=...`
   - Tripletex krever `dateFrom` og `dateTo` - vi har fikset dette

## Kode-lokasjoner

### Edge Function Entry Point
```typescript
// supabase/functions/tripletex-api/index.ts
case 'send_timesheet_entry': {
  // ... validation ...
  
  result = await exponentialBackoff(async () => {
    // Employee/Project/Activity checks (cached)
    // ensureParticipant (cached, men kan være flere API-kall)
    // ensureActivityOnProject
    // POST /timesheet/entry
  }, 3);
}
```

### Exponential Backoff
```typescript
// supabase/functions/tripletex-api/index.ts:844
async function exponentialBackoff(fn: () => Promise<unknown>, maxRetries: number = 3): Promise<unknown> {
  // Retries 429/5xx errors with exponential backoff
  // Kaster feil etter maxRetries
}
```

### Frontend Bulk Sending
```typescript
// src/app/admin/timer/page.tsx:sendToTripletex
const activityPromises = entriesToSend.map(async ({ entry, grouped }) => {
  // Kaller Edge Function for hver entry parallelt
  const { data, error } = await supabase.functions.invoke('tripletex-api', {
    action: 'send_timesheet_entry',
    ...
  });
});
await Promise.all(activityPromises); // Alle sendes samtidig!
```

## Spørsmål til CODEX

1. **Hvordan kan vi redusere antall samtidige API-kall?**
   - Bør vi queue/batch entries i Edge Function?
   - Bør frontend rate-limit sendingene (batch size)?
   - Bør vi bruke `export-timesheet` action i stedet (som allerede håndterer flere entries)?

2. **Hvordan håndtere 429-feil bedre?**
   - Bør vi ha en global queue i Edge Function som serializer API-kall?
   - Bør vi bruke `Retry-After` header fra Tripletex?
   - Bør vi ha exponential backoff på frontend-nivå også?

3. **Hvordan fikse Edge Function error handling?**
   - Når `exponentialBackoff` kaster etter alle retries, må vi fange dette
   - Returner riktig error response til frontend
   - Sørg for at `result` alltid er satt

4. **Er det bedre å bruke `export-timesheet` action?**
   - Den håndterer allerede flere entries sekvensielt
   - Men den bruker også `ensureParticipant` per entry (uten global cache mellom entries)

## Målbilde

- ✅ Kunne sende 20-50 timer samtidig uten rate limits
- ✅ Automatisk retry med exponential backoff
- ✅ Bedre feilhåndtering (ikke 500, men informative feilmeldinger)
- ✅ Frontend får tydelige feilmeldinger når rate limit nås

## Filer å se på

1. `supabase/functions/tripletex-api/index.ts`
   - `send_timesheet_entry` case (linje ~1998)
   - `exponentialBackoff` (linje ~844)
   - `ensureParticipant` (linje ~800)
   - `callTripletexAPI` (linje ~457)

2. `src/app/admin/timer/page.tsx`
   - `sendToTripletex` (linje ~949)
   - `sendGroupedToTripletex` (linje ~1116)

3. `supabase/functions/tripletex-api/index.ts`
   - `export-timesheet` case (linje ~1775) - alternativ løsning?

## Eksempel-feil fra logs

```
Error in tripletex-api function: Error: HTTP 429
  at callTripletexAPI
  at exponentialBackoff (attempt 3/3 failed)
  at send_timesheet_entry handler
  
Tripletex API response { status: 429, url: "https://api-test.tripletex.tech/v2/project/209427157?fields=participants" }
Tripletex API response { status: 429, url: "https://api-test.tripletex.tech/v2/activity?project.id=209421384&count=1000&fields=id,name" }
```

## Forventet løsning

Vi trenger en løsning som:
1. Reduserer antall samtidige API-kall dramatisk
2. Håndterer 429-feil graceful (ikke 500)
3. Gir informative feilmeldinger til frontend
4. Fungerer med eksisterende caching og exponential backoff

**Forslag:**
- Queue/batch entries i Edge Function?
- Rate limiting på frontend (batch size + delay)?
- Bedre error handling i Edge Function?
- Bruke `export-timesheet` i stedet?

## Eksempel-kode som trenger fiks

### Problem 1: ExponentialBackoff kaster feil uten catch
```typescript
// supabase/functions/tripletex-api/index.ts:2060
result = await exponentialBackoff(async () => {
  // ... kode som kan kaste 429 ...
}, 3);
// Hvis exponentialBackoff kaster etter 3 retries, blir result ikke satt
// → Edge Function returnerer 500
```

### Problem 2: Frontend sender alle parallelt
```typescript
// src/app/admin/timer/page.tsx:1061
const activityPromises = entriesToSend.map(async ({ entry, grouped }) => {
  return await supabase.functions.invoke('tripletex-api', {
    action: 'send_timesheet_entry',
    ...
  });
});
await Promise.all(activityPromises); // 20+ samtidige kall!
```

### Problem 3: Participant check gjør flere API-kall
```typescript
// supabase/functions/tripletex-api/index.ts:773
async function getProjectParticipantIds(orgId: string, projectId: number) {
  // 1 API-kall: GET /project/{id}?fields=participants
}

async function isEmployeeParticipant(orgId: string, projectId: number, employeeId: number) {
  const ids = await getProjectParticipantIds(...); // 1 kall
  for (const pid of ids) {
    // N API-kall: GET /project/participant/{pid}?fields=employee
    // Kan være 5-10 kall per participant check!
  }
}
```

## Konkrete spørsmål

1. **Bør frontend batch entries?**
   - I stedet for `Promise.all()`, bruke batch size (f.eks. 5 av gangen)?
   - Legge til delay mellom batches?

2. **Bør Edge Function ha en global API call queue?**
   - Serialisere alle Tripletex API-kall gjennom en queue?
   - Respektere `Retry-After` header globalt?

3. **Er `export-timesheet` action bedre?**
   - Den håndterer allerede flere entries sekvensielt
   - Men trenger den også forbedring?

4. **Hvordan fikse error handling?**
   - Try-catch rundt `exponentialBackoff`?
   - Sørge for at `result` alltid er satt?

