# Prosjekt Timer Kort - Plan

## Oversikt

Endre "Oppgaver"-kortet (grønt kalenderikon) til et "Timer"-kort som viser totalt antall timer ført på prosjektet, med link til `/admin/timer` filtrert på dette prosjektet.

## Relaterte Endringer på Prosjektdetaljside

Dette arbeidet inngår i en større oppdatering av prosjektdetaljsiden. Se også:
- `docs/prosjektdeltakere-plan.md` - Prosjektdeltakere kort (CRUD funksjonalitet for deltakere)

**Rekkefølge anbefaling:**
1. **Først: Timer-kort** (dette dokumentet) - Enklere implementering (2.5-4.5 timer)
2. **Deretter: Prosjektdeltakere** - Mer kompleks funksjonalitet (7-10 timer)

**Sammendrag av endringer på prosjektdetaljsiden:**
- ✅ **Stats Overview:** "Oppgaver"-kort → "Timer"-kort (vis total timer, link til `/admin/timer`)
- 📋 **Mellom Hurtighandlinger og Prosjektinfo:** Nytt "Prosjektdeltakere"-kort (vis, legg til, fjern deltakere)

Begge kan implementeres uavhengig, men gir sammen en mer komplett prosjektopplevelse.

## Gjeldende Situasjon

**Nåværende kort:**
- Tittel: "Oppgaver"
- Ikon: Grønt kalenderikon (`Calendar`)
- Viser: `stats.total_oppgaver` (antall oppgaver)
- Plassering: Stats Overview (andre kort i rekken)

**Ønsket endring:**
- Tittel: "Timer"
- Ikon: Timer/Clock ikon (blå eller oransje)
- Viser: Total antall timer (f.eks. "145 timer" eller "145 t")
- Klikkbar: Linker til `/admin/timer?projectId=X` med prosjekt-filter aktivt

## Teknisk Analyse

### Data-kilde for timer

**Timer-data ligger i:**
- Tabell: `vakt_timer`
- Relasjon: `vakt` → `project_id` → `ttx_project_cache.id`
- Match: `ttx_project_cache.tripletex_project_id` = prosjektets `tripletex_project_id`

**Eksisterende query-struktur:**
```typescript
// Fra admin/timer/page.tsx
vakt:vakt_id (
  ttx_project_cache:project_id (
    id,
    tripletex_project_id,
    project_name,
    project_number
  )
)
```

### `/admin/timer` Filter-struktur

**Nåværende filtre:**
- ✅ Dato-filter (`dateFrom`, `dateTo`)
- ✅ Status-filter (`status`: all, godkjent, sendt, klar, utkast)
- ❌ **Ingen prosjekt-filter i URL eller query**

**Nødvendig endring:**
- Legg til query parameter `?projectId=X` i URL
- Parse query parameter i `/admin/timer/page.tsx`
- Legg til filter i `loadTimerEntries()` query basert på `tripletex_project_id`

## Løsningsforslag

### Alternativ 1: Link til `/admin/timer` med prosjekt-filter (ANBEFALT)

**Fordeler:**
- ✅ Gjenbruker eksisterende timer-godkjenning UI
- ✅ Konsistent opplevelse (samme side som admin bruker ellers)
- ✅ Minimal kode-endring
- ✅ Alle eksisterende funksjoner (godkjenning, sending, etc.) fungerer automatisk

**Implementering:**
1. Endre kortet fra "Oppgaver" til "Timer"
2. Beregn total timer for prosjektet i `loadProjectStatsWithData()`
3. Legg til prosjekt-filter i `/admin/timer` som sjekker URL query parameter
4. Linke kortet til `/admin/timer?projectId={tripletexProjectId}`

**URL-struktur:**
```
/admin/timer?projectId=209419739
```



## Detaljert Implementeringsplan

### Fase 1: Oppdater Prosjektdetaljside

#### 1.1 Endre Stats-kortet
**Fil:** `src/app/prosjekt/[projectId]/page.tsx`

**Endringer:**
```typescript
// Fra:
<Card>
  <CardContent className="p-4">
    <div className="flex items-center space-x-2">
      <Calendar className="h-4 w-4 text-green-600" />
      <div>
        <p className="text-xs text-muted-foreground">Oppgaver</p>
        <p className="text-lg font-semibold">{stats.total_oppgaver}</p>
      </div>
    </div>
  </CardContent>
</Card>

// Til:
<Card 
  className={stats.total_timer > 0 ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
  onClick={() => stats.total_timer > 0 && router.push(`/admin/timer?projectId=${project.tripletex_project_id}`)}
>
  <CardContent className="p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Clock className="h-4 w-4 text-blue-600" /> {/* Eller Timer, Hourglass, etc. */}
        <div>
          <p className="text-xs text-muted-foreground">Timer</p>
          <p className="text-lg font-semibold">
            {stats.total_timer > 0 
              ? `${stats.total_timer.toFixed(1)} t` 
              : '0 t'
            }
          </p>
        </div>
      </div>
      {stats.total_timer > 0 && (
        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-50" />
      )}
    </div>
  </CardContent>
</Card>
```

**Ikon-valg:**
- `Clock` (lucide-react) - Klassisk timer-ikon
- `Timer` (lucide-react) - Sand-timer ikon
- `Clock3` (lucide-react) - Annen klokke-variant
- **Anbefaling:** `Clock` med blå farge (`text-blue-600`)

#### 1.2 Beregn total timer
**Fil:** `src/app/prosjekt/[projectId]/page.tsx`

**Tilføy i `loadProjectStatsWithData()`:**
```typescript
// Hent total timer for prosjektet
const { data: timerData, error: timerError } = await supabase
  .from('vakt_timer')
  .select(`
    timer,
    vakt!inner (
      project_id,
      ttx_project_cache!inner (
        tripletex_project_id
      )
    )
  `)
  .eq('vakt.ttx_project_cache.tripletex_project_id', projectData.tripletex_project_id!)
  .not('timer', 'is', null)
  .gt('timer', 0);

const totalTimer = timerData?.reduce((sum, entry) => sum + (entry.timer || 0), 0) || 0;

setStats({
  ...stats,
  total_timer: totalTimer
});
```

**Alternativ (enklere query):**
```typescript
// Hent via vakt og project_id direkte
const { data: vaktData } = await supabase
  .from('vakt')
  .select(`
    id,
    ttx_project_cache!inner (
      tripletex_project_id
    )
  `)
  .eq('ttx_project_cache.tripletex_project_id', projectData.tripletex_project_id!);

const vaktIds = vaktData?.map(v => v.id) || [];

const { data: timerData } = await supabase
  .from('vakt_timer')
  .select('timer')
  .in('vakt_id', vaktIds)
  .not('timer', 'is', null)
  .gt('timer', 0);

const totalTimer = timerData?.reduce((sum, entry) => sum + (entry.timer || 0), 0) || 0;
```

#### 1.3 Oppdater `ProjectStats` interface
```typescript
interface ProjectStats {
  total_befaringer: number;
  total_oppgaver: number;
  total_bilder: number;
  untagged_bilder: number;
  total_timer: number; // NYTT
}
```

### Fase 2: Legg til Prosjekt-filter i `/admin/timer`

#### 2.1 Parse URL Query Parameter
**Fil:** `src/app/admin/timer/page.tsx`

**Tilføy:**
```typescript
import { useSearchParams } from 'next/navigation';

const AdminTimerPage = () => {
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get('projectId'); // tripletex_project_id (number)
  
  // Convert to number if present
  const filteredProjectId = projectIdParam ? parseInt(projectIdParam, 10) : null;
```

#### 2.2 Legg til filter i `loadTimerEntries()`
**Fil:** `src/app/admin/timer/page.tsx`

**I `loadTimerEntries()` funksjonen, legg til:**
```typescript
// ... existing query building ...

// Project filter (if projectId is provided in URL)
if (filteredProjectId) {
  query = query.eq('vakt.ttx_project_cache.tripletex_project_id', filteredProjectId);
}

// ... rest of query ...
```

**Alternativ (hvis nested filter ikke fungerer):**
```typescript
// Hent vakt IDs for prosjektet først
if (filteredProjectId) {
  const { data: projectVaktData } = await supabase
    .from('vakt')
    .select('id')
    .eq('project_id', /* må finne ttx_project_cache.id fra tripletex_project_id */);

  const projectVaktIds = projectVaktData?.map(v => v.id) || [];
  
  if (projectVaktIds.length > 0) {
    query = query.in('vakt_id', projectVaktIds);
  } else {
    // Ingen vakt entries for dette prosjektet, returner tom array
    setGroupedEntries([]);
    setLoading(false);
    return;
  }
}
```

#### 2.3 Vis prosjekt-indikator i UI
**Fil:** `src/app/admin/timer/page.tsx`

**Legg til banner/info-boks når filter er aktivt:**
```typescript
{filteredProjectId && (
  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Info className="h-4 w-4 text-blue-600" />
        <span className="text-sm text-blue-800">
          Viser timer for prosjekt ID: {filteredProjectId}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/admin/timer')}
      >
        <X className="h-4 w-4 mr-1" />
        Fjern filter
      </Button>
    </div>
  </div>
)}
```

**Alternativ: Vise prosjektnavn**
```typescript
// Hent prosjektnavn fra cache
const { data: projectData } = await supabase
  .from('ttx_project_cache')
  .select('project_name, project_number')
  .eq('tripletex_project_id', filteredProjectId)
  .single();

// Vis: "Viser timer for: Prosjekt #13 - Eidsvoll Verk Skolegård"
```

### Fase 3: Testing og Forbedringer

#### 3.1 Test Cases
1. ✅ Kort viser riktig antall timer
2. ✅ Kort er klikkbart når timer > 0
3. ✅ Link til `/admin/timer?projectId=X` fungerer
4. ✅ `/admin/timer` filtrerer korrekt på prosjekt
5. ✅ Prosjekt-indikator vises når filter er aktivt
6. ✅ "Fjern filter" knapp fungerer
7. ✅ Timer-beregning fungerer med grupperte entries (samme vakt_id)
8. ✅ Empty state vises når ingen timer for prosjektet

#### 3.2 Edge Cases
- **Prosjekt uten timer:** Vis "0 t", kort ikke klikkbart
- **Prosjekt-ID ikke funnet:** Håndter gracefully
- **Flere timer per vakt_id:** Summer korrekt (grupper som i eksisterende logikk)
- **Timer med null/0:** Filtrer bort i beregning

#### 3.3 Ytelse
- **Caching:** Vurder å cache timer-sum i `project_stats` tabell (optional)
- **Query optimization:** Bruk aggregat query hvis mulig:
```sql
SELECT SUM(timer) 
FROM vakt_timer 
WHERE vakt_id IN (
  SELECT id FROM vakt 
  WHERE project_id IN (
    SELECT id FROM ttx_project_cache 
    WHERE tripletex_project_id = ?
  )
) 
AND timer > 0;
```

## Wireframe

### Prosjektdetaljside - Stats Overview (Oppdatert)

```
┌─────────────────────────────────────────────────────────────┐
│  Stats Overview (4 kort i rad)                               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 🔵 Befar.│  │ ⏰ Timer │  │ 🟠 Bilder│  │ 🔴 Utag. │   │
│  │     5    │  │   145 t  │  │    23    │  │    2     │   │
│  │          │  │    →     │  │          │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                (Klikkbar når timer > 0)                    │
└─────────────────────────────────────────────────────────────┘
```

### `/admin/timer` med Prosjekt-filter

```
┌─────────────────────────────────────────────────────────────┐
│  Timer - Godkjenning                                         │
├─────────────────────────────────────────────────────────────┤
│  ℹ️ Viser timer for prosjekt: #13 - Eidsvoll Verk... [✕]   │
├─────────────────────────────────────────────────────────────┤
│  [Filter: Dato | Status | ...]                              │
│  [Denne måneden ▼] [Sendt ▼]                                │
├─────────────────────────────────────────────────────────────┤
│  [Timer-tabell filtrert på prosjekt]                        │
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

## Estimert Tid

- **Fase 1 (Prosjektdetaljside):** 1-2 timer
  - Endre kort UI (30 min)
  - Legg til timer-beregning (45 min)
  - Testing (15 min)
  
- **Fase 2 (Timer-side filter):** 1-2 timer
  - Query parameter parsing (30 min)
  - Filter logikk (45 min)
  - UI indikator (30 min)
  - Testing (15 min)

- **Fase 3 (Testing og polish):** 30 min

**Total: 2.5-4.5 timer**

## Konklusjon

**Anbefaling:** Implementer **Alternativ 1** - Link til `/admin/timer` med prosjekt-filter.

**Fordeler:**
- ✅ Minimal kode-endring
- ✅ Gjenbruker eksisterende UI og funksjonalitet
- ✅ Konsistent brukeropplevelse
- ✅ Alle eksisterende features (godkjenning, sending, etc.) fungerer automatisk

**Implementeringsrekkefølge:**
1. Først: Endre kortet i prosjektdetaljside (Fase 1)
2. Deretter: Legg til filter i timer-side (Fase 2)
3. Til slutt: Testing og polish (Fase 3)

## Spørsmål å vurdere

1. **Skal timer-kortet vise detaljert info?**
   - Kun totalt: "145 t"
   - Med antall ansatte: "145 t fra 12 ansatte"
   - Med periode: "145 t (denne måneden)"
   - **Anbefaling:** Start med kun totalt, utvid senere hvis nødvendig

2. **Skal timer inkludere alle timer eller kun godkjent/sendt?**
   - Alle timer (inkludert utkast)
   - Kun godkjent + sendt timer
   - **Anbefaling:** Alle timer (inkludert utkast) - gir fullstendig bilde

3. **Skal timer-kortet cache resultatet?**
   - Hent fra database hver gang
   - Cache i state/context
   - Cache i database (`project_stats` tabell)
   - **Anbefaling:** Start uten cache, legg til hvis ytelse blir problem

## Relasjon til Prosjektdeltakere-plan

Se `docs/prosjektdeltakere-plan.md` for relatert funksjonalitet som også legges til på prosjektdetaljsiden. Disse to planene er relatert men uavhengige - kan implementeres i hvilken som helst rekkefølge, men Timer-kort anbefales først siden det er enklere.

