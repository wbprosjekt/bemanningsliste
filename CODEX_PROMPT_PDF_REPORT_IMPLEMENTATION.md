# Codex Prompt: Implement PDF Report Generation for Befaringer

## 🎯 **TASK**

Implement PDF report generation for the befaring module. Users should be able to click "PDF-rapport" button and download a professional PDF report of their befaring.

---

## 📋 **REQUIREMENTS**

### **1. Install Dependencies**
Install `@react-pdf/renderer` for PDF generation:
```bash
npm install @react-pdf/renderer
```

### **2. Support Two Befaring Types**

#### **A. Standard Befaring (med plantegning)**
- Shows plantegning PDF with task markers
- Lists all oppgaver with x,y coordinates
- Images for each oppgave
- Coordinates displayed

#### **B. Fri Befaring (uten plantegning)**
- Lists befaringspunkter as text
- Images per punkt
- No coordinates (just point list)

**Auto-detect type** by checking if `tripletex_project_id` exists:
- Has project → Standard befaring
- No project → Fri befaring

---

## 🏗️ **IMPLEMENTATION STRUCTURE**

### **Create Component Files:**

```
src/components/befaring/reports/
  ├─ BefaringReportPDF.tsx       # Main coordinator component
  ├─ CoverPage.tsx               # Forside with logo, metadata
  ├─ TableOfContents.tsx         # INNHOLDSFORTEGNELSE
  ├─ ExecutiveSummary.tsx        # Stats overview
  ├─ StandardReportLayout.tsx    # Standard befaring (med plantegning)
  ├─ FriBefaringReportLayout.tsx # Fri befaring (punkt liste)
  ├─ PlantegningPage.tsx         # Plantegning + oppgaver
  ├─ BefaringspunktListe.tsx     # Punkt-liste for fri befaring
  ├─ BildgalleriPage.tsx         # Image gallery
  ├─ SignaturPage.tsx            # Signature page
  └─ ReportStyles.tsx            # Shared styling constants
```

---

## 📐 **PDF STRUCTURE (4 pages minimum)**

### **Page 1: Cover Page**
- FieldNote logo
- "BEFARINGSRAPPORT" title
- Befaring type, date, project
- Performed by (name, email)
- Location (adresse, postnummer, sted)
- Footer: "Generert av FieldNote - www.fieldnote.no"

### **Page 2: Table of Contents & Executive Summary**
- Innholdsfortegnelse (topp)
- Executive Summary:
  - Total oppgaver/punkter
  - Status breakdown (Åpne, Under arbeid, Lukket)
  - Cost estimation (if available)
  - Critical findings alert box

### **Page 3+: Content Pages**

**For Standard Befaring:**
- Per plantegning:
  - Plantegning PDF image
  - List oppgaver on this plantegning
  - For each oppgave:
    - Task number, title, fag
    - Status badge
    - Description
    - Coordinates (x,y)
    - Images (thumbnails)
    - Estimat kostnad (if available)

**For Fri Befaring:**
- Per punkt:
  - Punkt number, title
  - Status badge
  - Description
  - Images
  - Created date
  - Fag

**Last Page: Signatur**
- "Befaring godkjent av" section
- Signature lines (Klient, Byggherre)
- Teknisk godkjenning line
- Footer with report ID

---

## 🔧 **TECHNICAL IMPLEMENTATION**

### **Step 1: Create Base Structure**

Create `src/components/befaring/reports/BefaringReportPDF.tsx`:

```tsx
'use client';

import { Document, Page, Text, View, PDFDownloadLink, StyleSheet } from '@react-pdf/renderer';
import { useState, useEffect } from 'react';

interface BefaringData {
  befaring: any;
  type: 'standard' | 'fri_befaring';
  oppgaver?: any[];
  plantegninger?: any[];
  befaringspunkter?: any[];
}

export default function BefaringReportPDF({ befaringId }: { befaringId: string }) {
  const [data, setData] = useState<BefaringData | null>(null);
  
  useEffect(() => {
    loadBefaringData();
  }, [befaringId]);
  
  const loadBefaringData = async () => {
    // 1. Fetch befaring
    // 2. Determine type (has tripletex_project_id?)
    // 3. Fetch plantegninger OR befaringspunkter
    // 4. Fetch oppgaver OR punkt images
    // 5. Set data
  };
  
  if (!data) return <div>Loading...</div>;
  
  return (
    <PDFDownloadLink 
      document={<ReportDocument data={data} />}
      fileName={`befaring-${befaringId}.pdf`}
    >
      {({ loading }) => (loading ? 'Genererer...' : 'Last ned PDF')}
    </PDFDownloadLink>
  );
}
```

### **Step 2: Implement Report Documents**

Create both report layouts that conditionally render based on type.

### **Step 3: Integrate with UI**

In `src/components/befaring/BefaringDetail.tsx`:

```tsx
import BefaringReportPDF from '@/components/befaring/reports/BefaringReportPDF';

// Replace existing button:
<Button onClick={() => setShowPDFDialog(true)}>
  <FileText className="h-4 w-4 mr-2" />
  PDF-rapport
</Button>

{showPDFDialog && (
  <Dialog open={showPDFDialog} onOpenChange={setShowPDFDialog}>
    <DialogContent>
      <BefaringReportPDF befaringId={befaringId} />
    </DialogContent>
  </Dialog>
)}
```

---

## 🎨 **STYLING (ReportStyles.tsx)**

```tsx
export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 5,
  },
  // ... more styles
});
```

---

## ✅ **ACCEPTANCE CRITERIA**

- [ ] Clicking "PDF-rapport" downloads a PDF
- [ ] PDF contains cover page with FieldNote logo
- [ ] PDF shows correct content based on befaring type
- [ ] Standard befaring shows plantegninger with coordinates
- [ ] Fri befaring shows punkt-liste without coordinates
- [ ] Images are embedded in PDF
- [ ] Signature page is included
- [ ] PDF is professionally formatted
- [ ] PDF is print-ready

---

## 🐛 **KNOWN ISSUES TO HANDLE**

1. **Large images:** Compress images before embedding
2. **Plantegning PDF:** May need special handling to render as image
3. **Long descriptions:** Use text wrapping
4. **Multiple images:** Consider pagination or scaling

---

## 📝 **NOTES**

- Wireframe and design already created in `BEFARING_PDF_WIREFRAME.html`
- Full design spec in `BEFARING_PDF_REPORT_DESIGN.md`
- Start with Phase 1 (Basic Report) only
- Add images and signature in later phases
- Test with real data from database

---

## 🚀 **IMPLEMENTATION ORDER**

1. Install `@react-pdf/renderer`
2. Create component structure
3. Implement CoverPage
4. Implement ExecutiveSummary  
5. Implement StandardReportLayout (with plantegninger)
6. Implement FriBefaringReportLayout (punkt liste)
7. Add images support
8. Add signature page
9. Integrate with BefaringDetail button
10. Test with real data

Start with steps 1-6 for basic PDF generation. Images and signature can be added later.

