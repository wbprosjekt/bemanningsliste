# FieldNote Dashboard - Wireframe & Redesign

**Dato:** 19. oktober 2025  
**Status:** DESIGN PHASE  
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

## 📸 FOTO-INNBOKS STRATEGI (Hybrid)

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

### **UI Flow:**
```
Dashboard Home
    ↓ (Mini inbox - 6 bilder per prosjekt)
    ↓ Klikk "Se alle"
Dedicated Inbox Page
    ↓ (Alle bilder gruppert per prosjekt)
    ↓ Bulk operations
    ↓ Klikk "Tag alle"
Tag Photo Dialog
    ↓ (Tag til befaring/oppgave/prosjekt)
Bilde er tagget
```

### **Bulk Operations:**
- [☑️ Velg alle] [Tag til befaring →] [Tag til oppgave →]
- [Behold som prosjekt-bilder →] [Slett valgte →]

### **Database Strategy (REVIDERT):**

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

**Indekser for ytelse:**
```sql
-- Kritiske indekser for foto-innboks
CREATE INDEX idx_oppgave_bilder_org_tagged 
ON oppgave_bilder(org_id, is_tagged, inbox_date DESC)
WHERE is_tagged = false;

CREATE INDEX idx_oppgave_bilder_prosjekt_tagged 
ON oppgave_bilder(prosjekt_id, is_tagged, inbox_date DESC)
WHERE is_tagged = false AND prosjekt_id IS NOT NULL;
```

---

## 💡 LØSNING: 3-Lag Dashboard

### **LAG 1: Oversikt (Dashboard Home)**
### **LAG 2: Prosjekt-detaljer (Project Detail)**
### **LAG 3: Moduler (Befaringer, Oppgaver, Bilder, etc.)**

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

## 📐 LAG 2: PROSJEKT-DETALJER (Project Detail) - KONDENSERT

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

## 🎯 DESIGN-PRINSIPPER:

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

## 🔄 NAVIGASJONSFLO:

### **Scenario 1: Admin vil se "krever handling"**
```
1. Åpne Dashboard
2. Se "Krever handling" seksjon øverst
3. Klikk "Se detaljer →" på et prosjekt
4. Se prosjekt-detaljer med KPI
5. Klikk på modul (f.eks. "Oppgaver")
6. Se alle oppgaver for prosjektet
```

### **Scenario 2: Admin vil se favoritt-prosjekter**
```
1. Åpne Dashboard
2. Se "Favoritter" seksjon
3. Klikk på prosjekt
4. Se prosjekt-detaljer
```

### **Scenario 3: Admin vil søke etter prosjekt**
```
1. Åpne Dashboard
2. Skriv i søkefelt: "Haugesund"
3. Se filtrerte resultater
4. Klikk på prosjekt
5. Se prosjekt-detaljer
```

---

## 📊 DATABASE ENDRINGER:

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

---

## 📊 METRIKKER & DEFINISJONER:

### **"Mest aktive" definisjon:**
```sql
-- Aktivitetsscore (siste 7 dager)
activity_score = (
  images_uploaded * 3 +
  tasks_created * 2 +
  befaringer_completed * 2.5 +
  hours_logged * 0.5
)
```

### **Arkiverte prosjekter:**
- Filtreres ut av "mest aktive"
- Vises kun hvis eksplisitt valgt
- `WHERE is_active = true`

### **Prioritering:**
- **🔴 Kritisk:** Oppgaver > 7 dager, befaringer uten crew
- **🟡 Viktig:** Oppgaver > 3 dager, utaggede bilder
- **🟢 Info:** Normal aktivitet

---

## ⚡ YTELSESPLAN:

### **Database:**
- ✅ Indekser på kritiske felt (se SQL over)
- ✅ Materialiserte views for performance
- ✅ Pagination (50 bilder per side)
- ✅ CTE + ROW_NUMBER() for top N per gruppe

### **Frontend:**
- ✅ Lazy loading av bilder
- ✅ Virtualisering for lange lister
- ✅ React Query caching (5 min)
- ✅ Debounce på søk (300ms)

### **Backend:**
- ✅ Supabase subscriptions for real-time
- ✅ Batch operations for bulk tagging
- ✅ Optimized queries med proper joins

---

## 🚀 IMPLEMENTERINGSPLAN (REVIDERT):

### **Fase 1: Foundation + Basic Real-time (3-4 dager)**
- [ ] Database-migreringer (favoritter, aktivitet, preferanser)
- [ ] Views for performance (activity_summary, alerts)
- [ ] Indekser for ytelse
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

### **Fase 4: Moduler (4-5 dager)**
- [ ] Befaringer-modul
- [ ] Oppgaver-modul
- [ ] Bilder-modul (foto-bibliotek)
- [ ] Sjekklister-modul (fremtidig)

### **Fase 5: Foto-innboks (3-4 dager)**
- [ ] `PhotoInboxMini` komponent (6 bilder per prosjekt)
- [ ] Dedicated inbox page (`/photo-inbox`)
- [ ] Pagination (50 bilder per side)
- [ ] Bulk operations (tag alle, slett alle)
- [ ] Integrer i Dashboard Home
- [ ] Integrer i Prosjekt-detail

### **Fase 6: Advanced Notifikasjoner & Polish (3-4 dager)**
- [ ] Advanced notifikasjoner (email, push)
- [ ] Testing (brukertester, ytelsestester)
- [ ] Dokumentasjon
- [ ] Bug fixes og polish

**Total estimert tid:** 18-24 dager (ikke 12!)

---

## 🎯 ACCEPTANCE CRITERIA (RYDDET):

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

## 📝 NOTATER:

- **Prioritet:** Høy (bedre UX, skalerbart)
- **Kompleksitet:** Medium (UI + database + API)
- **Estimat:** 18-24 dager (realistisk)
- **Avhengigheter:** Database migrasjoner
- **Blokkerer:** Ingen

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

**Status:** DESIGN COMPLETE (REVIDERT)  
**Next Step:** Start Fase 1 - Database migrasjoner  
**Estimated Time:** 18-24 dager

