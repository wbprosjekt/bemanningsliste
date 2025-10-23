# FRI BEFARING - UNIFIED IMPLEMENTATION PLAN

## 🎯 **MÅL:**
Implementere "Fri befaring" modul som supplement til eksisterende "Befaring med plantegning" modul med fokus på brukervennlighet og praktisk funksjonalitet.

## 📋 **CORE FUNKSJONALITET:**

### **1. SIGNATUR-SYSTEM:**
- Canvas-signatur (enkel)
- Fullt navn + signatur
- Automatisk dato og klokkeslett
- Låsing av befaring etter signering

### **2. E-POST FUNKSJONALITET:**
- Send oppgaver på e-post til underleverandører
- E-post med svar-mulighet
- PDF vedlegg valgfritt
- Token-basert ekstern tilgang

### **3. PDF-RAPPORT:**
- FieldNote logo og branding
- Alle punkter med beskrivelser
- Bilder per punkt (thumbnail + full størrelse)
- Oppgaver og tildelinger
- Signatur og dato
- Nedlasting og e-post sending

### **4. ADMIN-FUNKSJONER:**
- Kun admin kan gjenåpne signerte befaringsrapporter
- Grunn for gjenåpning må oppgis
- Versjonering oppdateres

### **5. VERSJONERING:**
- Automatisk versjonering ved endringer
- Kopier befaring til ny befaring
- Kopier til samme eller annet prosjekt
- Historikk over alle versjoner

## 🗄️ **DATABASE-STRUKTUR:**

```sql
-- Fri befaringsmodul
CREATE TABLE fri_befaringer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id),
  tripletex_project_id integer REFERENCES ttx_project_cache(tripletex_project_id), -- NULL = untagged befaring
  title text NOT NULL,
  description text,
  befaring_date date,
  status text DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'signert', 'arkivert')),
  version text DEFAULT '1.0',
  parent_befaring_id uuid REFERENCES fri_befaringer(id), -- For kopiering
  reopen_reason text, -- Grunn for gjenåpning
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Befaringspunkter
CREATE TABLE befaring_punkter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fri_befaring_id uuid REFERENCES fri_befaringer(id) ON DELETE CASCADE,
  punkt_nr integer NOT NULL,
  tittel text NOT NULL,
  beskrivelse text,
  status text DEFAULT 'åpen' CHECK (status IN ('åpen', 'lukket')),
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT uq_befaring_punkt_nr UNIQUE (fri_befaring_id, punkt_nr)
);

-- Oppgaver for befaringpunkter
CREATE TABLE befaring_oppgaver (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  befaring_punkt_id uuid REFERENCES befaring_punkter(id) ON DELETE CASCADE,
  tittel text NOT NULL,
  beskrivelse text,
  tildelt_til uuid REFERENCES profiles(id),
  epost text,
  frist date,
  status text DEFAULT 'åpen' CHECK (status IN ('åpen', 'påbegynt', 'fullført')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT chk_owner_oneof CHECK (
    (tildelt_til IS NOT NULL AND epost IS NULL) OR
    (tildelt_til IS NULL AND epost IS NOT NULL)
  )
);

-- Signaturer (med integritet)
CREATE TABLE befaring_signaturer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fri_befaring_id uuid REFERENCES fri_befaringer(id) ON DELETE CASCADE,
  version text NOT NULL,
  fullt_navn text NOT NULL,
  signatur_data text, -- Base64 encoded signature
  signatur_png_url text, -- Render av signatur som PNG
  content_hash text, -- SHA-256 over: befaring payload + navn + dato + PNG-bytes
  signatur_dato timestamptz DEFAULT now(),
  ip_adresse text,
  user_agent text
);

-- Immutable snapshots for versjonering
CREATE TABLE befaring_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fri_befaring_id uuid REFERENCES fri_befaringer(id) ON DELETE CASCADE,
  version text NOT NULL,          -- "1.0", "1.1" osv.
  payload jsonb NOT NULL,         -- snapshot av hele befaringen (punkter, oppgaver, metadata)
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- E-post tokens for oppgaver (single-use + scope)
CREATE TABLE befaring_oppgave_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  befaring_oppgave_id uuid REFERENCES befaring_oppgaver(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  scope text DEFAULT 'reply' CHECK (scope IN ('view', 'reply', 'ack')),
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now()
);

-- E-post svar og kommentarer
CREATE TABLE befaring_oppgave_svar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  befaring_oppgave_id uuid REFERENCES befaring_oppgaver(id) ON DELETE CASCADE,
  token text REFERENCES befaring_oppgave_tokens(token),
  svar_tekst text,
  vedlegg_url text, -- For bilder/dokumenter
  svar_dato timestamptz DEFAULT now(),
  ip_adresse text
);

-- Utvid oppgave_bilder for befaringpunkter
ALTER TABLE oppgave_bilder 
ADD COLUMN befaring_punkt_id uuid REFERENCES befaring_punkter(id);

-- Indekser for ytelse
CREATE INDEX idx_fri_befaringer_org ON fri_befaringer(org_id, status);
CREATE INDEX idx_befaring_punkter_befaring ON befaring_punkter(fri_befaring_id, punkt_nr);
CREATE INDEX idx_befaring_oppgaver_punkt ON befaring_oppgaver(befaring_punkt_id, status, frist);
CREATE INDEX idx_befaring_signaturer_bef ON befaring_signaturer(fri_befaring_id, version);
CREATE INDEX idx_oppgave_bilder_bef_punkt ON oppgave_bilder(befaring_punkt_id, inbox_date DESC);
```

## 📱 **MOBIL-DASHBOARD DESIGN:**

### **MOBIL-DASHBOARD LAYOUT:**
```
┌─────────────────────────────────────────┐
│  🏠 FieldNote                    ⚙️ 🔔  │
│  ──────────────────────────────────────  │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ ⏰          │  │ 📷          │      │
│  │ Min uke    │  │ Bilder      │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ 📋          │  │ ➕          │      │
│  │ Befaringer  │  │ Ny befaring │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ 📷          │  │ 📝          │      │
│  │ Nytt bilde  │  │ Oppgaver    │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ 📝          │  │ 👥          │      │
│  │ Sjekklister │  │ Kontakter   │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
└─────────────────────────────────────────┘
```

### **HOVEDKNAPPER (8 stk):**
1. ⏰ **Min uke** - Tar oss inn i min/uke (eksisterende funksjonalitet)
2. 📷 **Bilder** - Se alle bilder
3. 📋 **Befaringer** - Se alle befaringsrapporter
4. ➕ **Ny befaring** - Opprett ny befaring
5. 📷 **Nytt bilde** - Last opp nytt bilde (KRITISK!)
6. 📝 **Oppgaver** - Se alle oppgaver
7. 📝 **Sjekklister** - Kommer senere
8. 👥 **Kontakter** - Eksisterende funksjonalitet

## 🚀 **IMPLEMENTERING - CHATGPT MVP-REKKEFØLGE:**

### **MVP-REKKEFØLGE (ChatGPT-anbefalt):**

#### **STEG 1: DB & RLS (Policies + Triggers)**
- [ ] Database migrasjoner med alle tabeller
- [ ] RLS policies på alle tabeller (org_id = auth.org_id())
- [ ] BEFORE UPDATE triggers for updated_at
- [ ] Indekser for ytelse

#### **STEG 2: Befaring → Punkter → Bilder (Keyset-pagination)**
- [ ] Grunnleggende komponenter
- [ ] "Ny befaring" popup dialog (med/uten prosjekt)
- [ ] Befaringspunkter med beskrivelser og status
- [ ] Bilde-håndtering per punkt (keyset-pagination)

#### **STEG 3: Oppgaver (Intern/E-post)**
- [ ] Opprett befaringsrapport-oppgaver per punkt
- [ ] Tildel til underleverandører
- [ ] Grunnleggende e-post-utsendelse
- [ ] Skille fra generelle prosjekt-oppgaver

#### **STEG 4: Signering (Låsing) + Snapshot + PDF**
- [ ] Canvas-signatur komponent
- [ ] Signatur-integritet med hash
- [ ] Låsing av befaring etter signering
- [ ] Immutable snapshots (befaring_versions)
- [ ] PDF-generering fra snapshot

#### **STEG 5: Admin Gjenåpning + Audit**
- [ ] Gjenåpne signerte befaringsrapporter
- [ ] Admin-tilgangskontroll
- [ ] Grunn for gjenåpning
- [ ] Full audit-logging

#### **STEG 6: Enterprise Features**
- [ ] E-post svar-funksjonalitet (inbound webhook)
- [ ] Single-use tokens
- [ ] Vedlegg i svar
- [ ] DKIM/SPF/DMARC klarering

## 🚀 **IMPLEMENTERING - FASEVIS:**

### **FASE 1: GRUNNLEGGENDE FUNKSJONALITET (MVP)**

#### **STEG 1: DATABASE & STRUKTUR**
- [ ] Database migrasjoner (alle tabeller)
- [ ] Grunnleggende komponenter
- [ ] "Ny befaring" popup dialog (med/uten prosjekt)
- [ ] Fri befaring hovedvisning

#### **STEG 2: MOBIL-DASHBOARD**
- [ ] Mobil-dashboard med store knapper
- [ ] 8 hovedknapper implementert
- [ ] Touch-vennlig interface
- [ ] Enkel navigasjon

#### **STEG 3: BEFARINGSPUNKTER**
- [ ] Legg til/rediger/fjern punkter
- [ ] Beskrivelser per punkt
- [ ] Status (åpen/lukket)
- [ ] Mobil og desktop interface

#### **STEG 4: BILDE-HÅNDTERING**
- [ ] Last opp bilder per punkt
- [ ] Bilde-galleri per punkt
- [ ] Integrasjon med eksisterende oppgave_bilder
- [ ] Mobil kamera-integrasjon

#### **STEG 5: BEFARING-OPPGAVE-FUNKSJONALITET**
- [ ] Opprett befaringsrapport-oppgaver per punkt
- [ ] Tildel til underleverandører
- [ ] Basic e-post sending
- [ ] Skille fra generelle prosjekt-oppgaver

### **FASE 2: AVANSERTE FUNKSJONER**

#### **STEG 6: SIGNATUR-SYSTEM**
- [ ] Canvas-signatur komponent
- [ ] Signatur lagring og validering
- [ ] Låsing av befaring
- [ ] Mobil og desktop signatur

#### **STEG 7: PDF-RAPPORT**
- [ ] PDF-generering
- [ ] FieldNote branding
- [ ] Nedlasting og e-post sending

#### **STEG 8: VERSJONERING**
- [ ] Automatisk versjonering
- [ ] Historikk og endringslogg
- [ ] Kopier-funksjonalitet

#### **STEG 9: ADMIN-FUNKSJONER**
- [ ] Gjenåpne signerte befaringsrapporter
- [ ] Admin-tilgangskontroll
- [ ] Grunn for gjenåpning

### **FASE 3: ENTERPRISE-FEATURES**

#### **STEG 10: E-POST SVAR**
- [ ] E-post svar-funksjonalitet
- [ ] Vedlegg i svar
- [ ] Integrasjon med befaringsrapport-oppgave-system

#### **STEG 11: TESTING OG OPTIMALISERING**
- [ ] Omfattende testing
- [ ] Performance optimalisering
- [ ] Brukervennlighet forbedringer
- [ ] Mobil og desktop testing

## 📱 **UI/UX KOMPONENTER:**

### **Hovedkomponenter:**
- `MobileDashboard` - Mobil-dashboard med store knapper
- `FriBefaringDialog` - Popup for å velge befaringstype
- `FriBefaringMain` - Hovedvisning for fri befaring
- `BefaringPunktList` - Liste over befaringspunkter
- `BefaringPunktDetail` - Detaljvisning for punkt
- `OppgaveDialog` - Opprett/rediger oppgaver
- `SignaturDialog` - Canvas-signatur komponent
- `PDFGenerator` - PDF-rapport generering

### **Integrasjon med eksisterende:**
- Prosjekt-detalj side (ny "Befaringer" seksjon)
- Foto-bibliotek (befaringsbilder)
- Eksisterende befaring-modul (popup valg)
- min/uke (eksisterende funksjonalitet)

## 🔗 **INTEGRASJON MED EKSISTERENDE BEFARINGSMODUL:**

### **NÅVÆRENDE BEFARINGSMODUL (Med Plantegning):**
```
befaringer (hoved-tabell)
  ├─ plantegninger (flere per befaring)
  │    └─ oppgaver (med x,y koordinater på plantegning)
  └─ underleverandorer (delt på org-nivå)
```

### **NY FRI BEFARINGSMODUL:**
```
fri_befaringer (hoved-tabell)
  ├─ befaring_punkter (flere per befaring)
  │    └─ befaring_oppgaver (uten koordinater)
  └─ befaring_signaturer (canvas-signatur)
```

### **INTEGRASJONSPUNKTER:**

#### **1. Popup Dialog for Befaringstype:**
- Bruker velger mellom "Befaring med plantegning" eller "Fri befaring"
- **Untagged befaring:** Kan opprettes uten prosjektnummer
- **Prosjekt-befaring:** Kobles til eksisterende prosjekt
- **Flytt-funksjonalitet:** Untagged befaringsrapporter kan senere flyttes til prosjekt
- Samme prosjekt kan ha begge typer befaringsrapporter
- Delte komponenter hvor mulig (underleverandører, prosjekt-info)

#### **2. Prosjekt-detalj Side:**
- Ny "Befaringer" seksjon som viser begge typer
- Kategorisert visning: "Med plantegning" vs "Fri befaring"
- Integrert med foto-bibliotek

#### **3. Mobil-dashboard:**
- "Ny befaring" knapp åpner popup for valg av type
- "Befaringer" viser begge typer i samme liste
- Delte funksjoner (bilder, oppgaver, kontakter)

#### **4. Delte Ressurser:**
- **Underleverandører** - samme tabell for begge moduler
- **Prosjekt-info** - samme ttx_project_cache
- **Brukerprofiler** - samme profiles tabell
- **Foto-bibliotek** - oppgave_bilder støtter begge moduler

#### **5. Untagged Befaringsrapporter:**
- **Opprett uten prosjekt:** `tripletex_project_id = NULL`
- **Flytt til prosjekt:** Senere kobling via "Flytt til prosjekt" funksjonalitet
- **Vis i egen seksjon:** "Untagged befaringsrapporter" i dashboard
- **Prosjekt-valg:** Dropdown for å velge prosjekt ved flytting
- **Audit-logging:** Logg alle flytt-operasjoner

### **SKILLE-LINJER:**

#### **Befaring med Plantegning:**
- Oppgaver har x,y koordinater på plantegning
- Interaktiv plantegning med klikk for å opprette oppgaver
- Oppgaver er knyttet til spesifikke punkter på plantegning
- Tekstbasert signatur (signatur_navn, signatur_dato, signatur_rolle)

#### **Fri Befaring:**
- Oppgaver er knyttet til befaringspunkter (uten koordinater)
- Enkel liste-struktur med punkter og oppgaver
- Canvas-signatur med integritet og hash
- Immutable snapshots for versjonering

## 🔗 **INTEGRASJON MED EKSISTERENDE SYSTEM:**

### **Prosjekt-detalj side:**
- Ny "Befaringer" seksjon
- Viser begge typer befaringsrapporter
- Integrert med foto-bibliotek

### **Foto-bibliotek:**
- Befaringsbilder vises i kategorisert struktur
- Kobling via `befaring_punkt_id`

### **Eksisterende befaring-modul:**
- Popup dialog for valg av befaringstype
- Delte komponenter hvor mulig

### **Mobil-dashboard:**
- Ny hovedmeny med store knapper
- Enkel navigasjon for håndverkeren i felt
- Touch-vennlig interface

## 📊 **PRIORITERING:**

### **Høy prioritet (Fase 1):**
1. Database migrasjoner
2. Mobil-dashboard
3. Befaringspunkter
4. Bilde-håndtering
5. Grunnleggende oppgave-funksjonalitet

### **Medium prioritet (Fase 2):**
6. Signatur-system
7. PDF-rapport
8. Versjonering
9. Admin-funksjoner

### **Lav prioritet (Fase 3):**
10. E-post svar
11. Testing og optimalisering

## 🚨 **GO/NO-GO SJEKKLISTE (ChatGPT-anbefalt):**

### **Produksjonsklarhet - MÅ VÆRE OK:**
- [ ] **RLS testet** - Annen org ser 0 rader på alle befaring-ressurser
- [ ] **Signatur låser** - Befaring kan ikke endres etter signering
- [ ] **Snapshot + hash verifiserbar** - PDF bygger fra snapshot, hash matcher
- [ ] **Gjenåpning krever admin + begrunnelse** - Versjon bump + audit logges
- [ ] **Tokens er single-use og utløper** - Offentlig visning krever gyldig token
- [ ] **Keyset-pagination uten duplikater** - Lister responderer < 300ms
- [ ] **Indekser dekker typiske WHERE/ORDER** - Ytelse er optimalisert
- [ ] **Inbound e-post flyt fungerer** - Med DKIM/SPF/DMARC klarering
- [ ] **Ytelse ok på mobil** - Liste, galleri, opplasting fungerer raskt

### **Status-regler (eksplisitte overganger):**
- [ ] **aktiv** → **signert** (via signering)
- [ ] **signert** → **aktiv** (kun admin + begrunnelse)
- [ ] **signert** → **arkivert** (kun admin)
- [ ] Blokker endringer på signerte (uten reopen)

## 🎯 **SUKSESSKRITIERIER:**

### **Fase 1 (MVP):**
- [ ] Brukere kan opprette fri befaringsrapporter
- [ ] Befaringspunkter kan håndteres enkelt
- [ ] Bilder kan lastes opp per punkt
- [ ] Grunnleggende oppgaver fungerer
- [ ] Mobil-dashboard er enkelt å bruke

### **Fase 2 (Avansert):**
- [ ] Befaringsrapporter kan signeres og låses
- [ ] PDF-rapporter kan genereres og lastes ned
- [ ] Admin kan gjenåpne signerte befaringsrapporter
- [ ] Befaringsrapporter kan kopieres
- [ ] Versjonering fungerer korrekt

### **Fase 3 (Enterprise):**
- [ ] E-post svar-funksjonalitet fungerer
- [ ] Omfattende testing er fullført
- [ ] Performance er optimalisert
- [ ] Mobil og desktop fungerer perfekt

## 📝 **NOTATER:**

- Start med grunnleggende funksjonalitet
- Bygg steg for steg
- Test hver fase grundig
- Fokus på brukervennlighet
- Integrer med eksisterende system
- Dokumenter alle endringer
- Ikke overkomplisere for håndverkeren i felt
- Mobil-dashboard må være enkelt og intuitivt

## 📱 **WIREFRAMES & PRINSIPPSKISSER (RESPONSIVT DESIGN):**

### **RESPONSIVT DESIGN PRINSIPP:**
- **Mobile First** - Designet starter med mobil
- **Desktop/Tablet** - Skalerer opp med flere kolonner og mer informasjon
- **Touch-vennlig** - Alle interaktive elementer minst 44x44px
- **Konsistent** - Samme funksjonalitet på alle enheter

### **BREAKPOINTS:**
- **Mobile:** < 768px (1 kolonne, store knapper)
- **Tablet:** 768px - 1024px (2 kolonner, medium knapper)
- **Desktop:** > 1024px (3+ kolonner, kompakt design)

---

## 📱 **1. MOBIL-DASHBOARD (8 hovedknapper) - RESPONSIVT**

### **Mobile Wireframe (< 768px):**
```
┌─────────────────────────────────────────┐
│  🏠 FieldNote                    ⚙️ 🔔  │
│  ──────────────────────────────────────  │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ ⏰          │  │ 📷          │      │
│  │ Min uke    │  │ Bilder      │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ 📋          │  │ ➕          │      │
│  │ Befaringer  │  │ Ny befaring │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ 📷          │  │ 📝          │      │
│  │ Nytt bilde  │  │ Oppgaver    │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ 📝          │  │ 👥          │      │
│  │ Sjekklister │  │ Kontakter   │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
└─────────────────────────────────────────┘
```

### **Desktop Wireframe (> 1024px):**
```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  🏠 FieldNote                                                                        ⚙️ 🔔  │
│  ──────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ ⏰          │  │ 📷          │  │ 📋          │  │ ➕          │  │ 📷          │      │
│  │ Min uke    │  │ Bilder      │  │ Befaringer  │  │ Ny befaring │  │ Nytt bilde  │      │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │ 📝          │  │ 📝          │  │ 👥          │  │            │                        │
│  │ Oppgaver    │  │ Sjekklister │  │ Kontakter   │  │            │                        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘                        │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### **Funksjonalitet:**
- **Mobile:** 2x4 grid (store knapper, touch-vennlig)
- **Desktop:** 5x2 grid (kompakt design, alle knapper synlige)

---

## 🔄 **2. POPUP DIALOG (Befaringstype-valg) - RESPONSIVT**

### **Mobile Wireframe (< 768px):**
```
┌─────────────────────────────────────────┐
│  Ny befaring                    ✕      │
│  ──────────────────────────────────────  │
│                                         │
│  Velg type befaring:                    │
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │ 🏗️                                │ │
│  │ Befaring med plantegning           │ │
│  │ Oppgaver med x,y koordinater       │ │
│  │ Interaktiv plantegning             │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │ 📋                                │ │
│  │ Fri befaring                      │ │
│  │ Enkel liste med punkter           │ │
│  │ Uten koordinater                  │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │        Fortsett                    │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### **Desktop Wireframe (> 1024px):**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Ny befaring                                                    ✕      │
│  ──────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Velg type befaring:                                                    │
│                                                                         │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────┐ │
│  │ 🏗️                                │  │ 📋                        │ │
│  │ Befaring med plantegning           │  │ Fri befaring              │ │
│  │                                     │  │                           │ │
│  │ • Oppgaver med x,y koordinater      │  │ • Enkel liste med punkter │ │
│  │ • Interaktiv plantegning            │  │ • Uten koordinater        │ │
│  │ • Klikk for å opprette oppgaver     │  │ • Canvas-signatur         │ │
│  │ • Tekstbasert signatur              │  │ • Immutable snapshots     │ │
│  └─────────────────────────────────────┘  └─────────────────────────────┘ │
│                                                                         │
│  📋 Prosjekt-tilknytning:                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🏗️ Koblet til prosjekt: [Huset på Højden ▼]                      │ │
│  │ 📋 Uten prosjekt (untagged)                                        │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                        Fortsett                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### **Funksjonalitet:**
- **Mobile:** Vertikal stack med store knapper
- **Desktop:** Side-ved-side med mer detaljert informasjon
- **Untagged-støtte:** Valg mellom prosjekt-tilknytning eller untagged

---

## 📋 **3. FRI BEFARING HOVEDVISNING - RESPONSIVT**

### **Mobile Wireframe (< 768px):**
```
┌─────────────────────────────────────────┐
│  ← Tilbake    Fri Befaring    ⚙️        │
│  ──────────────────────────────────────  │
│                                         │
│  📋 Befaring: "Kjøkkenrenovering"       │
│  📅 Dato: 22.01.2025                    │
│  🏗️ Prosjekt: "Huset på Højden"        │
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │ Status: Aktiv                      │ │
│  │ Versjon: 1.0                       │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  📝 Befaringspunkter (3):               │
│  ┌─────────────────────────────────────┐ │
│  │ 1. ✅ Elektrisk installasjon       │ │
│  │    📷 2 bilder  📝 1 oppgave       │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ 2. ⚠️ VVS-installasjon              │ │
│  │    📷 0 bilder  📝 2 oppgaver      │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ 3. ✅ Gulvlegging                  │ │
│  │    📷 1 bilde   📝 0 oppgaver      │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │        + Legg til punkt            │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │        📝 Signer befaring          │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### **Desktop Wireframe (> 1024px):**
```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ← Tilbake    Fri Befaring: "Kjøkkenrenovering"                                    ⚙️        │
│  ──────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                             │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────────────────────┐ │
│  │ 📋 Befaring: "Kjøkkenrenovering"    │  │ 📊 Statistikk:                                │ │
│  │ 📅 Dato: 22.01.2025                 │  │ ┌─────────┐ ┌─────────┐ ┌─────────┐          │ │
│  │ 🏗️ Prosjekt: "Huset på Højden"      │  │ │ 📝 3    │ │ 📷 3    │ │ 📋 3    │          │ │
│  │                                     │  │ │Punkter  │ │ Bilder  │ │Oppgaver │          │ │
│  │ ┌─────────────────────────────────┐ │  │ └─────────┘ └─────────┘ └─────────┘          │ │
│  │ │ Status: Aktiv                   │ │  │                                             │ │
│  │ │ Versjon: 1.0                    │ │  │ ┌─────────────────────────────────────────┐ │ │
│  │ │ Opprettet: 22.01.2025 14:30     │ │  │ │        📝 Signer befaring              │ │ │
│  │ └─────────────────────────────────┘ │  │ └─────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────┘  └─────────────────────────────────────────────────┘ │
│                                                                                             │
│  📝 Befaringspunkter:                                                                      │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────────────────────┐ │
│  │ 1. ✅ Elektrisk installasjon       │  │ 2. ⚠️ VVS-installasjon                        │ │
│  │    📷 2 bilder  📝 1 oppgave       │  │    📷 0 bilder  📝 2 oppgaver                 │ │
│  │    🕒 Opprettet: 22.01.2025        │  │    🕒 Opprettet: 22.01.2025                   │ │
│  └─────────────────────────────────────┘  └─────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────────────────────┐ │
│  │ 3. ✅ Gulvlegging                  │  │ ┌─────────────────────────────────────────┐     │ │
│  │    📷 1 bilde   📝 0 oppgaver      │  │ │        + Legg til punkt                │     │ │
│  │    🕒 Opprettet: 22.01.2025        │  │ └─────────────────────────────────────────┘     │ │
│  └─────────────────────────────────────┘  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### **Funksjonalitet:**
- **Mobile:** Vertikal stack med full bredde
- **Desktop:** 2-kolonne layout med statistikk og hurtighandlinger

---

## 🏗️ **UNTAGGED BEFARINGSRAPPORTER DASHBOARD:**

### **Desktop Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ← Tilbake    Untagged Befaringsrapporter                                                      │
│  ──────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                             │
│  ⚠️ Befaringsrapporter uten prosjekt-tilknytning                                           │
│                                                                                             │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────────────────────┐ │
│  │ 📋 Kjøkkenrenovering                │  │ 📋 Badrenovering                              │ │
│  │ 📅 22.01.2025                       │  │ 📅 21.01.2025                                 │ │
│  │ 👤 Kristian Walberg                 │  │ 👤 Kristian Walberg                           │ │
│  │ 📝 3 punkter  📷 5 bilder           │  │ 📝 2 punkter  📷 3 bilder                    │ │
│  │                                     │  │                                               │ │
│  │ ┌─────────────────────────────────┐ │  │ ┌─────────────────────────────────────────┐ │ │
│  │ │        🏗️ Flytt til prosjekt   │ │  │ │        🏗️ Flytt til prosjekt           │ │ │
│  │ └─────────────────────────────────┘ │  │ └─────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────┘  └─────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────────────────────┐ │
│  │ 📋 Takarbeid                        │  │ ┌─────────────────────────────────────────┐     │ │
│  │ 📅 20.01.2025                       │  │ │        + Ny untagged befaring           │     │ │
│  │ 👤 Kristian Walberg                 │  │ └─────────────────────────────────────────┘     │ │
│  │ 📝 1 punkt   📷 2 bilder            │  │                                               │ │
│  │                                     │  │                                               │ │
│  │ ┌─────────────────────────────────┐ │  │                                               │ │
│  │ │        🏗️ Flytt til prosjekt   │ │  │                                               │ │
│  │ └─────────────────────────────────┘ │  │                                               │ │
│  └─────────────────────────────────────┘  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### **Funksjonalitet:**
- **Vis untagged befaringsrapporter** uten prosjekt-tilknytning
- **Flytt til prosjekt** funksjonalitet med dropdown
- **Opprett ny untagged** befaring
- **Audit-logging** for alle flytt-operasjoner

---

**Dato opprettet:** 22. januar 2025  
**Status:** Unified Plan med Wireframes  
**Neste steg:** Start med FASE 1 - STEG 1: Database & Struktur
