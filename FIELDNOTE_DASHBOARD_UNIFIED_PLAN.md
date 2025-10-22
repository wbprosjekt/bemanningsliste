# FieldNote Dashboard - Unified Master Plan

**Dato:** 21. oktober 2025  
**Status:** DESIGN COMPLETE - READY FOR IMPLEMENTATION  
**Prioritet:** HØY

---

## 🎯 PROBLEM MED NÅVÆRENDE DASHBOARD:

1. ❌ Grid/list visning av hundrevis av prosjekter er ikke skalerbart
2. ❌ Ingen god oversikt over data per prosjekt
3. ❌ Ingen prioritering av prosjekter
4. ❌ Vanskelig å finne "krever handling" ting
5. ❌ Ingen modul-visning (befaringer, oppgaver, bilder)
6. ❌ Foto-innboks ikke integrert i dashboard
7. ❌ Vanskelig å håndtere utaggede bilder per prosjekt

---

## 💡 LØSNING: 3-Lag Dashboard (Unified)

### **LAG 1: Oversikt (Dashboard Home) - KONDENSERT**
### **LAG 2: Prosjekt-detaljer (Project Detail) - FOKUSERT**
### **LAG 3: Moduler (Befaringer, Oppgaver, Bilder, etc.) - SPESIALISERT**

---

## 📸 FOTO-INNBOKS STRATEGI (Hybrid - Fra Wireframe)

### **Problem:**
- Utaggede bilder (uten prosjekt)
- Utaggede bilder (med prosjekt, men ikke tagget til befaring/oppgave)
- Hundrevis av prosjekter
- Trenger rask oversikt + detaljer

### **Løsning: Hybrid (Mini Inbox + Dedicated Page)**

**Dashboard Home:**
- Vis 6 bilder per prosjekt i mini inbox
- Gruppert per prosjekt
- "Uten prosjekt" i egen seksjon
- Klikk "Se alle" → går til dedicated inbox page

**Dedicated Inbox Page:**
- Full oversikt over alle utaggede bilder
- Gruppert per prosjekt
- Bulk operations (tag alle, slett alle)
- Filtrering og søk

**Prosjekt-detail:**
- Vis 12 bilder for spesifikt prosjekt
- Klikk "Se alle" → går til inbox filtrert på prosjekt

### **Database Strategy (OPTIMALISERT):**

**Dashboard Home: Top 6 bilder per prosjekt (RIKTIG!)**
```sql
-- Bruk CTE + ROW_NUMBER() for å få 6 bilder PER prosjekt
WITH ranked_photos AS (
  SELECT 
    id,
    image_url,
    prosjekt_id,
    inbox_date,
    comment,
    ROW_NUMBER() OVER (PARTITION BY prosjekt_id ORDER BY inbox_date DESC) as rn
  FROM oppgave_bilder
  WHERE org_id = $1
    AND is_tagged = false
    AND prosjekt_id IS NOT NULL
)
SELECT 
  p.id,
  p.image_url,
  p.prosjekt_id,
  p.inbox_date,
  p.comment,
  pc.project_name,
  pc.project_number,
  COUNT(*) OVER (PARTITION BY p.prosjekt_id) as total_count
FROM ranked_photos p
JOIN ttx_project_cache pc ON pc.id = p.prosjekt_id
WHERE p.rn <= 6
ORDER BY p.prosjekt_id, p.inbox_date DESC;
```

**Dedicated Inbox: Paginerte bilder (YTELSESOPTIMERT)**
```sql
-- Paginerte bilder (IKKE array_agg - blir for tungt!)
SELECT 
  ob.id,
  ob.image_url,
  ob.prosjekt_id,
  ob.inbox_date,
  ob.comment,
  pc.project_name,
  pc.project_number,
  COUNT(*) OVER (PARTITION BY ob.prosjekt_id) as total_count
FROM oppgave_bilder ob
LEFT JOIN ttx_project_cache pc ON pc.id = ob.prosjekt_id
WHERE ob.org_id = $1
  AND ob.is_tagged = false
ORDER BY ob.prosjekt_id, ob.inbox_date DESC
LIMIT 50 OFFSET $2;  -- Pagination: 50 bilder per side
```

---

## 📐 LAG 1: OVERSIKT (Dashboard Home) - KONDENSERT VERSJON

**Design-prinsipp:** Kompakt, fokusert, skalerbart

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🏗️ FieldNote                    [🔔 Varsler] [📱/📊] [Profil]         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  🎯 PROSJEKTVELGER                                                     │
│  [Alle prosjekter ▾]  [Søk...] 🔍  [Filter ▾]  [⭐ Favoritter]         │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 🚨 KREVER HANDLING (3 ting) [Vis alle →]                         │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ 🔴 5 oppgaver > 7 dager (3 prosjekter)                           │ │
│  │ 🟡 Befaring i morgen (1 prosjekt)                                │ │
│  │ 📷 24 bilder venter på tagging                                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 📷 FOTO-INNBOKS                                                   │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ Haugesund Bygg: 12 bilder  [IMG] [Se alle →]                    │ │
│  │ Nedre Torg 5: 8 bilder     [IMG] [Se alle →]                    │ │
│  │ Uten prosjekt: 4 bilder    [IMG] [Se alle →]                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 📊 KPI OVERVIEW                                                   │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ [Aktive: 12] [Oppgaver: 45] [Befaringer: 8] [Bilder: 24]       │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ ⭐ FAVORITTER & MEST AKTIVE                                      │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ [Haugesund Bygg] [Nedre Torg 5] [Storgt 15] [Bygata 7]          │ │
│  │ 🔥 Top 3 mest aktive (siste 7 dager)                            │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  📋 ALLE PROSJEKTER (247)  [Søk...] [Filter ▾] [Sorter: Aktivitet ▾] │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Haugesund Bygg #1234                    [⭐] [Se detaljer →]     │ │
│  │ 🔴 5 kritiske | 📊 45 hendelser | 📷 12 bilder                   │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ Nedre Torg 5 #5678                     [⭐] [Se detaljer →]     │ │
│  │ 🟡 Befaring i morgen | 📊 32 hendelser | 📷 8 bilder             │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ Storgt 15 #9012                          [Se detaljer →]       │ │
│  │ 📊 18 hendelser | 📷 5 bilder | 📋 2 oppgaver                   │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ [Vis 10 flere...]                                                │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**Fordeler med kondenserte versjon:**
- ✅ Alt synlig på én skjerm
- ✅ Mindre scrolling
- ✅ Raskere å skanne
- ✅ Skalerbart til 500+ prosjekter
- ✅ Klikk "Vis alle" for detaljer

---

## 📐 LAG 2: PROSJEKT-DETALJER (Project Detail) - FOKUSERT

**Design-prinsipp:** Fokusert på dette prosjektet, ingen repetisjon

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🏗️ FieldNote                    [🔔 Varsler] [📱/📊] [Profil]         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [← Tilbake til Dashboard]  Haugesund Bygg #1234  [⭐] [⚙️]           │
│  Kunde: Haugesund Kommune | Status: Aktiv | Sist oppdatert: 2t siden  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 🚨 KREVER HANDLING (for dette prosjektet)                        │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ 🔴 5 oppgaver > 7 dager - ESKALERT  [Se oppgaver →]             │ │
│  │ 📷 12 bilder venter på tagging  [Se foto-innboks →]              │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 📊 KPI                                                            │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ [Befaringer: 8 (5 åpne)] [Oppgaver: 15 (5 kritiske)]            │ │
│  │ [Bilder: 45 (12 utagged)] [Sjekklister: 3 (1 pending)]          │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 📂 MODULER                                                        │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ [📋 Befaringer (8)]  [📝 Oppgaver (15)]  [📷 Bilder (45)]        │ │
│  │ [✅ Sjekklister (3)]  [📊 Rapporter]  [⚙️ Innstillinger]        │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 📅 AKTIVITETSFEED (siste 24t)                                    │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ 🎨 Bilder (2 hendelser)                                          │ │
│  │   • Ole Hansen la til 3 bilder (2t siden)                        │ │
│  │   • Kari Nordmann la til 5 bilder (6t siden)                     │ │
│  │                                                                   │ │
│  │ 📋 Oppgaver (2 hendelser)                                        │ │
│  │   • Kari Nordmann opprettet oppgave #12 (4t siden)               │ │
│  │   • Lars Hansen fullførte oppgave #8 (8t siden)                  │ │
│  │                                                                   │ │
│  │ [Vis alle hendelser →]                                           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**Fordeler:**
- ✅ Ingen repetisjon fra dashboard
- ✅ Fokusert på dette prosjektet
- ✅ Grupperte hendelser i aktivitetsfeed
- ✅ Kompakt og oversiktlig

---

## 📐 LAG 3: MODULER (Befaringer, Oppgaver, Bilder, etc.)

### **Eksempel: Befaringer-modul**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🏗️ FieldNote                    [🔔 Varsler] [📱/📊] [Profil]         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [← Tilbake]  Haugesund Bygg #1234  >  📋 Befaringer                   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ [Søk befaringer...]  [Filter: Alle ▾]  [Sorter: Dato ▾]          │ │
│  │ [+ Ny befaring]                                                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ BEFARINGER (8)                                                    │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ ┌──────────────────────────────────────────────────────────────┐ │ │
│  │ │ Befaring #5 - VVS Kontroll                    [Åpne →]       │ │ │
│  │ │ Dato: 15.10.2025 | Status: Fullført                          │ │ │
│  │ │ 📋 12 oppgaver | 📷 25 bilder | 👤 Lars Hansen              │ │ │
│  │ │ 🔴 3 kritiske oppgaver                                        │ │ │
│  │ └──────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │ ┌──────────────────────────────────────────────────────────────┐ │ │
│  │ │ Befaring #6 - Elektro Kontroll                [Åpne →]       │ │ │
│  │ │ Dato: 16.10.2025 | Status: Pågående                          │ │ │
│  │ │ 📋 8 oppgaver | 📷 15 bilder | 👤 Kari Nordmann             │ │ │
│  │ │ 🟡 2 viktige oppgaver                                         │ │ │
│  │ └──────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │ [Vis flere...]                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 DESIGN-PRINSIPPER (Fra begge planer):

### **1. Smart Default**
- **Dashboard Home:** Vis "Krever handling" først
- **Favoritter:** Vis favoritt-prosjekter øverst
- **Mest aktive:** Vis prosjekter med mest aktivitet

### **2. Hierarkisk Navigasjon**
```
Dashboard Home
    ↓
Prosjekt-detaljer (Project Detail)
    ↓
Moduler (Befaringer, Oppgaver, Bilder, etc.)
    ↓
Detaljer (Befaring #5, Oppgave #12, etc.)
```

### **3. Filtrering & Søk**
- **Søk:** Prosjektnavn, nummer, kunde
- **Filter:** Status, kunde, dato, aktivitet
- **Sorter:** Aktivitet, navn, dato

### **4. Prioritering**
- **🔴 Kritisk:** Oppgaver > 7 dager, befaringer uten crew
- **🟡 Viktig:** Oppgaver > 3 dager, utaggede bilder
- **🟢 Info:** Normal aktivitet

### **5. Moduler per Prosjekt**
- **Befaringer:** Oversikt over alle befaringer
- **Oppgaver:** Oversikt over alle oppgaver (åpne/lukkede)
- **Bilder:** Foto-bibliotek med tagging
- **Sjekklister:** (Fremtidig)
- **Rapporter:** (Fremtidig)

---

## 🔧 CHATGPT FORBEDRINGER (Kritiske Performance Fixes):

### **1. Keyset-pagination (erstatt offset-pagination)**
```sql
-- Keyset-pagination for foto-innboks (konstant ytelse)
SELECT ob.id, ob.image_url, ob.prosjekt_id, ob.inbox_date, ob.comment,
       pc.project_name, pc.project_number
FROM oppgave_bilder ob
LEFT JOIN ttx_project_cache pc ON pc.tripletex_project_id = ob.prosjekt_id
WHERE ob.org_id = :org_id AND ob.is_tagged = false
  AND ((:last_inbox_date IS NULL AND :last_id IS NULL)
       OR (ob.inbox_date, ob.id) < (:last_inbox_date, :last_id))
ORDER BY ob.inbox_date DESC, ob.id DESC
LIMIT 50;
```

### **2. Materialiserte views (pre-beregnet data)**
```sql
-- Materialisert view for aktivitetsoppsummering
CREATE MATERIALIZED VIEW mv_project_activity_summary AS
SELECT p.tripletex_project_id, p.project_name, p.project_number, p.org_id,
  (COALESCE(COUNT(DISTINCT CASE WHEN ob.uploaded_at > now() - interval '7 days' THEN ob.id END) * 3, 0) +
   COALESCE(COUNT(DISTINCT CASE WHEN o.created_at   > now() - interval '7 days' THEN o.id END) * 2, 0) +
   COALESCE(COUNT(DISTINCT CASE WHEN bf.created_at  > now() - interval '7 days' THEN bf.id END) * 2.5, 0)) AS activity_score,
  COUNT(DISTINCT o.id)  FILTER (WHERE o.status != 'lukket') AS open_tasks,
  COUNT(DISTINCT ob.id) FILTER (WHERE ob.is_tagged = false) AS untagged_images,
  COUNT(DISTINCT bf.id) AS total_befaringer
FROM ttx_project_cache p
LEFT JOIN befaringer bf ON bf.tripletex_project_id = p.tripletex_project_id
LEFT JOIN oppgaver o ON o.prosjekt_id = p.tripletex_project_id OR o.befaring_id = bf.id
LEFT JOIN oppgave_bilder ob ON ob.prosjekt_id = p.tripletex_project_id
WHERE p.is_active = true
GROUP BY p.tripletex_project_id, p.project_name, p.project_number, p.org_id;

CREATE INDEX ON mv_project_activity_summary(org_id, activity_score DESC);

-- Materialisert view for alerts
CREATE MATERIALIZED VIEW mv_project_alerts AS
SELECT p.tripletex_project_id, p.project_name, p.project_number, p.org_id,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status != 'lukket' AND o.created_at < now() - interval '7 days') AS critical_tasks,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status != 'lukket' AND o.created_at < now() - interval '3 days') AS important_tasks,
  COUNT(DISTINCT ob.id) FILTER (WHERE ob.is_tagged = false) AS untagged_images,
  COUNT(DISTINCT bf.id) FILTER (WHERE bf.befaring_date BETWEEN now() AND now() + interval '1 day' AND bf.crew IS NULL) AS befaringer_mangler_crew
FROM ttx_project_cache p
LEFT JOIN befaringer bf ON bf.tripletex_project_id = p.tripletex_project_id
LEFT JOIN oppgaver o ON o.prosjekt_id = p.tripletex_project_id OR o.befaring_id = bf.id
LEFT JOIN oppgave_bilder ob ON ob.prosjekt_id = p.tripletex_project_id
WHERE p.is_active = true
GROUP BY p.tripletex_project_id, p.project_name, p.project_number, p.org_id;

CREATE INDEX ON mv_project_alerts(org_id);

-- Oppdatering hvert 5-10 min (cron eller backend-jobb)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_activity_summary;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_alerts;
```

### **3. Riktig total_count for Top 6-bilder**
```sql
-- Fikset CTE-spørring for korrekt total_count
WITH ranked AS (
  SELECT id, image_url, prosjekt_id, inbox_date, comment, org_id, is_tagged,
         ROW_NUMBER() OVER (PARTITION BY prosjekt_id ORDER BY inbox_date DESC) rn
  FROM oppgave_bilder
  WHERE org_id = $1 AND is_tagged = false AND prosjekt_id IS NOT NULL
), counts AS (
  SELECT prosjekt_id, COUNT(*) AS total_count FROM ranked GROUP BY prosjekt_id
)
SELECT r.id, r.image_url, r.prosjekt_id, r.inbox_date, r.comment,
       pc.project_name, pc.project_number, c.total_count
FROM ranked r
JOIN counts c ON c.prosjekt_id = r.prosjekt_id
JOIN ttx_project_cache pc ON pc.tripletex_project_id = r.prosjekt_id
WHERE r.rn <= 6
ORDER BY r.prosjekt_id, r.inbox_date DESC;
```

### **4. RLS-policies for sikkerhet**
```sql
-- RLS-policy for oppgave_bilder
ALTER TABLE oppgave_bilder ENABLE ROW LEVEL SECURITY;
CREATE POLICY oppgave_bilder_org_access
  ON oppgave_bilder
  FOR SELECT USING (org_id = auth.org_id());
```

### **5. Optimaliserte indekser**
```sql
-- Indekser for rask visning
CREATE INDEX idx_oppgave_bilder_org_tagged_proj_date
  ON oppgave_bilder(org_id, is_tagged, prosjekt_id, inbox_date DESC)
  WHERE is_tagged = false;

CREATE INDEX idx_oppgave_bilder_org_unassigned
  ON oppgave_bilder(org_id, is_tagged, inbox_date DESC)
  WHERE is_tagged = false AND prosjekt_id IS NULL;
```

### **6. Transaksjonell tagging-workflow**
```typescript
// Transaksjon for bulk-tagging
const tagPhotos = async (photoIds: string[], befaringId?: string, oppgaveId?: string) => {
  const { error } = await supabase.rpc('tag_photos_bulk', {
    photo_ids: photoIds,
    befaring_id: befaringId,
    oppgave_id: oppgaveId,
    user_id: userId,
    org_id: orgId
  });
  
  if (error) throw error;
  
  // Logg til audit
  await logAudit({
    action: 'BULK_TAG_PHOTOS',
    entity_type: 'oppgave_bilder',
    entity_ids: photoIds,
    new_data: { befaringId, oppgaveId }
  });
};
```

---

## 📊 DATABASE SCHEMA (Fra begge planer):

### **Nye tabeller:**
```sql
-- Prosjekt-favoritter
CREATE TABLE project_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  project_id uuid REFERENCES ttx_project_cache(id),
  org_id uuid REFERENCES organizations(id),
  is_org_favorite boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Prosjekt-aktivitet
CREATE TABLE project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES ttx_project_cache(id),
  org_id uuid REFERENCES organizations(id),
  activity_type text NOT NULL,  -- 'image_uploaded', 'task_created', etc.
  description text,
  related_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp DEFAULT now()
);

-- Bruker-preferanser
CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE,
  last_selected_project uuid REFERENCES ttx_project_cache(id),
  dashboard_layout jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### **Views for performance:**
```sql
-- Prosjekt-aktivitetsscore
CREATE OR REPLACE VIEW project_activity_summary AS
SELECT 
  p.id as project_id,
  p.project_name,
  p.project_number,
  p.org_id,
  (
    COALESCE(COUNT(DISTINCT CASE 
      WHEN ob.uploaded_at > NOW() - INTERVAL '7 days' 
      THEN ob.id END) * 3, 0) +
    COALESCE(COUNT(DISTINCT CASE 
      WHEN o.created_at > NOW() - INTERVAL '7 days' 
      THEN o.id END) * 2, 0) +
    COALESCE(COUNT(DISTINCT CASE 
      WHEN bf.created_at > NOW() - INTERVAL '7 days' 
      THEN bf.id END) * 2.5, 0)
  ) as activity_score,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status != 'lukket') as open_tasks,
  COUNT(DISTINCT ob.id) FILTER (WHERE ob.is_tagged = false) as untagged_images,
  COUNT(DISTINCT bf.id) as total_befaringer
FROM ttx_project_cache p
LEFT JOIN befaringer bf ON bf.tripletex_project_id = p.id
LEFT JOIN oppgaver o ON o.befaring_id = bf.id OR o.prosjekt_id = p.id
LEFT JOIN oppgave_bilder ob ON ob.prosjekt_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.project_name, p.project_number, p.org_id;

-- Prosjekt-alerts ("krever handling")
CREATE OR REPLACE VIEW project_alerts AS
SELECT 
  p.id as project_id,
  p.project_name,
  p.project_number,
  p.org_id,
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.status != 'lukket' 
    AND o.created_at < NOW() - INTERVAL '7 days'
  ) as critical_tasks,
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.status != 'lukket' 
    AND o.created_at < NOW() - INTERVAL '3 days'
  ) as important_tasks,
  COUNT(DISTINCT ob.id) FILTER (WHERE ob.is_tagged = false) as untagged_images,
  COUNT(DISTINCT bf.id) FILTER (
    WHERE bf.befaring_date BETWEEN NOW() AND NOW() + INTERVAL '1 day'
    AND bf.crew IS NULL
  ) as befaringer_mangler_crew
FROM ttx_project_cache p
LEFT JOIN befaringer bf ON bf.tripletex_project_id = p.id
LEFT JOIN oppgaver o ON o.befaring_id = bf.id OR o.prosjekt_id = p.id
LEFT JOIN oppgave_bilder ob ON ob.prosjekt_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.project_name, p.project_number, p.org_id;
```

### **Indekser for ytelse:**
```sql
-- Kritiske indekser for foto-innboks
CREATE INDEX idx_oppgave_bilder_org_tagged 
ON oppgave_bilder(org_id, is_tagged, inbox_date DESC)
WHERE is_tagged = false;

CREATE INDEX idx_oppgave_bilder_prosjekt_tagged 
ON oppgave_bilder(prosjekt_id, is_tagged, inbox_date DESC)
WHERE is_tagged = false AND prosjekt_id IS NOT NULL;

-- Indekser for favoritter
CREATE INDEX idx_project_favorites_user ON project_favorites(user_id);
CREATE INDEX idx_project_favorites_org ON project_favorites(org_id, is_org_favorite);

-- Indekser for aktivitet
CREATE INDEX idx_project_activity_project ON project_activity(project_id, created_at DESC);
CREATE INDEX idx_project_activity_org ON project_activity(org_id, created_at DESC);
CREATE INDEX idx_project_activity_type ON project_activity(activity_type);
```

---

## 🚀 IMPLEMENTERINGSPLAN (Unified + ChatGPT Forbedringer):

### **Fase 1A: Kritiske Performance Fixes (1-2 dager)**
- [ ] **Keyset-pagination** for foto-innboks (erstatt offset-pagination)
- [ ] **Materialiserte views** for aktivitet og alerts (mv_project_activity_summary, mv_project_alerts)
- [ ] **RLS-policies** for sikkerhet per organisasjon
- [ ] **Riktig total_count** for Top 6-bilder (fikse CTE-spørring)
- [ ] **Konsistente ID-navn** (tripletex_project_id vs id)

### **Fase 1B: Database Foundation (1-2 dager)**
- [ ] Database-migreringer (favoritter, aktivitet, preferanser)
- [ ] Indekser for ytelse (org_tagged_proj_date, org_unassigned)
- [ ] Transaksjonell tagging-workflow
- [ ] API endpoints for favoritter
- [ ] Basic real-time (Supabase subscriptions)

### **Fase 2: Dashboard Home (3-4 dager)**
- [ ] "Krever handling" seksjon (kondensert)
- [ ] KPI overview cards
- [ ] Favoritter & mest aktive
- [ ] Søk og filtrering
- [ ] Prosjekt-liste med pagination
- [ ] Real-time updates for dashboard

### **Fase 3: Project Detail (2-3 dager)**
- [ ] Prosjekt-info card
- [ ] KPI cards per prosjekt
- [ ] Modul-navigasjon
- [ ] Aktivitetsfeed (grupperte hendelser)

### **Fase 4: Foto-innboks (3-4 dager)**
- [ ] `PhotoInboxMini` komponent (6 bilder per prosjekt)
- [ ] Dedicated inbox page (`/photo-inbox`)
- [ ] Pagination (50 bilder per side)
- [ ] Bulk operations (tag alle, slett alle)
- [ ] Integrer i Dashboard Home
- [ ] Integrer i Prosjekt-detail

### **Fase 5: Moduler (4-5 dager)**
- [ ] Befaringer-modul
- [ ] Oppgaver-modul
- [ ] Bilder-modul (foto-bibliotek)
- [ ] Sjekklister-modul (fremtidig)

### **Fase 6: Advanced Features & Polish (3-4 dager)**
- [ ] Advanced notifikasjoner (email, push)
- [ ] Testing (brukertester, ytelsestester)
- [ ] Dokumentasjon
- [ ] Bug fixes og polish

**Total estimert tid:** 19-25 dager (inkludert ChatGPT forbedringer)

---

## 🎯 ACCEPTANCE CRITERIA (Unified):

### **Must Have (MVP):**
- ✅ Dashboard viser "Krever handling" først (kondensert)
- ✅ Favoritter & mest aktive synlige
- ✅ Søk og filtrering fungerer
- ✅ Klikk på prosjekt → viser detaljer
- ✅ Moduler per prosjekt fungerer
- ✅ Skalerbart til 500+ prosjekter
- ✅ Foto-innboks: Mini inbox (6 bilder) på dashboard
- ✅ Foto-innboks: Dedicated page med pagination
- ✅ Basic real-time updates (Supabase subscriptions)
- ✅ Foto-innboks: Gruppert per prosjekt + "uten prosjekt"

### **Should Have (Fase 2):**
- ⏳ Bulk operations (tag alle, slett alle)
- ⏳ Advanced notifikasjoner (email, push)
- ⏳ Drag & drop for favoritter
- ⏳ Grupperte hendelser i aktivitetsfeed
- ⏳ Ytelsestesting og optimalisering

### **Nice to Have (Fase 3):**
- ⏳ AI-basert prioritering
- ⏳ Automatiske alerts
- ⏳ Advanced analytics
- ⏳ Sjekklister-modul
- ⏳ Rapporter-modul

---

## 🧪 BRUKERTEST-PLAN:

### **Test 1: Dashboard Navigation (5 min)**
**Scenario:** Admin skal finne favoritt-prosjekt
1. Åpne Dashboard
2. Se "Favoritter" seksjon
3. Klikk på prosjekt
4. Se prosjekt-detaljer

**Suksess-kriterier:**
- ✅ Finner favoritt-prosjekt på < 5 sekunder
- ✅ Ser "Krever handling" først
- ✅ Kan navigere tilbake til dashboard

### **Test 2: Foto-innboks Workflow (10 min)**
**Scenario:** Admin skal tagge bilder
1. Se "Foto-innboks" på dashboard
2. Klikk "Se alle" på et prosjekt
3. Se alle bilder for prosjektet
4. Tag et bilde til befaring
5. Se at bilde er tagget

**Suksess-kriterier:**
- ✅ Ser utaggede bilder på < 3 sekunder
- ✅ Kan tagge bilde på < 10 sekunder
- ✅ Bilde forsvinner fra innboks etter tagging

### **Test 3: Søk og Filtrering (5 min)**
**Scenario:** Admin skal finne spesifikt prosjekt
1. Skriv "Haugesund" i søkefelt
2. Se filtrerte resultater
3. Klikk på prosjekt
4. Se prosjekt-detaljer

**Suksess-kriterier:**
- ✅ Søkeresultater vises på < 1 sekund
- ✅ Kan filtrere på status/kunde
- ✅ Kan sortere på aktivitet/navn

### **Test 4: Ytelse (5 min)**
**Scenario:** Admin har 200+ prosjekter
1. Åpne Dashboard
2. Se alle prosjekter
3. Scroll gjennom liste
4. Søk etter prosjekt

**Suksess-kriterier:**
- ✅ Dashboard laster på < 2 sekunder
- ✅ Smooth scrolling (60 FPS)
- ✅ Søk responsiv (< 300ms debounce)

---

## 🎨 FIGMA-READY VERSJON:

### **Komponenter:**
1. **Dashboard Header** - Logo, søk, varsler, profil
2. **Krever Handling Card** - Kondensert liste med "Vis alle"
3. **Foto-innboks Card** - Enkelt rad per prosjekt
4. **KPI Cards** - 4 kort med tall
5. **Favoritter & Mest Aktive** - Chips + liste
6. **Prosjekt-kort** - Kompakt versjon med status-badges

### **States:**
- **Empty state** - Ingen prosjekter/bilder
- **Loading state** - Skeleton screens
- **Error state** - Feilmeldinger
- **Success state** - Bekreftelser

### **Responsive Breakpoints:**
- **Mobile:** < 640px - Stack vertikalt
- **Tablet:** 640px - 1024px - 2 kolonner
- **Desktop:** > 1024px - Full layout

---

## 📝 NOTATER:

- **Prioritet:** Høy (bedre UX, skalerbart)
- **Kompleksitet:** Medium (UI + database + API)
- **Estimat:** 17-23 dager (realistisk)
- **Avhengigheter:** Database migrasjoner
- **Blokkerer:** Ingen

---

**Status:** DESIGN COMPLETE (UNIFIED + CHATGPT FORBEDRINGER)  
**Next Step:** Start Fase 1A - Kritiske Performance Fixes  
**Estimated Time:** 19-25 dager (inkludert ChatGPT forbedringer)

---

## 📋 PROSJEKTDETALJ-SIDEN - DETALJERT PLAN

**Dato:** 22. oktober 2025  
**Status:** IMPLEMENTATION IN PROGRESS  
**Prioritet:** HØY

### **🎯 NÅVÆRENDE STATUS:**
- ✅ **UI Design:** Komplett implementert
- ✅ **Database Schema:** Klar
- ✅ **Basic Navigation:** Fungerer
- 🔄 **Funksjonalitet:** Delvis implementert
- ❌ **Chat System:** Trenger database-fikser
- ❌ **Full Testing:** Ikke testet enda

### **📊 IMPLEMENTERTE FUNKSJONER:**
1. ✅ **Prosjekt-header** - Navn, status, quick actions
2. ✅ **Stats Overview** - Befaringer, oppgaver, bilder, utaggede
3. ✅ **Aktivitetsfeed** - Ekte data fra database
4. ✅ **Foto-bibliotek** - Viser prosjektbilder
5. ✅ **Hurtighandlinger** - Navigasjon til andre sider
6. ✅ **Slett-funksjonalitet** - For bilder med bekreftelse
7. 🔄 **Chat/Kommentarsystem** - UI klar, trenger database-fikser

### **❌ PROBLEMER SOM MÅ LØSES:**

#### **1. Chat/Kommentarsystem - Database Issue**
**Problem:** Chat fungerer ikke fordi `project_activity` tabellen mangler data eller har feil struktur.

**Løsning:**
- [ ] Sjekk om `project_activity` tabellen eksisterer
- [ ] Verifiser RLS policies
- [ ] Teste insert/select operasjoner
- [ ] Legge til test-data hvis nødvendig

#### **2. Prosjektstatistikk - Query Issues**
**Problem:** Stats viser 0 fordi queries ikke matcher database-struktur.

**Løsning:**
- [ ] Sjekk `befaringer` tabell struktur
- [ ] Sjekk `oppgaver` tabell struktur
- [ ] Fikse join-queries
- [ ] Teste med ekte data

#### **3. Aktivitetsfeed - Data Issues**
**Problem:** Aktivitetsfeed viser ingen data fordi `project_activity` er tom.

**Løsning:**
- [ ] Legge til test-aktiviteter
- [ ] Implementere aktivitets-logging når ting skjer
- [ ] Sjekk activity_type verdier

### **🔧 NESTE STEG - PRIORITERT:**

#### **Steg 1: Database Debugging (1-2 timer)**
- [ ] Sjekk `project_activity` tabell struktur
- [ ] Teste chat insert/select
- [ ] Legge til test-data

#### **Steg 2: Prosjektstatistikk Fiksing (1-2 timer)**
- [ ] Debug stats queries
- [ ] Fikse join-problemer
- [ ] Teste med ekte data

#### **Steg 3: Aktivitetsfeed Fiksing (1-2 timer)**
- [ ] Legge til test-aktiviteter
- [ ] Implementere aktivitets-logging
- [ ] Teste feed-funksjonalitet

#### **Steg 4: Full Testing (1-2 timer)**
- [ ] Teste alle funksjoner
- [ ] Responsivt design testing
- [ ] Performance testing
- [ ] User testing

### **📝 TESTING CHECKLIST:**

#### **Chat/Kommentarsystem:**
- [ ] Kan legge til kommentar
- [ ] Kommentarer vises riktig
- [ ] Brukernavn vises riktig
- [ ] Timestamps vises riktig
- [ ] Enter-tast fungerer
- [ ] Knapp fungerer

#### **Prosjektstatistikk:**
- [ ] Befaringer-tall er riktig
- [ ] Oppgaver-tall er riktig
- [ ] Bilder-tall er riktig
- [ ] Utaggede bilder-tall er riktig

#### **Aktivitetsfeed:**
- [ ] Aktiviteter vises riktig
- [ ] Ikoner matcher aktivitetstype
- [ ] Timestamps vises riktig
- [ ] Sortering fungerer

#### **Foto-bibliotek:**
- [ ] Bilder vises riktig
- [ ] Slett-funksjonalitet fungerer
- [ ] Hover-effekter fungerer
- [ ] Kommentarer vises

#### **Hurtighandlinger:**
- [ ] Ny befaring navigerer riktig
- [ ] Last opp bilder navigerer riktig
- [ ] Ny oppgave (TODO)
- [ ] Vis på kart (TODO)

### **🎯 MÅL:**
Alle funksjoner på prosjektdetalj-siden skal fungere perfekt med ekte data fra database innen 1-2 dager.

