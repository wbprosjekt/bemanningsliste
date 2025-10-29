# Status-bobler (Ferie/Permisjon/Syk) - Implementeringsplan

## Oversikt
Implementere "fri tekst"-bobler for å markere Ferie, Permisjon, og Syk i bemanningslisten. Disse skal fungere som prosjektbobler, men uten å være knyttet til prosjekter.

## Database-endringer

### Migration
```sql
-- Legg til felter i vakt-tabellen
ALTER TABLE vakt 
  ADD COLUMN status_type TEXT CHECK (status_type IN ('ferie', 'permisjon', 'syk')),
  ADD COLUMN status_color VARCHAR(7) DEFAULT '#ef4444'; -- Rød som standard

-- Constraint: Enten project_id ELLER status_type (ikke begge, ikke ingen)
ALTER TABLE vakt 
  ADD CONSTRAINT vakt_project_or_status_check 
  CHECK (
    (project_id IS NOT NULL AND status_type IS NULL) OR 
    (project_id IS NULL AND status_type IS NOT NULL)
  );

-- Index for queries
CREATE INDEX idx_vakt_status_type ON vakt(org_id, person_id, dato, status_type) 
  WHERE status_type IS NOT NULL;
```

### Standard farger
- **Ferie**: `#ef4444` (rød)
- **Permisjon**: `#ef4444` (rød)
- **Syk**: `#ef4444` (rød)

*Alle rød for å tydelig vise at personen er "borte". Farger kan endres senere via fri-boble fargepalett.*

## UI-endringer

### ProjectSearchDialog.tsx
**Endringer:**
1. Legg til seksjon "Eller velg status" under prosjektvelgeren
2. Tre knapper/kort:
   - 🏖️ Ferie/Fri
   - 👤 Permisjon
   - 🏥 Syk
3. Når status velges, deaktiver prosjektvelgeren (og vice versa)
4. Ved "Tilordne": Opprett `vakt` med `status_type` satt og `project_id = NULL`

### loadExistingProjects
- Må ekskludere status-bobler fra telling (kun telle `project_id IS NOT NULL`)
- Status-bobler skal IKKE forhindre at samme status legges til samme dag (kan ha flere "syk"-dager f.eks.)

## Kritiske steder som må oppdateres

### 1. databaseOptimized.ts
- **`loadStaffingDataOptimized`**: Håndter at `project` kan være NULL for status-bobler
- Transform data riktig for visning

### 2. StaffingList.tsx
- **Visning**: Hvis `project === null`, vis `status_type` med `status_color`
- **Tooltips**: Vis "Ferie", "Permisjon" eller "Syk" i stedet for prosjektnavn
- **Drag & drop**: Fungerer, men må kopiere `status_type` og `status_color`
- **moveEntryToEmployeeAndDate**: Sjekk eksisterende status-bobler basert på `status_type` (ikke `project_id`)

### 3. TimeEntrySheet / TimeEntry
- **Kun for prosjektbobler**: Status-bobler skal IKKE kunne ha timer
- Disable/ikke vis timer-funksjonalitet for status-bobler
- Sjekk at `project_id` finnes før åpning av timer-dialog

### 4. Tripletex-synkronisering
**Må filtrere bort status-bobler:**
- `sendToTripletex` i StaffingList.tsx (linje ~1167)
- Admin timer page `sendToTripletex` (linje ~255)
- `tripletex-api/index.ts` `send_timesheet_entry` (linje ~1800)

**Validering:**
```typescript
if (!entry.project?.tripletex_project_id) {
  // Skip eller error - status-bobler skal ikke sendes til Tripletex
}
```

### 5. Admin timer page
- Filtrer bort entries med `project_id IS NULL` i queries
- Search/filter må håndtere `project === null`

### 6. Week overview pages
- Håndter `project === null` i visning
- Ekskluder fra timeoppsummeringer (`forventet_dagstimer`)

## Type guards og hjelpefunksjoner

```typescript
export function isStatusBubble(vakt: { 
  status_type: string | null; 
  project_id: string | null 
}): boolean {
  return vakt.status_type !== null && vakt.project_id === null;
}

export function isProjectBubble(vakt: {
  status_type: string | null;
  project_id: string | null;
}): boolean {
  return vakt.project_id !== null && vakt.status_type === null;
}

export function getBubbleLabel(entry: StaffingEntry): string {
  if (isStatusBubble(entry)) {
    return entry.status_type === 'ferie' ? 'Ferie/Fri' :
           entry.status_type === 'permisjon' ? 'Permisjon' :
           entry.status_type === 'syk' ? 'Syk' : '';
  }
  return entry.project?.project_name || '';
}

export function getBubbleColor(entry: StaffingEntry, projectColors: Record<number, string>): string {
  if (entry.status_type) {
    return entry.status_color || '#ef4444';
  }
  if (entry.project?.tripletex_project_id) {
    return projectColors[entry.project.tripletex_project_id] || '#94a3b8';
  }
  return '#94a3b8';
}
```

## Eksisterende data
- Håndter eksisterende `vakt`-rader uten `project_id` og uten `status_type`
- Disse vil feile på CHECK constraint - må migrere eller fjerne

## Sjekkliste før implementering
- [ ] Database migration laget og testet
- [ ] Type guards implementert
- [ ] ProjectSearchDialog oppdatert
- [ ] StaffingList visning oppdatert
- [ ] moveEntryToEmployeeAndDate oppdatert
- [ ] Tripletex-funksjoner sikret (filtrer bort status-bobler)
- [ ] TimeEntrySheet kun for prosjektbobler
- [ ] Admin timer page filtrerer bort status-bobler
- [ ] Week overview pages håndterer `project === null`
- [ ] Tester alle drag/drop scenarier

## Notater
- Status-bobler skal IKKE ha timer (`vakt_timer`)
- Status-bobler skal IKKE synkroniseres med Tripletex
- Status-bobler skal kunne kopieres og flyttes mellom personer/datoer (samme som prosjektbobler)
- Standard farger er røde, men kan endres via fri-boble fargepalett senere

