# FRI BEFARING IMPLEMENTATION PLAN - FINAL

## 🎯 **MÅL:**
Implementere "Fri befaring" modul som supplement til eksisterende "Befaring med plantegning" modul med enterprise-klarhet og robust sikkerhet.

## 📋 **KOMPLETT FUNKSJONALITET:**

### **1. SIGNATUR-FUNKSJONALITET (Canvas + Integritet):**
- Canvas-signatur (enkel)
- Signatur-integritet med hash
- Automatisk dato og klokkeslett
- Låsing av befaring etter signering

### **2. E-POST FUNKSJONALITET:**
- Send oppgaver på e-post til underleverandører
- E-post med svar-mulighet (inbound webhook)
- PDF vedlegg valgfritt
- Single-use token-basert ekstern tilgang
- DKIM/SPF/DMARC klarering

### **3. PROFESJONELL PDF-RAPPORT:**
- FieldNote logo og branding
- Alle punkter med beskrivelser
- Bilder per punkt (thumbnail + full størrelse)
- Oppgaver og tildelinger
- Signatur og dato
- Nedlasting og e-post sending

### **4. ADMIN-TILGANG:**
- Kun admin kan gjenåpne signerte befaringsrapporter
- Grunn for gjenåpning må oppgis
- Versjonering oppdateres
- Full audit-logging

### **5. VERSJONERING OG KOPIERING:**
- Immutable snapshots (befaring_versions)
- Automatisk versjonering ved endringer
- Kopier befaring til ny befaring
- Kopier til samme eller annet prosjekt
- Historikk over alle versjoner

## 🗄️ **DATABASE-STRUKTUR (ENTERPRISE-READY):**

```sql
-- Fri befaringsmodul
==================
CREATE TABLE fri_befaringer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id),
  tripletex_project_id integer REFERENCES ttx_project_cache(tripletex_project_id),
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
==================
CREATE TABLE befaring_punkter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fri_befaring_id uuid REFERENCES fri_befaringer(id) ON DELETE CASCADE,
  punkt_nr integer NOT NULL,
  tittel text NOT NULL,
  beskrivelse text,
  status text DEFAULT 'åpen' CHECK (status IN ('åpen', 'lukket')),
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT uq_befaring_punkt_nr UNIQUE (fri_befaring_id, punkt_nr)
);

-- Oppgaver for befaringpunkter
==============================
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
  
  -- Constraints
  CONSTRAINT chk_owner_oneof CHECK (
    (tildelt_til IS NOT NULL AND epost IS NULL) OR
    (tildelt_til IS NULL AND epost IS NOT NULL)
  )
);

-- Signaturer (med integritet)
============================
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
=====================================
CREATE TABLE befaring_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fri_befaring_id uuid REFERENCES fri_befaringer(id) ON DELETE CASCADE,
  version text NOT NULL,          -- "1.0", "1.1" osv.
  payload jsonb NOT NULL,         -- snapshot av hele befaringen (punkter, oppgaver, metadata)
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- E-post tokens (single-use + scope)
==================================
CREATE TABLE befaring_oppgave_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  befaring_oppgave_id uuid REFERENCES befaring_oppgaver(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  scope text DEFAULT 'reply' CHECK (scope IN ('view', 'reply', 'ack')),
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_token_not_expired CHECK (expires_at > now())
);

-- E-post svar og kommentarer
===========================
CREATE TABLE befaring_oppgave_svar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  befaring_oppgave_id uuid REFERENCES befaring_oppgaver(id) ON DELETE CASCADE,
  token text REFERENCES befaring_oppgave_tokens(token),
  svar_tekst text,
  vedlegg_url text, -- For bilder/dokumenter
  svar_dato timestamptz DEFAULT now(),
  ip_adresse text
);

-- Audit-logg for alle kritiske hendelser
======================================
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id),
  actor uuid REFERENCES auth.users(id),
  event_type text NOT NULL,       -- 'BEFARING_SIGNED','BEFARING_REOPENED','EMAIL_SENT','TOKEN_USED', ...
  entity tableoid,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- Utvid oppgave_bilder for befaringpunkter
=========================================
ALTER TABLE oppgave_bilder 
ADD COLUMN befaring_punkt_id uuid REFERENCES befaring_punkter(id);

-- Triggers for automatisk oppdatering
===================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fri_befaringer_set_updated_at
BEFORE UPDATE ON fri_befaringer
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indekser for ytelse
===================
CREATE INDEX idx_fri_befaringer_org ON fri_befaringer(org_id, status);
CREATE INDEX idx_befaring_punkter_befaring ON befaring_punkter(fri_befaring_id, punkt_nr);
CREATE INDEX idx_befaring_oppgaver_punkt ON befaring_oppgaver(befaring_punkt_id, status, frist);
CREATE INDEX idx_befaring_signaturer_bef ON befaring_signaturer(fri_befaring_id, version);
CREATE INDEX idx_oppgave_bilder_bef_punkt ON oppgave_bilder(befaring_punkt_id, inbox_date DESC);
CREATE INDEX idx_befaring_versions_bef ON befaring_versions(fri_befaring_id, version);
CREATE INDEX idx_audit_events_org ON audit_events(org_id, event_type, created_at DESC);
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

## 🚀 **IMPLEMENTERING - FASERT TILNÆRMING:**

### **FASE 1: MVP (Grunnleggende funksjonalitet)**
#### **STEG 1: GRUNNLEGGENDE STRUKTUR**
- [ ] Database migrasjoner (alle tabeller)
- [ ] Grunnleggende komponenter
- [ ] "Ny befaring" popup dialog (med/uten prosjekt)
- [ ] Fri befaring hovedvisning
- [ ] Mobil og desktop optimalisering

#### **STEG 2: MOBIL-DASHBOARD**
- [ ] Mobil-dashboard med store knapper
- [ ] 8 hovedknapper: Min uke, Bilder, Befaringer, Ny befaring, Nytt bilde, Oppgaver, Sjekklister, Kontakter
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

#### **STEG 5: BASIC OPPGAVE-FUNKSJONALITET**
- [ ] Opprett befaringsrapport-oppgaver per punkt
- [ ] Tildel til underleverandører
- [ ] Basic e-post sending
- [ ] Skille fra generelle prosjekt-oppgaver

### **FASE 2: ENTERPRISE-READY (ChatGPT forslag)**
#### **STEG 6: SIGNATUR-SYSTEM MED INTEGRITET**
- [ ] Canvas-signatur komponent
- [ ] Signatur-integritet med hash
- [ ] PNG-rendering av signatur
- [ ] Låsing av befaring
- [ ] Mobil og desktop signatur

#### **STEG 7: PDF-RAPPORT**
- [ ] PDF-generering
- [ ] FieldNote branding
- [ ] Nedlasting og e-post sending
- [ ] Signatur og integritet i PDF

#### **STEG 8: VERSJONERING MED SNAPSHOTS**
- [ ] Immutable snapshots (befaring_versions)
- [ ] Automatisk versjonering
- [ ] Historikk og endringslogg
- [ ] Kopier-funksjonalitet

#### **STEG 9: ADMIN-FUNKSJONER**
- [ ] Gjenåpne signerte befaringsrapporter
- [ ] Admin-tilgangskontroll
- [ ] Grunn for gjenåpning
- [ ] Full audit-logging

#### **STEG 10: E-POST SVAR OG SIKKERHET**
- [ ] E-post svar-funksjonalitet (inbound webhook)
- [ ] Single-use tokens
- [ ] Vedlegg i svar
- [ ] RLS på alle tabeller
- [ ] DKIM/SPF/DMARC klarering

### **FASE 3: AVANSERTE FUNKSJONER**
#### **STEG 11: YTELSE-OPTIMALISERING**
- [ ] Keyset-pagination
- [ ] Indekser for alle queries
- [ ] Begrense select *
- [ ] Triggers for automatisk oppdatering

#### **STEG 12: OFFLINE-STØTTE**
- [ ] Local cache for offline-bruk
- [ ] Kø for bildeopplasting
- [ ] Synkronisering ved tilkobling

#### **STEG 13: AVANSERTE RAPPORTER**
- [ ] Befaring-statistikk
- [ ] Trend-analyse
- [ ] Sammenligning mellom befaringsrapporter
- [ ] Dashboard for befaringsrapporter

#### **STEG 14: INTEGRASJONER**
- [ ] Tripletex-integrasjon
- [ ] E-post provider (Resend/Sendgrid)
- [ ] Webhook-endepunkter

#### **STEG 15: TESTING OG OPTIMALISERING**
- [ ] Omfattende testing
- [ ] Performance optimalisering
- [ ] Brukervennlighet forbedringer
- [ ] Mobil og desktop testing
- [ ] Sikkerhetstesting

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
- `Versjonering` - Versjon og historikk visning
- `AuditLog` - Audit-log visning

### **Integrasjon med eksisterende:**
- Prosjekt-detalj side (ny "Befaringer" seksjon)
- Foto-bibliotek (befaringsbilder)
- Eksisterende befaring-modul (popup valg)
- min/uke (eksisterende funksjonalitet)

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

## 🔒 **SIKKERHET OG RLS:**

### **RLS-policies for alle tabeller:**
- `fri_befaringer` - Kun samme org kan lese/redigere
- `befaring_punkter` - Via befaring-org
- `befaring_oppgaver` - Via punkt-org
- `befaring_signaturer` - Via befaring-org
- `befaring_versions` - Via befaring-org
- `befaring_oppgave_tokens` - Via oppgave-org
- `befaring_oppgave_svar` - Via oppgave-org
- `audit_events` - Kun samme org kan lese

### **Offentlig rute for token-bruk:**
- Validerer token (ikke RLS)
- Begrenser felt-tilgang
- Single-use tokens
- Automatisk utløp

## 📊 **PRIORITERING:**

### **Høy prioritet (Fase 1):**
1. Grunnleggende struktur
2. Mobil-dashboard
3. Befaringspunkter
4. Bilde-håndtering
5. Grunnleggende oppgave-funksjonalitet

### **Medium prioritet (Fase 2):**
6. Signatur-system med integritet
7. PDF-rapport
8. Versjonering med snapshots
9. Admin-funksjoner
10. E-post svar og sikkerhet

### **Lav prioritet (Fase 3):**
11. Ytelse-optimalisering
12. Offline-støtte
13. Avanserte rapporter
14. Integrasjoner
15. Testing og optimalisering

## 🎯 **SUKSESSKRITIERIER:**

### **Fase 1 (MVP):**
- [ ] Brukere kan opprette fri befaringsrapporter
- [ ] Befaringspunkter kan håndteres enkelt
- [ ] Bilder kan lastes opp per punkt
- [ ] Grunnleggende oppgaver fungerer
- [ ] Mobil-dashboard er enkelt å bruke

### **Fase 2 (Enterprise):**
- [ ] Signatur låser rapport; content_hash matcher ved verifikasjon
- [ ] Gjenåpning krever admin + grunn; versjon bump logges i audit
- [ ] PDF bygger fra snapshot og merkes riktig ved gjenåpning
- [ ] Token er single-use + utløper; offentlig rute slipper ikke data uten gyldig token
- [ ] E-post reply lander i befaring_oppgave_svar via inbound-webhook
- [ ] RLS: bruker fra annen org får 0 rader på alle befaring-ressurser

### **Fase 3 (Avansert):**
- [ ] Keyset-pagination uten duplikater; lister responderer < 300 ms
- [ ] Indekser dekker typiske WHERE/ORDER-mønstre
- [ ] Offline-støtte fungerer ved dårlig dekning
- [ ] Avanserte rapporter genereres raskt
- [ ] Integrasjoner fungerer stabilt

## 📝 **NOTATER:**

- Start med grunnleggende funksjonalitet
- Bygg steg for steg
- Test hver fase grundig
- Fokus på brukervennlighet
- Integrer med eksisterende system
- Dokumenter alle endringer
- Ikke overkomplisere for håndverkeren i felt
- Mobil-dashboard må være enkelt og intuitivt
- Enterprise-klarhet og sikkerhet er kritisk
- Implementer det riktig fra start

---

**Dato opprettet:** 22. januar 2025  
**Status:** Planlagt  
**Neste steg:** Start med FASE 1 - STEG 1: Grunnleggende struktur
