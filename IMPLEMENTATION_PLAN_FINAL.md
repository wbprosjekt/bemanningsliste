# FieldNote Dashboard - Final Implementeringsplan

**Dato:** 14. oktober 2025  
**Status:** Klar for koding  
**Estimat:** 3-4 dager

---

## ✅ GODKJENTE ENDRINGER

### 1. KRITISKE FIXES (MÅ implementeres)
- ✅ Normaliserte koordinater (zoom-safe pins)
- ✅ Presigned URLs + Thumbnails (ytelse)
- ✅ Audit log (sporbarhet)

### 2. DASHBOARD FEATURES (Som planlagt)
- ✅ Prosjektvelger + Favoritter
- ✅ Foto-innboks (prosjekt-gruppert)
- ✅ KPI-kort + Aktivitetsfeed
- ✅ "Krever handling" alerts

---

## 🚨 RISIKO-ANALYSE

### Normaliserte Koordinater

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Eksisterende oppgaver vises feil | **HØY** | **KRITISK** | Gradvis migrering med fallback |
| Plantegninger mangler dimensions | **MEDIUM** | **HØY** | Beregn fra PDF/bilde ved opplasting |
| Komponenter ikke oppdatert | **LAV** | **MEDIUM** | Grundig testing, feature flag |

**Konklusjon:** **Implementeres med forsiktighet!**

**Strategi:**
1. ✅ Legg til nye kolonner (IKKE fjern gamle enda)
2. ✅ Dual-mode: Les begge (normalized prioritet, fallback til pixel)
3. ✅ Test grundig med eksisterende data
4. ✅ Når 100% verifisert → Fjern gamle kolonner

---

## 📋 IMPLEMENTERINGSPLAN - DAG FOR DAG

### **DAG 1: Database (3-4 timer)**

#### **Steg 1.1: Normaliserte koordinater** (1 time)
```sql
-- Migrasjon: 20251014000001_normalize_coordinates.sql

-- Legg til på oppgaver
ALTER TABLE oppgaver
ADD COLUMN x_normalized decimal(5,4),
ADD COLUMN y_normalized decimal(5,4);

-- Legg til dimensions på plantegninger
ALTER TABLE plantegninger
ADD COLUMN original_width integer,
ADD COLUMN original_height integer;

-- VIKTIG: Beregn dimensions fra eksisterende PDF/bilder
-- (Må gjøres manuelt eller via script)

-- Konverter eksisterende oppgaver
UPDATE oppgaver o
SET 
  x_normalized = CASE 
    WHEN p.original_width > 0 THEN o.x_coordinate::decimal / p.original_width
    ELSE NULL
  END,
  y_normalized = CASE 
    WHEN p.original_height > 0 THEN o.y_coordinate::decimal / p.original_height
    ELSE NULL
  END
FROM plantegninger p
WHERE o.plantegning_id = p.id;

-- Verifiser
SELECT 
  id, 
  plantegning_id,
  x_coordinate, 
  x_normalized,
  y_coordinate,
  y_normalized
FROM oppgaver 
WHERE plantegning_id IS NOT NULL
LIMIT 10;
```

**Test:**
```sql
-- Skal få resultat der normalized er mellom 0 og 1
SELECT COUNT(*) FROM oppgaver 
WHERE x_normalized > 1 OR y_normalized > 1;
-- Forventer: 0
```

---

#### **Steg 1.2: Presigned URLs + Thumbnails** (1 time)
```sql
-- Migrasjon: 20251014000002_image_optimization.sql

ALTER TABLE oppgave_bilder
ADD COLUMN storage_path text,           -- 'projects/{id}/images/{uuid}.webp'
ADD COLUMN thumbnail_1024_path text,    
ADD COLUMN thumbnail_2048_path text,
ADD COLUMN original_width integer,
ADD COLUMN original_height integer,
ADD COLUMN file_format text DEFAULT 'webp',
ADD COLUMN is_optimized boolean DEFAULT false;

-- Indekser
CREATE INDEX idx_oppgave_bilder_storage ON oppgave_bilder(storage_path);
CREATE INDEX idx_oppgave_bilder_optimized ON oppgave_bilder(is_optimized) 
  WHERE is_optimized = false;
```

---

#### **Steg 1.3: Audit log** (30 min)
```sql
-- Migrasjon: 20251014000003_audit_log.sql

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  org_id uuid REFERENCES organizations(id),
  
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  
  old_data jsonb,
  new_data jsonb,
  changes jsonb,
  
  ip_address inet,
  user_agent text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_org ON audit_log(org_id, created_at DESC);

-- RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org audit log"
  ON audit_log FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert audit log"
  ON audit_log FOR INSERT
  WITH CHECK (true);  -- Backend inserts via service role
```

---

#### **Steg 1.4: Dashboard-tabeller** (1 time)
```sql
-- Migrasjon: 20251014000004_dashboard_system.sql

-- (Kopier fra FIELDNOTE_DASHBOARD_PLAN.md seksjon 4.1)
-- project_favorites
-- project_activity  
-- user_preferences
-- Views: project_activity_summary, project_inbox_summary
```

---

### **DAG 2: Frontend - Kritiske fixes (4-5 timer)**

#### **Steg 2.1: Oppdater InteractivePlantegning** (2 timer)

**Før:**
```typescript
const handleClick = (e) => {
  const x = e.clientX - rect.left;  // Pixel
  const y = e.clientY - rect.top;   // Pixel
  saveOppgave({ x_coordinate: x, y_coordinate: y });
};
```

**Etter:**
```typescript
const handleClick = (e) => {
  const rect = canvasRef.current.getBoundingClientRect();
  
  // Beregn normaliserte koordinater
  const xNormalized = (e.clientX - rect.left) / rect.width;
  const yNormalized = (e.clientY - rect.top) / rect.height;
  
  console.log('📍 Pin placed:', { xNormalized, yNormalized });
  
  saveOppgave({ 
    x_normalized: xNormalized, 
    y_normalized: yNormalized,
    // Behold pixel for bakoverkompatibilitet (midlertidig)
    x_coordinate: e.clientX - rect.left,
    y_coordinate: e.clientY - rect.top
  });
};
```

**Render pins (zoom-safe):**
```typescript
const renderPins = (pins, canvasWidth, canvasHeight) => {
  pins.forEach(pin => {
    // Prioriter normalized, fallback til pixel
    const x = pin.x_normalized 
      ? pin.x_normalized * canvasWidth 
      : pin.x_coordinate;
    
    const y = pin.y_normalized 
      ? pin.y_normalized * canvasHeight 
      : pin.y_coordinate;
    
    drawPin(x, y);
  });
};
```

---

#### **Steg 2.2: Oppdater PlantegningViewer** (1 time)

**Lagre dimensions ved PDF load:**
```typescript
const onPDFLoad = (pdf) => {
  pdf.getPage(1).then(page => {
    const viewport = page.getViewport({ scale: 1.0 });
    
    // Lagre original dimensions
    setOriginalDimensions({
      width: viewport.width,
      height: viewport.height
    });
    
    // Oppdater i database
    updatePlantegning(plantegningId, {
      original_width: Math.round(viewport.width),
      original_height: Math.round(viewport.height)
    });
  });
};
```

---

#### **Steg 2.3: Presigned upload** (1-2 timer)

**API route: `/api/upload/presigned`**
```typescript
// app/api/upload/presigned/route.ts
export async function POST(req: Request) {
  const { projectId, filename } = await req.json();
  
  const path = `projects/${projectId}/images/${uuid()}.webp`;
  
  const { data, error } = await supabase.storage
    .from('oppgave-bilder')
    .createSignedUploadUrl(path, {
      upsert: false
    });
  
  if (error) throw error;
  
  return Response.json({ 
    signedUrl: data.signedUrl,
    path: data.path,
    token: data.token
  });
}
```

**Client upload:**
```typescript
const uploadImage = async (file: File, projectId: string) => {
  // 1. Get presigned URL
  const { signedUrl, path } = await fetch('/api/upload/presigned', {
    method: 'POST',
    body: JSON.stringify({ projectId, filename: file.name })
  }).then(r => r.json());
  
  // 2. Upload direkte til CDN
  await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': 'image/webp'
    }
  });
  
  // 3. Notify backend (generer thumbnails)
  await fetch('/api/upload/complete', {
    method: 'POST',
    body: JSON.stringify({ path, projectId })
  });
};
```

---

### **DAG 3: Dashboard UI (4-6 timer)**

#### **Steg 3.1: ProjectSelector komponent** (1 time)
```typescript
// src/components/dashboard/ProjectSelector.tsx
export function ProjectSelector() {
  return (
    <div className="space-y-4">
      {/* Dropdown */}
      <Select value={selectedProject} onChange={setSelectedProject}>
        <option value="all">📊 Alle prosjekter</option>
        <optgroup label="⭐ Favoritter">
          {favorites.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </optgroup>
      </Select>
      
      {/* Favoritt-chips */}
      <div className="flex gap-2">
        {favorites.slice(0, 4).map(p => (
          <Chip 
            key={p.id}
            active={selected === p.id}
            onClick={() => setSelected(p.id)}
          >
            ⭐ {p.name}
          </Chip>
        ))}
        <Chip onClick={() => setSelected('all')}>📊 Alle</Chip>
      </div>
    </div>
  );
}
```

#### **Steg 3.2: Conditional dashboard** (2 timer)
```typescript
// src/app/dashboard/page.tsx
{selectedProject === 'all' ? (
  <AllProjectsView>
    <FavoriteProjects projects={favorites} />
    <MostActiveProjects projects={mostActive} limit={5} />
    <Link to="/prosjekter">Se alle 247 prosjekter →</Link>
  </AllProjectsView>
) : (
  <SingleProjectView project={selectedProject}>
    <ActionRequired projectId={selectedProject} />
    <KPICards projectId={selectedProject} />
    <div className="grid md:grid-cols-2 gap-4">
      <ActivityFeed projectId={selectedProject} hours={24} />
      <PhotoInbox projectId={selectedProject} />
    </div>
    <ModuleCards projectId={selectedProject} />
  </SingleProjectView>
)}
```

#### **Steg 3.3: Foto-innboks** (2 timer)
```typescript
// src/components/dashboard/PhotoInbox.tsx
export function PhotoInbox({ projectId }) {
  const { data: inbox } = useQuery({
    queryKey: ['photo-inbox', projectId],
    queryFn: () => projectId === 'all' 
      ? getInboxGroupedByProject()
      : getInboxForProject(projectId)
  });
  
  if (projectId === 'all') {
    return (
      <div className="space-y-4">
        {inbox.map(group => (
          <InboxGroup key={group.projectId} project={group}>
            {group.images.map(img => (
              <InboxImage key={img.id} image={img} />
            ))}
          </InboxGroup>
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-2 gap-2">
      {inbox.images.map(img => (
        <InboxImage 
          key={img.id} 
          image={img}
          onTag={(target) => tagPhoto(img.id, target)}
        />
      ))}
    </div>
  );
}
```

---

### **DAG 4: Testing & Polish (2-3 timer)**

#### **Test 1: Normaliserte koordinater**
```typescript
// Test at pins står stille ved zoom
test('pins are zoom-safe', () => {
  const pin = { x_normalized: 0.5, y_normalized: 0.5 };
  
  // 100% zoom
  const pos100 = renderPin(pin, 1000, 1000);
  expect(pos100).toEqual({ x: 500, y: 500 });
  
  // 200% zoom
  const pos200 = renderPin(pin, 2000, 2000);
  expect(pos200).toEqual({ x: 1000, y: 1000 }); // Riktig!
  
  // Pin er på samme relative posisjon
  expect(pos100.x / 1000).toBe(pos200.x / 2000); // 0.5
});
```

#### **Test 2: Presigned upload**
```typescript
test('presigned upload works', async () => {
  const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
  const projectId = 'test-project';
  
  await uploadImage(file, projectId);
  
  // Verify file exists in storage
  const { data } = await supabase.storage
    .from('oppgave-bilder')
    .list(`projects/${projectId}/images`);
  
  expect(data.length).toBeGreaterThan(0);
});
```

#### **Test 3: Foto-innboks**
```typescript
test('inbox shows untagged images', async () => {
  const { data } = await getPhotoInbox('all');
  
  // Alle bilder skal være utaggede
  expect(data.every(img => !img.is_tagged)).toBe(true);
  
  // Alle skal ha prosjekt
  expect(data.every(img => img.prosjekt_id)).toBe(true);
});
```

---

## 🎯 AKSEPTANSEKRITERIER

### Normaliserte koordinater
- [ ] Pin står 100% stille ved all zoom/pan
- [ ] Eksisterende oppgaver vises korrekt
- [ ] Nye oppgaver får normaliserte coords
- [ ] Fallback til pixel fungerer

### Presigned URLs
- [ ] Upload tar < 3 sek for 5MB bilde
- [ ] Thumbnails genereres innen 10 sek
- [ ] Foto-innboks viser thumbs (ikke full-size)

### Dashboard
- [ ] Prosjektvelger filtrerer alt
- [ ] Favoritter fungerer (org + personlige)
- [ ] "Mest aktive" viser riktig rekkefølge
- [ ] Foto-innboks gruppert per prosjekt

### Audit log
- [ ] Logger alle oppgave-endringer
- [ ] Viser hvem gjorde hva og når
- [ ] Admin kan se full historikk

---

## 🚀 GO/NO-GO BESLUTNING

**KRITISKE SPØRSMÅL:**

1. **Er du komfortabel med normaliserte koordinater?**
   - ✅ Ja - Vi implementerer med dual-mode (sikker)
   - ❌ Nei - Vi utsetter til vi har mer data

2. **Skal vi kjøre presigned URLs nå?**
   - ✅ Ja - Stor ytelsesgevinst
   - ❌ Nei - Behold eksisterende (enklere)

3. **Audit log - nå eller senere?**
   - ✅ Nå - Viktig for compliance
   - ❌ Senere - Ikke kritisk for MVP

**DITT SVAR:**
- [ ] GO - Start koding med alle 3
- [ ] GO MED ENDRINGER - (spesifiser)
- [ ] NO-GO - Vent, må diskutere mer

---

## 📝 MIGRASJONS-REKKEFØLGE

```bash
# Dag 1 - Database
supabase/migrations/20251014000001_normalize_coordinates.sql
supabase/migrations/20251014000002_image_optimization.sql
supabase/migrations/20251014000003_audit_log.sql
supabase/migrations/20251014000004_dashboard_system.sql

# Kjør alle
npx supabase db push

# Verifiser
psql -c "SELECT * FROM oppgaver WHERE x_normalized IS NOT NULL LIMIT 5;"
```

---

**SLUTT PÅ PLAN**

✅ **Neste steg:** Vent på godkjenning, deretter start DAG 1!

