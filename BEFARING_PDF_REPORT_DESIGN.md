# PDF-rapporter for Befaringer - Design & Implementering

**Dato:** 23. oktober 2025  
**Status:** Planlagt  
**Estimat:** 8-12 timer

---

## 🎯 **OVERVIEW**

Brukere skal kunne generere profesjonelle PDF-rapporter fra befaringer. 

**To typer befaringer:**

1. **Befaring med plantegning** (standard):
   - Plantegning med oppgaver og koordinater
   - Bilder tilknyttet hver oppgave
   - Komplett kart med x,y-koordinater

2. **Fri befaring** (uten plantegning):
   - Enkel liste med befaringspunkter
   - Bilder per punkt
   - Ingen koordinater (punkt-liste basert)

Rapporten skal tilpasse seg automatisk basert på befaringstype.

---

## 📐 **WIREFRAME & LAYOUT**

### **Forside (Cover Page)**
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                  [FieldNote Logo]                      │
│                                                        │
│         BEFARINGSRAPPORT                               │
│                                                        │
│  Type: Forbefaring                                     │
│  Dato: 26. oktober 2025                                │
│  Prosjekt: Råholt skole - #11                         │
│                                                        │
│  Utført av:                                            │
│  ──────────────────                                    │
│    Kristian Walberg                                    │
│    prosjektleder@wbprosjekt.no                         │
│                                                        │
│  Lokasjon:                                             │
│    Råholt 1, 2010 Ski                                  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### **Innholdsfortegnelse**
```
┌────────────────────────────────────────────────────────┐
│  INNHOLDSFORTEGNELSE                                    │
│                                                        │
│  1. Executive Summary ............................. 2   │
│  2. Plantegning - 1. etasje ...................... 3   │
│     - Oppgave #1 (Malerarbeid - Åpen)                   │
│     - Oppgave #2 (Rørlegger - Lukket)                   │
│  3. Plantegning - 2. etasje ...................... 4   │
│     - Oppgave #3 (Elektro - Under arbeid)               │
│  4. Bilder og dokumentasjon ...................... 6   │
│  5. Signatur ...................................... 8   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### **Executive Summary**
```
┌────────────────────────────────────────────────────────┐
│  EXECUTIVE SUMMARY                                      │
│                                                        │
│  Total oppgaver: 6                                      │
│  ├─ Åpne: 2                                            │
│  ├─ Under arbeid: 1                                    │
│  └─ Lukket: 3                                           │
│                                                        │
│  Estimert kostnad: 45.000 kr                            │
│  Faktisk kostnad: 38.500 kr                             │
│                                                        │
│  Kritisk funn:                                          │
│    - Leakage i rørlegger i 2. etasje                   │
│    - Krever umiddelbar oppfølging                       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### **Plantegning med Oppgaver**
```
┌────────────────────────────────────────────────────────┐
│  PLANTEGNING - 1. ETASJE                               │
│                                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │                                                │  │
│  │          [Plantegning PDF bilde]               │  │
│  │                                                │  │
│  │          ● Oppgave #1                         │  │
│  │          ● Oppgave #2                         │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
│                                                        │
│  OPPGAVER PÅ DENNE PLANLEGGINGEN:                     │
│                                                        │
│  #1 - MALERARBEID (Åpen)                               │
│  Koordinater: x: 245, y: 180                           │
│  Fag: Maler                                            │
│  Prioritet: Høy                                         │
│  Status: Åpen                                          │
│  Estimert kostnad: 15.000 kr                            │
│                                                        │
│  Beskrivelse:                                          │
│  Stue og gang må males. Fargekode: RAL 9010             │
│                                                        │
│  [2 bilder] ──────────────────────────────             │
│  ┌──────┐  ┌──────┐                                   │
│  │Før   │  │Etter │                                   │
│  └──────┘  └──────┘                                   │
│                                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│  #2 - RØRLEGGER (Lukket)                               │
│  [samme struktur...]                                    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### **Signatur Side**
```
┌────────────────────────────────────────────────────────┐
│  SIGNATUR OG DOKUMENTASJON                             │
│                                                        │
│  Befaring godkjent av:                                 │
│                                                        │
│  ────────────────────────────────────────────         │
│    Klientnavn                                          │
│    26. oktober 2025                                    │
│                                                        │
│  ────────────────────────────────────────────         │
│    Byggherre                                           │
│    26. oktober 2025                                    │
│                                                        │
│                                                        │
│  TEKNISK GODKJENNELSE:                                 │
│                                                        │
│  ────────────────────────────────────────────         │
│    Prosjektleder                                       │
│    26. oktober 2025                                    │
│                                                        │
│                                                        │
│  Generert av FieldNote                                  │
│  www.fieldnote.no                                       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### **Fri Befaring - Punkt-liste struktur (uten plantegning)**

```
┌────────────────────────────────────────────────────────┐
│  BEFARINGSPUNKTER                                      │
│                                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │  #1 - Lokal undersøkelse (Åpen)                │  │
│  │                                                  │  │
│  │  [Bilde 1]    [Bilde 2]                        │  │
│  │  (Før.jpg)    (Etter.jpg)                       │  │
│  │                                                  │  │
│  │  Beskrivelse:                                    │  │
│  │  Dette er et kritisk punkt som krever           │  │
│  │  umiddelbar oppmerksomhet.                        │  │
│  │                                                  │  │
│  │  Opprettet: 26.10.2025                          │  │
│  │  Fag: Elektro                                    │  │
│  │  Prioritet: Høy                                  │  │
│  └────────────────────────────────────────────────┘  │
│                                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │  #2 - Ventil tjekking (Lukket)                  │  │
│  │                                                  │  │
│  │  [Bilde 1]                                       │  │
│  │  (Test.jpg)                                      │  │
│  │                                                  │  │
│  │  Beskrivelse:                                    │  │
│  │  Alle ventilene er sjekket og fungerer          │  │
│  │  normalt. Ingen lekker funnet.                   │  │
│  │                                                  │  │
│  │  Opprettet: 26.10.2025                          │  │
│  │  Lukket: 28.10.2025                             │  │
│  └────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 🔧 **TEKNISK IMPLEMENTERING**

### **1. PDF-generering Library**

**Valg:** `@react-pdf/renderer` eller `jsPDF` + `html2canvas`

**Anbefaling:** `@react-pdf/renderer`
- ✅ React-native syntax
- ✅ Server-side rendering support
- ✅ Bra dokumentasjon
- ✅ Støtter bilder og komplekse layouts

```bash
npm install @react-pdf/renderer
```

### **2. Komponent-struktur**

```
src/
  components/
    befaring/
      reports/
        BefaringReportPDF.tsx          # Hovedrapport-komponent (determiner type)
        CoverPage.tsx                  # Forside
        TableOfContents.tsx            # Innholdsfortegnelse
        
        # Standard befaring (med plantegning)
        StandardReportLayout.tsx       # Wrapper for standard befaring
        PlantegningPage.tsx            # Plantegning + oppgaver med koordinater
        
        # Fri befaring (uten plantegning)
        FriBefaringReportLayout.tsx    # Wrapper for fri befaring
        BefaringspunktListe.tsx        # List med befaringspunkter
        
        # Shared
        ExecutiveSummary.tsx           # Oppsummering
        BildgalleriPage.tsx             # Bilder-seksjon
        SignaturPage.tsx                # Signatur-side
        ReportStyles.tsx                # Styling
```

### **3. Backend/Supabase Edge Function**

```typescript
// supabase/functions/generate-befaring-pdf/index.ts

import { createClient } from '@supabase/supabase-js';

interface BefaringData {
  befaring: any;
  type: 'standard' | 'fri_befaring';
  
  // Standard befaring
  oppgaver?: any[];
  plantegninger?: any[];
  
  // Fri befaring
  befaringspunkter?: any[];
}

export async function generatePDFReport(befaringId: string): Promise<Blob> {
  // 1. Hent befaring og bestem type
  const { data: befaring } = await supabase
    .from('befaringer')
    .select('*')
    .eq('id', befaringId)
    .single();
  
  const isFriBefaring = !befaring.tripletex_project_id; // Fri befaring has no project
  
  let data: BefaringData;
  
  if (isFriBefaring) {
    // Fri befaring - hent punkter
    const { data: punkter } = await supabase
      .from('fri_befaringer')
      .select(`
        *,
        befaringspunkter (
          *,
          befaring_punkt_bilder (*)
        )
      `)
      .eq('id', befaringId)
      .single();
    
    data = {
      befaring,
      type: 'fri_befaring',
      befaringspunkter: punkter?.befaringspunkter || []
    };
  } else {
    // Standard befaring - hent plantegninger og oppgaver
    const { data: plantegningsData } = await supabase
      .from('befaringer')
      .select(`
        *,
        plantegninger (
          *,
          oppgaver (
            *,
            oppgave_bilder (*)
          )
        )
      `)
      .eq('id', befaringId)
      .single();
    
    data = {
      befaring,
      type: 'standard',
      oppgaver: plantegningsData?.oppgaver || [],
      plantegninger: plantegningsData?.plantegninger || []
    };
  }

  // 2. Generer PDF med @react-pdf/renderer (conditional rendering)
  // 3. Returner som blob
  
  return pdfBlob;
}
```

### **4. Frontend-integrasjon**

```tsx
// src/components/befaring/BefaringDetail.tsx

const [generatingPDF, setGeneratingPDF] = useState(false);

const handleGeneratePDF = async () => {
  setGeneratingPDF(true);
  
  try {
    // Option 1: Server-side generation (anbefalt)
    const { data, error } = await supabase.functions.invoke(
      'generate-befaring-pdf',
      { body: { befaringId } }
    );
    
    if (error) throw error;
    
    // Download PDF
    const blob = new Blob([data.pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `befaring-${befaringId}.pdf`;
    link.click();
    
    // Option 2: Client-side generation (for testing)
    // const pdfDoc = await generateClientPDF(befaringData);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    toast({
      title: 'Feil',
      description: 'Kunne ikke generere PDF',
      variant: 'destructive'
    });
  } finally {
    setGeneratingPDF(false);
  }
};

// In UI:
<Button 
  onClick={handleGeneratePDF}
  disabled={generatingPDF}
>
  {generatingPDF ? 'Genererer...' : 'PDF-rapport'}
</Button>
```

---

## 📋 **FEATURES**

### **Phase 1: Basic Report (4 timer)**

**Standard Befaring (med plantegning):**
- ✅ Forside med logo og metadata
- ✅ Innholdsfortegnelse
- ✅ Executive summary (antall oppgaver, status)
- ✅ Plantegning med koordinater
- ✅ Oppgaveliste per plantegning med x,y
- ✅ PDF download

**Fri Befaring (uten plantegning):**
- ✅ Forside med logo og metadata
- ✅ Innholdsfortegnelse
- ✅ Executive summary (antall punkter, status)
- ✅ Befaringspunkter som liste (ingen koordinater)
- ✅ Bilder per punkt
- ✅ PDF download

### **Phase 2: Bilder (2 timer)**
- ✅ Bilder per oppgave
- ✅ Thumbnails i oppgave-listen
- ✅ Bildgalleri-side med høy oppløsning
- ✅ Før/etter-kategorisering

### **Phase 3: Signatur (2 timer)**
- ✅ Signatur-felt (tekstbasert)
- ✅ Dato-stempling
- ✅ Rolle-indikator (klient, prosjektleder, byggherre)
- ✅ Multi-signatur support

### **Phase 4: Kostnader (2 timer)**
- ✅ Estimert kostnad per oppgave
- ✅ Faktisk kostnad
- ✅ Total kostnad beregning
- ✅ Avvik-analyse

### **Phase 5: Advanced (2 timer)**
- ✅ E-post utsending (fra `rapport_mottakere`)
- ✅ Vannmerke
- ✅ PDF/A-standard for arkivering
- ✅ Batch-generering (flere befaringer)

---

## 🎨 **DESIGN TOKENS**

```typescript
// src/components/befaring/reports/ReportStyles.tsx

export const ReportStyles = {
  colors: {
    primary: '#0066CC',
    secondary: '#666666',
    accent: '#FF6B35',
    background: '#FFFFFF',
    text: '#333333',
    border: '#E0E0E0'
  },
  
  fonts: {
    heading: 'Inter, sans-serif',
    body: 'Inter, sans-serif',
    mono: 'Courier, monospace'
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  
  sizes: {
    page: {
      width: 595.28,  // A4
      height: 841.89
    },
    margin: 40,
    headerHeight: 80,
    footerHeight: 40
  }
};
```

---

## 🚀 **NESTE STEG**

1. **Install dependencies:**
   ```bash
   npm install @react-pdf/renderer
   ```

2. **Create report components**
3. **Test with sample data**
4. **Integrate with BefaringDetail**
5. **Add Edge Function for server-side**
6. **Implement email sending**

---

## 📝 **NOTATER**

- PDF skal være print-klar (CMYK for print)
- Støtte for norsk bokstav-encoding (æ, ø, å)
- Bilder må komprimeres for små filstørrelser
- Consider cloud storage for generated PDFs
- Cache generated PDFs to avoid regeneration

