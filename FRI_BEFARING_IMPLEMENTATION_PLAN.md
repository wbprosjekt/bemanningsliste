# FRI BEFARING IMPLEMENTATION PLAN

## 🎯 **MÅL:**
Implementere "Fri befaring" modul som supplement til eksisterende "Befaring med plantegning" modul.

## 📋 **KOMPLETT FUNKSJONALITET:**

### **1. SIGNATUR-FUNKSJONALITET (Canvas):**
- Enkel canvas for signatur
- Fullt navn + signatur
- Automatisk dato og klokkeslett
- Låsing av befaring etter signering

### **2. E-POST FUNKSJONALITET:**
- Send oppgaver på e-post til underleverandører
- E-post med svar-mulighet
- PDF vedlegg valgfritt
- Token-basert ekstern tilgang

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

### **5. VERSJONERING OG KOPIERING:**
- Automatisk versjonering ved endringer
- Kopier befaring til ny befaring
- Kopier til samme eller annet prosjekt
- Historikk over alle versjoner

## 🗄️ **DATABASE-STRUKTUR:**

```sql
-- Fri befaringsmodul
CREATE TABLE fri_befaringer (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES organizations(id),
  tripletex_project_id integer REFERENCES ttx_project_cache(tripletex_project_id),
  title text NOT NULL,
  description text,
  befaring_date date,
  status text DEFAULT 'aktiv', -- aktiv, signert, arkivert
  version text DEFAULT '1.0',
  parent_befaring_id uuid REFERENCES fri_befaringer(id), -- For kopiering
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Befaringspunkter
CREATE TABLE befaring_punkter (
  id uuid PRIMARY KEY,
  fri_befaring_id uuid REFERENCES fri_befaringer(id) ON DELETE CASCADE,
  punkt_nr integer NOT NULL,
  tittel text NOT NULL,
  beskrivelse text,
  status text DEFAULT 'åpen', -- åpen, lukket
  created_at timestamptz DEFAULT now()
);

-- Oppgaver for befaringpunkter
CREATE TABLE befaring_oppgaver (
  id uuid PRIMARY KEY,
  befaring_punkt_id uuid REFERENCES befaring_punkter(id) ON DELETE CASCADE,
  tittel text NOT NULL,
  beskrivelse text,
  tildelt_til uuid REFERENCES profiles(id),
  epost text,
  frist date,
  status text DEFAULT 'åpen', -- åpen, påbegynt, fullført
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Signaturer (med versjonering)
CREATE TABLE befaring_signaturer (
  id uuid PRIMARY KEY,
  fri_befaring_id uuid REFERENCES fri_befaringer(id) ON DELETE CASCADE,
  version text NOT NULL,
  fullt_navn text NOT NULL,
  signatur_data text, -- Base64 encoded signature
  signatur_dato timestamptz DEFAULT now(),
  ip_adresse text,
  user_agent text
);

-- E-post tokens for oppgaver (med svar-mulighet)
CREATE TABLE befaring_oppgave_tokens (
  id uuid PRIMARY KEY,
  befaring_oppgave_id uuid REFERENCES befaring_oppgaver(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now()
);

-- E-post svar og kommentarer
CREATE TABLE befaring_oppgave_svar (
  id uuid PRIMARY KEY,
  befaring_oppgave_id uuid REFERENCES befaring_oppgaver(id) ON DELETE CASCADE,
  token text, -- Fra e-post
  svar_tekst text,
  vedlegg_url text, -- For bilder/dokumenter
  svar_dato timestamptz DEFAULT now(),
  ip_adresse text
);

-- Utvid oppgave_bilder for befaringpunkter
ALTER TABLE oppgave_bilder 
ADD COLUMN befaring_punkt_id uuid REFERENCES befaring_punkter(id);
```

## 🚀 **IMPLEMENTERING - STEG FOR STEG:**

### **STEG 1: GRUNNLEGGENDE STRUKTUR**
- [ ] Database migrasjoner
- [ ] Grunnleggende komponenter
- [ ] "Ny befaring" popup dialog
- [ ] Fri befaring hovedvisning

### **STEG 2: BEFARINGSPUNKTER**
- [ ] Legg til/rediger/fjern punkter
- [ ] Beskrivelser per punkt
- [ ] Status (åpen/lukket)

### **STEG 3: BILDE-HÅNDTERING**
- [ ] Last opp bilder per punkt
- [ ] Bilde-galleri per punkt
- [ ] Integrasjon med eksisterende oppgave_bilder

### **STEG 4: OPPGAVE-FUNKSJONALITET**
- [ ] Opprett oppgaver per punkt
- [ ] Tildel til underleverandører
- [ ] E-post sending med tokens

### **STEG 5: SIGNATUR-SYSTEM**
- [ ] Canvas-signatur komponent
- [ ] Signatur lagring og validering
- [ ] Låsing av befaring

### **STEG 6: PDF-RAPPORT**
- [ ] PDF-generering
- [ ] FieldNote branding
- [ ] Nedlasting og e-post sending

### **STEG 7: VERSJONERING**
- [ ] Automatisk versjonering
- [ ] Historikk og endringslogg
- [ ] Kopier-funksjonalitet

### **STEG 8: ADMIN-FUNKSJONER**
- [ ] Gjenåpne signerte befaringsrapporter
- [ ] Admin-tilgangskontroll
- [ ] Grunn for gjenåpning

### **STEG 9: E-POST SVAR**
- [ ] E-post svar-funksjonalitet
- [ ] Vedlegg i svar
- [ ] Integrasjon med oppgave-system

### **STEG 10: TESTING OG OPTIMALISERING**
- [ ] Omfattende testing
- [ ] Performance optimalisering
- [ ] Brukervennlighet forbedringer

## 📱 **UI/UX KOMPONENTER:**

### **Hovedkomponenter:**
- `FriBefaringDialog` - Popup for å velge befaringstype
- `FriBefaringMain` - Hovedvisning for fri befaring
- `BefaringPunktList` - Liste over befaringspunkter
- `BefaringPunktDetail` - Detaljvisning for punkt
- `OppgaveDialog` - Opprett/rediger oppgaver
- `SignaturDialog` - Canvas-signatur komponent
- `PDFGenerator` - PDF-rapport generering
- `Versjonering` - Versjon og historikk visning

### **Integrasjon med eksisterende:**
- Prosjekt-detalj side (ny "Befaringer" seksjon)
- Foto-bibliotek (befaringsbilder)
- Eksisterende befaring-modul (popup valg)

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

## 📊 **PRIORITERING:**

### **Høy prioritet (Fase 1):**
1. Grunnleggende struktur
2. Befaringspunkter
3. Bilde-håndtering
4. Grunnleggende oppgave-funksjonalitet

### **Medium prioritet (Fase 2):**
5. Signatur-system
6. PDF-rapport
7. Versjonering

### **Lav prioritet (Fase 3):**
8. Admin-funksjoner
9. E-post svar
10. Avanserte funksjoner

## 🎯 **SUKSESSKRITIERIER:**

- [ ] Brukere kan opprette fri befaringsrapporter
- [ ] Befaringspunkter kan håndteres enkelt
- [ ] Bilder kan lastes opp per punkt
- [ ] Oppgaver kan sendes på e-post
- [ ] Befaringsrapporter kan signeres og låses
- [ ] PDF-rapporter kan genereres og lastes ned
- [ ] Admin kan gjenåpne signerte befaringsrapporter
- [ ] Befaringsrapporter kan kopieres
- [ ] Versjonering fungerer korrekt

## 📝 **NOTATER:**

- Start med grunnleggende funksjonalitet
- Bygg steg for steg
- Test hver fase grundig
- Fokus på brukervennlighet
- Integrer med eksisterende system
- Dokumenter alle endringer

---

**Dato opprettet:** 22. januar 2025  
**Status:** Planlagt  
**Neste steg:** Start med STEG 1 - Grunnleggende struktur










