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

### **Database Strategy:**
```sql
-- Dashboard Home: Top 6 bilder per prosjekt
SELECT DISTINCT ON (prosjekt_id)
  prosjekt_id,
  COUNT(*) OVER (PARTITION BY prosjekt_id) as total_count,
  array_agg(id) OVER (PARTITION BY prosjekt_id) as photo_ids
FROM oppgave_bilder
WHERE org_id = $1
  AND is_tagged = false
  AND prosjekt_id IS NOT NULL
ORDER BY prosjekt_id, inbox_date DESC
LIMIT 6;

-- Dedicated Inbox: Alle bilder gruppert
SELECT 
  prosjekt_id,
  COUNT(*) as total_count,
  array_agg(id) as photo_ids
FROM oppgave_bilder
WHERE org_id = $1
  AND is_tagged = false
GROUP BY prosjekt_id
ORDER BY total_count DESC;
```

---

## 💡 LØSNING: 3-Lag Dashboard

### **LAG 1: Oversikt (Dashboard Home)**
### **LAG 2: Prosjekt-detaljer (Project Detail)**
### **LAG 3: Moduler (Befaringer, Oppgaver, Bilder, etc.)**

---

## 📐 LAG 1: OVERSIKT (Dashboard Home)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🏗️ FieldNote                    [🔔 Varsler] [📱/📊] [Profil]         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  🎯 PROSJEKTVELGER                                                     │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ [Alle prosjekter ▾]  [Søk...] 🔍  [Filter ▾]  [⭐ Favoritter]     │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 🚨 KREVER HANDLING (Prioritert øverst)                           │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ 🔴 5 oppgaver > 7 dager - ESKALERT                              │ │
│  │    Prosjekt: Haugesund Bygg #1234                                │ │
│  │    [Se detaljer →] [Tag oppgaver →]                              │ │
│  │                                                                   │ │
│  │ 🟡 Befaring i morgen - mangler crew                              │ │
│  │    Prosjekt: Nedre Torg 5 #5678                                  │ │
│  │    [Se detaljer →] [Tildel crew →]                               │ │
│  │                                                                   │ │
│  │ 📷 24 bilder venter på tagging (12 i Haugesund Bygg)            │ │
│  │    [Se foto-innboks →]                                            │ │
│  │                                                                   │ │
│  │ 🟡 3 timer ikke sendt > 7 dager                                  │ │
│  │    [Se timer →]                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 📷 FOTO-INNBOKS (24 bilder totalt)                               │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │                                                                   │ │
│  │ ┌─ Haugesund Bygg (12 bilder) ────────────────────────────────┐ │ │
│  │ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                 │ │ │
│  │ │ │IMG │ │IMG │ │IMG │ │IMG │ │IMG │ │IMG │                 │ │ │
│  │ │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                 │ │ │
│  │ │ [+ 6 flere]  [Tag alle →]  [Se alle →]                     │ │ │
│  │ └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │ ┌─ Nedre Torg 5 (8 bilder) ──────────────────────────────────┐ │ │
│  │ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐                               │ │ │
│  │ │ │IMG │ │IMG │ │IMG │ │IMG │                               │ │ │
│  │ │ └────┘ └────┘ └────┘ └────┘                               │ │ │
│  │ │ [+ 4 flere]  [Tag alle →]  [Se alle →]                     │ │ │
│  │ └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │ ┌─ Uten prosjekt (4 bilder) ─────────────────────────────────┐ │ │
│  │ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐                               │ │ │
│  │ │ │IMG │ │IMG │ │IMG │ │IMG │                               │ │ │
│  │ │ └────┘ └────┘ └────┘ └────┘                               │ │ │
│  │ │ [Tag til prosjekt →]  [Slett alle →]                       │ │ │
│  │ └─────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 📊 KPI OVERVIEW                                                   │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │ │
│  │ │ Aktive   │ │ Åpne     │ │ Befaring │ │ Utaggede │             │ │
│  │ │ Prosjekter│ │ Oppgaver │ │ denne    │ │ Bilder   │             │ │
│  │ │   12     │ │   45     │ │ uken: 8  │ │   12     │             │ │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘             │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ ⭐ FAVORITTER & MEST AKTIVE                                      │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ [Haugesund Bygg] [Nedre Torg 5] [Storgt 15] [Bygata 7]          │ │
│  │                                                                   │ │
│  │ 🔥 MEST AKTIVE (siste 7 dager)                                  │ │
│  │ 1. Haugesund Bygg        45 hendelser  [Se detaljer →]          │ │
│  │ 2. Nedre Torg 5          32 hendelser  [Se detaljer →]          │ │
│  │ 3. Storgt 15             18 hendelser  [Se detaljer →]          │ │
│  │ 4. Bygata 7              12 hendelser  [Se detaljer →]          │ │
│  │ 5. Torgt 1               8 hendelser   [Se detaljer →]          │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 📋 ALLE PROSJEKTER (247)                                          │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ [Søk...] [Filter: Alle ▾] [Sorter: Aktivitet ▾]                 │ │
│  │                                                                   │ │
│  │ ┌──────────────────────────────────────────────────────────────┐ │ │
│  │ │ Haugesund Bygg #1234                    [⭐] [Se detaljer →] │ │ │
│  │ │ Kunde: Haugesund Kommune                                     │ │ │
│  │ │ 📊 45 hendelser | 📷 12 bilder | 📋 5 oppgaver              │ │ │
│  │ │ 🔴 5 kritiske oppgaver                                       │ │ │
│  │ └──────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │ ┌──────────────────────────────────────────────────────────────┐ │ │
│  │ │ Nedre Torg 5 #5678                     [⭐] [Se detaljer →]  │ │ │
│  │ │ Kunde: Oslo Eiendom                                           │ │ │
│  │ │ 📊 32 hendelser | 📷 8 bilder | 📋 3 oppgaver               │ │ │
│  │ │ 🟡 Befaring i morgen                                          │ │ │
│  │ └──────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │ [Vis 10 flere...]                                                │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📐 LAG 2: PROSJEKT-DETALJER (Project Detail)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🏗️ FieldNote                    [🔔 Varsler] [📱/📊] [Profil]         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [← Tilbake til Dashboard]  Haugesund Bygg #1234  [⭐] [⚙️]           │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 📊 PROSJEKT INFO                                                  │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ Prosjekt: Haugesund Bygg                                          │ │
│  │ Prosjektnummer: #1234                                             │ │
│  │ Kunde: Haugesund Kommune                                          │ │
│  │ Status: Aktiv                                                     │ │
│  │ Sist oppdatert: 2 timer siden                                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 🚨 KREVER HANDLING (for dette prosjektet)                        │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ 🔴 5 oppgaver > 7 dager - ESKALERT                              │ │
│  │    [Se oppgaver →] [Tag oppgaver →]                              │ │
│  │                                                                   │ │
│  │ 📷 12 bilder venter på tagging                                   │ │
│  │    [Se foto-innboks →]                                            │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 📊 KPI (for dette prosjektet)                                    │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │ │
│  │ │ Befaring │ │ Oppgaver │ │ Bilder   │ │ Sjekklister│            │ │
│  │ │    8     │ │   15     │ │   45     │ │    3      │             │ │
│  │ │ (5 åpne) │ │ (5 kritiske)│ (12 utagged)│ (1 pending)│          │ │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘             │ │
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
│  │ • 2 timer siden - Ole Hansen la til 3 bilder                     │ │
│  │ • 4 timer siden - Kari Nordmann opprettet oppgave #12            │ │
│  │ • 6 timer siden - Lars Hansen fullførte befaring #5              │ │
│  │ • 1 dag siden - Anne Berg opprettet sjekkliste "VVS"            │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

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

## 🚀 IMPLEMENTERINGSPLAN:

### **Fase 1: Foundation (Dag 1-2)**
- [ ] Database-migreringer (favoritter, aktivitet, preferanser)
- [ ] Views for performance (activity_summary, alerts)
- [ ] API endpoints for favoritter

### **Fase 2: Dashboard Home (Dag 3-4)**
- [ ] "Krever handling" seksjon
- [ ] KPI overview cards
- [ ] Favoritter & mest aktive
- [ ] Søk og filtrering
- [ ] Prosjekt-liste med pagination

### **Fase 3: Project Detail (Dag 5-6)**
- [ ] Prosjekt-info card
- [ ] KPI cards per prosjekt
- [ ] Modul-navigasjon
- [ ] Aktivitetsfeed

### **Fase 4: Moduler (Dag 7-10)**
- [ ] Befaringer-modul
- [ ] Oppgaver-modul
- [ ] Bilder-modul (foto-bibliotek)
- [ ] Sjekklister-modul (fremtidig)

### **Fase 5: Foto-innboks (Dag 11-13)**
- [ ] `PhotoInboxMini` komponent (6 bilder per prosjekt)
- [ ] Dedicated inbox page (`/photo-inbox`)
- [ ] Bulk operations (tag alle, slett alle)
- [ ] Integrer i Dashboard Home
- [ ] Integrer i Prosjekt-detail

### **Fase 6: Polish (Dag 14-15)**
- [ ] Real-time updates
- [ ] Notifikasjoner
- [ ] Testing
- [ ] Dokumentasjon

---

## 🎯 ACCEPTANCE CRITERIA:

### **Must Have:**
- ✅ Dashboard viser "Krever handling" først
- ✅ Favoritter & mest aktive synlige
- ✅ Søk og filtrering fungerer
- ✅ Klikk på prosjekt → viser detaljer
- ✅ Moduler per prosjekt fungerer
- ✅ Skalerbart til 500+ prosjekter
- ✅ Foto-innboks: Mini inbox (6 bilder) på dashboard
- ✅ Foto-innboks: Dedicated page med alle bilder
- ✅ Foto-innboks: Bulk operations (tag alle, slett alle)
- ✅ Foto-innboks: Gruppert per prosjekt + "uten prosjekt"

### **Should Have:**
- ⏳ Real-time updates
- ⏳ Notifikasjoner
- ⏳ Drag & drop for favoritter
- ⏳ Bulk operations

### **Nice to Have:**
- ⏳ AI-basert prioritering
- ⏳ Automatiske alerts
- ⏳ Advanced analytics

---

## 📝 NOTATER:

- **Prioritet:** Høy (bedre UX, skalerbart)
- **Kompleksitet:** Medium (UI + database + API)
- **Estimat:** 12 dager
- **Avhengigheter:** Database migrasjoner
- **Blokkerer:** Ingen

---

**Status:** DESIGN COMPLETE  
**Next Step:** Start Fase 1 - Database migrasjoner  
**Estimated Time:** 12 dager

