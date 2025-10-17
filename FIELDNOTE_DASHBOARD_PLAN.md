# FieldNote - Prosjekt Dashboard Master Plan (v2.0)

**Dato:** 14. oktober 2025  
**Versjon:** 2.0 (inkluderer ChatGPT forbedringer)  
**Status:** Planlegging → Implementering  
**Estimat:** Fase 1 ferdig innen 3-4 dager (med kritiske fixes)

## 🔥 KRITISKE ENDRINGER FRA v1.0:
1. ⭐⭐⭐ **Normaliserte koordinater** (zoom-safe pins)
2. ⭐⭐ **Presigned URLs + Thumbnails** (ytelse + sikkerhet)
3. ⭐ **Audit log** (sporbarhet)
4. ⭐ **Webp-format** (30% mindre filstørrelse)
5. ⭐⭐ **"Fri Befaring"** (feltarbeider kan lage befaring uten prosjekt, knyttes senere)
6. ⭐⭐⭐ **Prosjekt-innboks for bilder** (feltarbeider kan laste opp bilder direkte til prosjekt, tagges senere)

---

## 📋 INNHOLDSFORTEGNELSE

1. [Kritiske Endringer (ChatGPT)](#1-kritiske-endringer-chatgpt)
2. [Overordnet Design](#2-overordnet-design)
3. [Brukerroller & Modus](#3-brukerroller--modus)
4. [Fase 1: Core Features](#4-fase-1-core-features)
5. [Database Schema](#5-database-schema)
6. [Implementeringsplan](#6-implementeringsplan)
7. [Risiko & Mitigering](#7-risiko--mitigering)
8. [Testing Strategi](#8-testing-strategi)
9. [Fase 2 & 3: Fremtidig](#9-fase-2--3-fremtidig)

---

## 1. KRITISKE ENDRINGER (CHATGPT)

### 1.1 Normaliserte Koordinater ⭐⭐⭐ KRITISK!

**Problem med nåværende løsning:**
```
Pixel-baserte koordinater (x: 523px, y: 891px)
    ↓
Bruker zoomer inn på plantegning
    ↓
Image width endres: 2000px → 4000px
    ↓
Pin vises på feil sted! (x: 523px er nå 1/4 av bredden, ikke 1/2)
```

**Løsning: Normaliserte koordinater (x,y ∈ [0,1])**
```
Normalisert: x: 0.34, y: 0.52
    ↓
Bruker zoomer inn
    ↓
Image width: 4000px
    ↓
Pixel-posisjon: x: 0.34 * 4000 = 1360px ✅ RIKTIG!
```

**ASCII Demo:**
```
BEFORE (pixel coords):              AFTER (normalized coords):
┌────────────────┐ 100% zoom        ┌────────────────┐ 100% zoom
│                │                   │                │
│      📍(523px) │                   │      📍(0.34)  │
│                │                   │                │
└────────────────┘ 2000px wide       └────────────────┘ 2000px wide

Zoom 200%:                          Zoom 200%:
┌──────────────────────────────┐    ┌──────────────────────────────┐
│                              │    │                              │
│      📍(523px)               │    │                  📍(0.34)    │
│      ↑ FEIL! Burde vært →   │    │                  ↑ RIKTIG!   │
└──────────────────────────────┘    └──────────────────────────────┘
4000px wide                         4000px wide
```

**Påvirket kode:**
- ✅ `oppgaver` tabell (ny kolonne: x_normalized, y_normalized)
- ✅ `plantegninger` tabell (må lagre original_width, original_height)
- ✅ `InteractivePlantegning.tsx` (lagre normalisert ved klikk)
- ✅ `PlantegningViewer.tsx` (render basert på normalisert)
- ✅ `OppgaveDialog.tsx` (les/skriv normalisert)

**Migrering:**
```sql
-- Steg 1: Legg til nye kolonner
ALTER TABLE oppgaver
ADD COLUMN x_normalized decimal(5,4),
ADD COLUMN y_normalized decimal(5,4);

-- Steg 2: Legg til dimensions på plantegninger
ALTER TABLE plantegninger
ADD COLUMN original_width integer,
ADD COLUMN original_height integer;

-- Steg 3: Konverter eksisterende data
-- (Må hente original dimensions fra PDF/bilde først)
UPDATE oppgaver o
SET 
  x_normalized = o.x_coordinate::decimal / p.original_width,
  y_normalized = o.y_coordinate::decimal / p.original_height
FROM plantegninger p
WHERE o.plantegning_id = p.id
  AND p.original_width > 0
  AND p.original_height > 0;

-- Steg 4: Verifiser (VIKTIG!)
SELECT 
  id, 
  x_coordinate, 
  y_coordinate,
  x_normalized,
  y_normalized
FROM oppgaver 
WHERE x_normalized IS NOT NULL
LIMIT 10;

-- Steg 5: Etter testing - fjern gamle kolonner (IKKE NÅ!)
-- ALTER TABLE oppgaver DROP COLUMN x_coordinate, DROP COLUMN y_coordinate;
```

---

### 1.2 Presigned URLs + Thumbnails ⭐⭐

**Problem med nåværende løsning:**
```
Client → Upload 10MB bilde → Next.js API → Supabase Storage
                ↓
        Langsom (via server)
        Mer server-load
        Dyrere (dataoverføring 2x)
```

**Løsning: Presigned URLs (direkte til CDN)**
```
Client → Request presigned URL → Next.js API
       ↓
Client → Upload 10MB direkte til Supabase CDN
       ↓
Edge Function → Generer thumbnails (1024px, 2048px webp)
```

**Fordeler:**
- ✅ 50% raskere upload (direkte til CDN)
- ✅ Mindre server-load
- ✅ Thumbnails: 90% mindre data-overføring
- ✅ Webp: 30% mindre enn JPEG
- ✅ Sikrere (kort levetid på URL)

**Database endringer:**
```sql
ALTER TABLE oppgave_bilder
ADD COLUMN storage_path text,           -- 'projects/{id}/images/{uuid}.webp'
ADD COLUMN thumbnail_1024_path text,    -- Thumb 1024px
ADD COLUMN thumbnail_2048_path text,    -- Thumb 2048px  
ADD COLUMN original_width integer,
ADD COLUMN original_height integer,
ADD COLUMN file_format text DEFAULT 'webp';
```

**Workflow:**
```
┌─────────────────────────────────────────────────────────┐
│ 1. CLIENT: Request upload URL                          │
│    POST /api/upload/presigned                          │
│    { projectId, filename, contentType }                │
│                                                          │
│ 2. SERVER: Generate presigned URL                      │
│    supabase.storage.createSignedUploadUrl()            │
│    Returns: { signedUrl, path, token }                 │
│                                                          │
│ 3. CLIENT: Upload direkte til CDN                      │
│    PUT {signedUrl}                                      │
│    Body: file blob                                      │
│                                                          │
│ 4. CLIENT: Notify server                               │
│    POST /api/upload/complete                            │
│    { path, projectId, befaringId? }                     │
│                                                          │
│ 5. EDGE FUNCTION: Generate thumbnails                  │
│    - Download original                                  │
│    - Generate 1024px webp                              │
│    - Generate 2048px webp                              │
│    - Upload thumbs                                      │
│    - Update database                                    │
└─────────────────────────────────────────────────────────┘
```

---

### 1.3 "Fri Befaring" - Feltarbeider Workflow ⭐⭐

**Problem:**
```
Feltarbeider ute i felten:
"Jeg må lage en befaring, men jeg vet ikke hvilket prosjekt dette er..."
"Jeg har ikke tid til å søke gjennom 200+ prosjekter nå"
"Jeg bare tar bilder og oppgaver, så fikser vi prosjektet senere"
```

**Løsning: "Fri Befaring" (Project-less Befaring)**
```
1. Feltarbeider lager befaring UTEN å velge prosjekt
   - Kun: Tittel, Dato, Beskrivelse
   - Ingen plantegning (kan legges til senere)
   
2. Feltarbeider legger til oppgaver + bilder
   - Alt lagres under "fri befaring"
   - Ingen prosjekt-valg nødvendig
   
3. På kontoret (admin/prosjektleder):
   - Se alle "frie befaringer" i dashboard
   - Knytt befaring til riktig prosjekt
   - Alt flyttes automatisk (oppgaver, bilder, etc.)
```

**Database endringer:**
```sql
-- Befaringer kan nå være uten prosjekt (temporary)
ALTER TABLE befaringer
ALTER COLUMN tripletex_project_id DROP NOT NULL;  -- Kan være NULL

-- Ny kolonne: "fri befaring" status
ALTER TABLE befaringer
ADD COLUMN is_orphaned boolean DEFAULT false;     -- Ingen prosjekt
ADD COLUMN orphaned_until timestamptz;           -- Hvor lenge fritt?

-- Index for å finne frie befaringer raskt
CREATE INDEX idx_befaring_orphaned 
ON befaringer(org_id, is_orphaned, created_at DESC)
WHERE is_orphaned = true;
```

**Workflow ASCII:**
```
FELTARBEIDER (mobil):
┌─────────────────────────────────────┐
│  Ny Befaring                        │
│  ─────────────────────────────────  │
│  Tittel: [Hull i vegg, 2. etg]     │
│  Dato: [15.10.2025]                 │
│  Beskrivelse: [Oppdaget ved...]    │
│                                      │
│  Prosjekt: [Skip for nå →]          │
│                                      │
│  [Lagre Befaring]                   │
└─────────────────────────────────────┘
              ↓
    Befaring lagret som "fri"
              ↓
    Legg til oppgaver + bilder
              ↓
    Alt lagres under befaring


PÅ KONTORET (admin):
┌─────────────────────────────────────┐
│  Dashboard → "Frie Befaringer"     │
│  ─────────────────────────────────  │
│  🔴 3 befaringer uten prosjekt      │
│                                      │
│  [Hull i vegg, 2. etg]             │
│  Opprettet: 15.10.2025 14:30       │
│  Oppgaver: 4 | Bilder: 12          │
│  [Knytt til prosjekt →]             │
│                                      │
│  [Befaring på tak]                  │
│  Opprettet: 15.10.2025 15:45       │
│  Oppgaver: 2 | Bilder: 8           │
│  [Knytt til prosjekt →]             │
└─────────────────────────────────────┘
              ↓
    Velg prosjekt fra dropdown
              ↓
    Alle oppgaver/bilder flyttes
              ↓
    Befaring er nå "knyttet"
```

**UI Endringer:**

**1. CreateBefaringDialog.tsx:**
```typescript
// Legg til "Skip prosjekt" knapp
<Button 
  variant="outline" 
  onClick={() => setSkipProject(true)}
>
  Skip prosjekt (knytt senere)
</Button>

// Hvis skipProject = true:
// - Ikke vis prosjekt-dropdown
// - Lagre med tripletex_project_id = null
// - Sett is_orphaned = true
```

**2. BefaringList.tsx:**
```typescript
// Vis "frie befaringer" i egen seksjon
{orphanedBefaringer.length > 0 && (
  <Card className="border-orange-500 bg-orange-50">
    <CardHeader>
      <CardTitle className="text-orange-700">
        🔴 Frie Befaringer ({orphanedBefaringer.length})
      </CardTitle>
      <CardDescription>
        Disse må knyttes til et prosjekt
      </CardDescription>
    </CardHeader>
    <CardContent>
      {orphanedBefaringer.map(befaring => (
        <BefaringCard 
          key={befaring.id}
          befaring={befaring}
          showLinkButton={true}  // "Knytt til prosjekt"
        />
      ))}
    </CardContent>
  </Card>
)}
```

**3. Dashboard "Frie Befaringer" Card:**
```typescript
// I ProjectDashboard.tsx
<Card className="border-orange-500">
  <CardHeader>
    <CardTitle className="text-orange-700">
      🔴 Frie Befaringer
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      {orphanedBefaringer.map(befaring => (
        <div key={befaring.id} className="flex justify-between">
          <div>
            <p className="font-medium">{befaring.title}</p>
            <p className="text-sm text-gray-500">
              {befaring.oppgaver_count} oppgaver, {befaring.bilder_count} bilder
            </p>
          </div>
          <Button size="sm" onClick={() => linkToProject(befaring.id)}>
            Knytt til prosjekt
          </Button>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

**4. LinkBefaringDialog.tsx (NY):**
```typescript
// Dialog for å knytte befaring til prosjekt
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Knytt befaring til prosjekt</DialogTitle>
      <DialogDescription>
        Velg hvilket prosjekt denne befaringen tilhører
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      <div>
        <Label>Befaring:</Label>
        <p className="text-sm text-gray-600">{befaring.title}</p>
      </div>
      
      <div>
        <Label>Prosjekt:</Label>
        <ProjectSelector
          value={selectedProject}
          onChange={setSelectedProject}
          placeholder="Søk etter prosjekt..."
        />
      </div>
      
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Alle oppgaver og bilder vil bli flyttet til dette prosjektet
        </AlertDescription>
      </Alert>
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Avbryt
        </Button>
        <Button onClick={handleLink}>
          Knytt til prosjekt
        </Button>
      </DialogFooter>
    </div>
  </DialogContent>
</Dialog>
```

**5. Backend Logic:**
```typescript
// Link befaring til prosjekt
const linkBefaringToProject = async (befaringId, projectId) => {
  // 1. Update befaring
  await supabase
    .from('befaringer')
    .update({
      tripletex_project_id: projectId,
      is_orphaned: false,
      orphaned_until: null
    })
    .eq('id', befaringId);
  
  // 2. Update alle oppgaver (hvis de ikke har prosjekt)
  await supabase
    .from('oppgaver')
    .update({ prosjekt_id: projectId })
    .eq('befaring_id', befaringId)
    .is('prosjekt_id', null);
  
  // 3. Update alle bilder (hvis de ikke har prosjekt)
  await supabase
    .from('oppgave_bilder')
    .update({ prosjekt_id: projectId })
    .eq('befaring_id', befaringId)
    .is('prosjekt_id', null);
  
  // 4. Log til audit
  await logAudit({
    action: 'LINK_BEFARING',
    entity_type: 'befaring',
    entity_id: befaringId,
    new_data: { linked_to_project: projectId }
  });
};
```

**Fordeler:**
- ✅ Feltarbeider kan jobbe raskt uten å søke prosjekter
- ✅ Alt data bevares (oppgaver, bilder)
- ✅ Admin kan knytte til riktig prosjekt senere
- ✅ Ingen data-tap
- ✅ Bedre UX for feltarbeidere

**Risiko & Mitigering:**
- ⚠️ **Risiko:** Frie befaringer blir glemt
  - **Mitigering:** Dashboard alert + email reminder etter 7 dager
- ⚠️ **Risiko:** Feltarbeider glemmer å knytte
  - **Mitigering:** Auto-knytt basert på GPS-lokasjon (fase 2)
- ⚠️ **Risiko:** Flere frie befaringer blir kaotisk
  - **Mitigering:** Max 10 frie befaringer per org (hard limit)

**Prioritet:** ⭐⭐ Høy (bedre UX for feltarbeidere)

---

### 1.4 Prosjekt-innboks for bilder ⭐⭐⭐ KRITISK!

**Problem:**
```
Feltarbeider ute i felten:
"Jeg har tatt noen bilder, men jeg vet ikke hvilken befaring/oppgave de tilhører"
"Jeg bare tar bilder av alt, så fikser vi hva de tilhører senere på kontoret"
"Jeg har ikke tid til å gå inn i en spesifikk befaring/oppgave nå"
```

**Løsning: Prosjekt-innboks for bilder**
```
1. Feltarbeider velger prosjekt (fra timer/bemanningsliste)
2. Feltarbeider tar/laster opp bilder direkte til prosjektet
3. Bildene havner i "prosjekt-innboksen" (is_tagged = false)
4. På kontoret (admin/prosjektleder):
   - Se alle bilder i prosjekt-innboksen
   - Tagge bilder til riktig befaring/oppgave
   - Eller beholde som generelle prosjekt-bilder
```

**Database endringer:**
```sql
-- oppgave_bilder tabell (allerede oppdatert i migrasjon 2!)
-- Kolonner vi trenger:
-- - prosjekt_id (allerede lagt til)
-- - is_tagged (allerede lagt til)
-- - befaring_id (allerede eksisterer)
-- - oppgave_id (allerede eksisterer)

-- View for prosjekt-innboks (allerede opprettet i migrasjon 2!)
-- project_photo_inbox view
```

**Workflow ASCII:**
```
FELTARBEIDER (mobil):
┌─────────────────────────────────────┐
│  Timer/Bemanningsliste              │
│  ─────────────────────────────────  │
│  Prosjekt: [Haugesund Bygg]         │
│                                      │
│  [📷 Ta bilder]                     │
│                                      │
│  ┌──────────────────────────────┐  │
│  │ 📷 Kamera                    │  │
│  │ 📁 Velg fra bibliotek        │  │
│  └──────────────────────────────┘  │
│                                      │
│  [Last opp til prosjekt]            │
└─────────────────────────────────────┘
              ↓
    Bildene lagres med:
    - prosjekt_id = "Haugesund Bygg"
    - befaring_id = null
    - oppgave_id = null
    - is_tagged = false
              ↓
    Bildene havner i "prosjekt-innboksen"


PÅ KONTORET (admin):
┌─────────────────────────────────────┐
│  Dashboard → Prosjekt: Haugesund    │
│  ─────────────────────────────────  │
│  📷 Foto-innboks (12 bilder)        │
│                                      │
│  [Bilde 1] [Bilde 2] [Bilde 3]     │
│  [Bilde 4] [Bilde 5] [Bilde 6]     │
│                                      │
│  [Tag alle bilder →]                │
│                                      │
│  Eller:                             │
│  [Bilde 1] → [Tag til befaring]    │
│  [Bilde 2] → [Tag til oppgave]     │
│  [Bilde 3] → [Behold som generelt] │
└─────────────────────────────────────┘
              ↓
    Admin tagger bilder
              ↓
    is_tagged = true
    befaring_id / oppgave_id settes
```

**UI Endringer:**

**1. Ny komponent: `ProjectPhotoUpload.tsx`**
```typescript
// Komponent for å laste opp bilder direkte til prosjekt
'use client';

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProjectPhotoUploadProps {
  projectId: string;
  projectName: string;
  orgId: string;
  userId: string;
}

export default function ProjectPhotoUpload({
  projectId,
  projectName,
  orgId,
  userId
}: ProjectPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = async (files: FileList) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        // 1. Compress image (max 5MB)
        const compressedFile = await compressImage(file, 5 * 1024 * 1024);
        
        // 2. Generate unique filename
        const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
        const path = `projects/${projectId}/inbox/${filename}`;
        
        // 3. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('oppgave-bilder')
          .upload(path, compressedFile, {
            contentType: 'image/webp',
            cacheControl: '3600'
          });
        
        if (uploadError) throw uploadError;
        
        // 4. Get public URL
        const { data: urlData } = supabase.storage
          .from('oppgave-bilder')
          .getPublicUrl(path);
        
        // 5. Insert into database
        const { error: dbError } = await supabase
          .from('oppgave_bilder')
          .insert({
            prosjekt_id: projectId,
            befaring_id: null,
            oppgave_id: null,
            image_url: urlData.publicUrl,
            storage_path: path,
            is_tagged: false,
            uploaded_by: userId,
            org_id: orgId
          });
        
        if (dbError) throw dbError;
      }
      
      toast({
        title: 'Bilder lastet opp',
        description: `${files.length} bilde(r) lagt i prosjekt-innboksen`,
      });
      
    } catch (error) {
      console.error('Error uploading images:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste opp bilder',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const compressImage = async (file: File, maxSizeBytes: number): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          let quality = 0.9;
          
          // Calculate new dimensions
          const maxDimension = 2048;
          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = width * ratio;
            height = height * ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert to webp
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/webp',
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/webp',
            quality
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg">Last opp bilder til prosjekt</h3>
          <p className="text-sm text-gray-600">
            {projectName}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Bildene vil havne i prosjekt-innboksen og kan tagges senere
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => document.getElementById('file-input')?.click()}
            disabled={uploading}
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Velg fra bibliotek
          </Button>
          
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => document.getElementById('camera-input')?.click()}
            disabled={uploading}
          >
            <Camera className="h-4 w-4 mr-2" />
            Ta bilde
          </Button>
        </div>

        {uploading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-600">Laster opp...</span>
          </div>
        )}

        <input
          id="file-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        />
        
        <input
          id="camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        />
      </div>
    </Card>
  );
}
```

**2. Integrer i Timer/Bemanningsliste:**
```typescript
// I bemanningsliste/timer komponent
import ProjectPhotoUpload from '@/components/ProjectPhotoUpload';

// Når bruker har valgt prosjekt:
{selectedProject && (
  <div className="mt-4">
    <ProjectPhotoUpload
      projectId={selectedProject.id}
      projectName={selectedProject.project_name}
      orgId={orgId}
      userId={user.id}
    />
  </div>
)}
```

**3. Foto-innboks i Dashboard:**
```typescript
// I ProjectDashboard.tsx
const [inboxPhotos, setInboxPhotos] = useState<any[]>([]);

useEffect(() => {
  const fetchInboxPhotos = async () => {
    const { data, error } = await supabase
      .from('project_photo_inbox')
      .select('*')
      .eq('org_id', orgId)
      .eq('prosjekt_id', selectedProjectId)
      .order('inbox_date', { ascending: false })
      .limit(50);
    
    if (data) setInboxPhotos(data);
  };
  
  if (selectedProjectId) fetchInboxPhotos();
}, [selectedProjectId, orgId]);

// I JSX:
<Card>
  <CardHeader>
    <CardTitle>📷 Foto-innboks</CardTitle>
    <CardDescription>
      {inboxPhotos.length} bilder som ikke er tagget
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-3 gap-2">
      {inboxPhotos.map(photo => (
        <div
          key={photo.id}
          className="relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 border-orange-200"
          onClick={() => openTagDialog(photo)}
        >
          <img
            src={photo.image_url}
            alt="Inbox photo"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs font-medium">Tag</span>
          </div>
        </div>
      ))}
    </div>
    
    {inboxPhotos.length === 0 && (
      <p className="text-center text-gray-500 py-8">
        Ingen bilder i innboksen
      </p>
    )}
  </CardContent>
</Card>
```

**4. Tag Photo Dialog (NY):**
```typescript
// Komponent for å tagge bilder til befaring/oppgave
'use client';

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';

interface TagPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photo: {
    id: string;
    image_url: string;
    prosjekt_id: string;
  };
  projectBefaringer: any[];
  onSuccess?: () => void;
}

export default function TagPhotoDialog({
  open,
  onOpenChange,
  photo,
  projectBefaringer,
  onSuccess
}: TagPhotoDialogProps) {
  const [tagType, setTagType] = useState<'befaring' | 'oppgave' | 'general'>('befaring');
  const [selectedBefaring, setSelectedBefaring] = useState<string>('');
  const [selectedOppgave, setSelectedOppgave] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleTag = async () => {
    setLoading(true);

    try {
      const updates: any = {
        is_tagged: true
      };

      if (tagType === 'befaring' && selectedBefaring) {
        updates.befaring_id = selectedBefaring;
      } else if (tagType === 'oppgave' && selectedOppgave) {
        updates.oppgave_id = selectedOppgave;
      } else if (tagType === 'general') {
        // Behold som generelt prosjekt-bilde
        updates.is_tagged = true;
      }

      const { error } = await supabase
        .from('oppgave_bilder')
        .update(updates)
        .eq('id', photo.id);

      if (error) throw error;

      toast({
        title: 'Bilde tagget',
        description: 'Bildet er nå knyttet til riktig sted',
      });

      onSuccess?.();
      onOpenChange(false);

    } catch (error) {
      console.error('Error tagging photo:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke tagge bilde',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tagge bilde</DialogTitle>
          <DialogDescription>
            Velg hvor dette bildet tilhører
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center">
            <img
              src={photo.image_url}
              alt="Photo to tag"
              className="max-h-64 rounded-lg"
            />
          </div>

          <div>
            <Label>Hvor tilhører bildet?</Label>
            <RadioGroup value={tagType} onValueChange={(v: any) => setTagType(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="befaring" id="befaring" />
                <Label htmlFor="befaring">Befaring</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="oppgave" id="oppgave" />
                <Label htmlFor="oppgave">Oppgave</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="general" id="general" />
                <Label htmlFor="general">Generelt prosjekt-bilde</Label>
              </div>
            </RadioGroup>
          </div>

          {tagType === 'befaring' && (
            <div>
              <Label htmlFor="befaring-select">Velg befaring</Label>
              <select
                id="befaring-select"
                value={selectedBefaring}
                onChange={(e) => setSelectedBefaring(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              >
                <option value="">Velg befaring...</option>
                {projectBefaringer.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.title} - {new Date(b.befaring_date).toLocaleDateString('no-NO')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tagType === 'oppgave' && (
            <div>
              <Label htmlFor="oppgave-select">Velg oppgave</Label>
              <select
                id="oppgave-select"
                value={selectedOppgave}
                onChange={(e) => setSelectedOppgave(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              >
                <option value="">Velg oppgave...</option>
                {/* Hent oppgaver basert på valgt befaring */}
              </select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleTag} disabled={loading}>
            Tagge bilde
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Fordeler:**
- ✅ Feltarbeider kan jobbe raskt uten å gå inn i spesifikke befaringer
- ✅ Alt data bevares (bilder)
- ✅ Admin kan tagge bilder til riktig sted senere
- ✅ Ingen data-tap
- ✅ Bedre UX for feltarbeidere
- ✅ Kan brukes fra timer/bemanningsliste (allerede valgt prosjekt)

**Risiko & Mitigering:**
- ⚠️ **Risiko:** Mange bilder i innboksen blir kaotisk
  - **Mitigering:** Dashboard viser kun siste 50, resten i full liste
- ⚠️ **Risiko:** Feltarbeider glemmer å laste opp
  - **Mitigering:** Påminnelse i UI ("Du har ikke lastet opp bilder i dag")
- ⚠️ **Risiko:** Bilde-størrelse
  - **Mitigering:** Client-side komprimering (max 5MB, webp format)

**Prioritet:** ⭐⭐⭐ Høy (bedre UX for feltarbeidere, kan brukes fra timer/bemanningsliste)

---

### 1.5 Audit Log ⭐

**Hvorfor trenger vi dette?**
- ✅ Sporbarhet: Hvem gjorde hva og når
- ✅ Debugging: "Hvorfor ble denne oppgaven lukket?"
- ✅ Compliance: Juridiske krav
- ✅ Sikkerhet: Oppdage uautoriserte endringer

**Schema:**
```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  org_id uuid REFERENCES organizations(id),
  
  action text NOT NULL,          -- 'CREATE', 'UPDATE', 'DELETE'
  entity_type text NOT NULL,     -- 'oppgave', 'befaring', 'bilde', etc.
  entity_id uuid NOT NULL,
  
  old_data jsonb,                -- State før endring
  new_data jsonb,                -- State etter endring
  changes jsonb,                 -- Diff (hva endret seg)
  
  ip_address inet,
  user_agent text,
  created_at timestamp DEFAULT now()
);

-- Indekser
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_org ON audit_log(org_id, created_at DESC);
```

**Eksempel bruk:**
```typescript
// Automatisk logging ved oppgave-oppdatering
const updateOppgave = async (id, updates) => {
  const old = await getOppgave(id);
  const updated = await db.oppgaver.update(id, updates);
  
  // Log til audit
  await db.audit_log.insert({
    user_id: userId,
    org_id: orgId,
    action: 'UPDATE',
    entity_type: 'oppgave',
    entity_id: id,
    old_data: old,
    new_data: updated,
    changes: diff(old, updated),  // { status: 'åpen' → 'lukket' }
    ip_address: req.ip,
    user_agent: req.headers['user-agent']
  });
};
```

**UI for audit log (admin):**
```
┌─────────────────────────────────────────────────────────┐
│ AKTIVITETSLOGG - Oppgave #123                          │
├─────────────────────────────────────────────────────────┤
│ 14.okt 15:23 - Ole Hansen (admin)                      │
│ ✏️  Endret status: "åpen" → "lukket"                    │
│                                                          │
│ 14.okt 14:15 - Kari Nordmann (ansatt)                  │
│ ✏️  Endret beskrivelse                                  │
│ 📸 La til 2 bilder                                      │
│                                                          │
│ 13.okt 09:30 - Ole Hansen (admin)                      │
│ ➕ Opprettet oppgave                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 2. OVERORDNET DESIGN

### 2.1 Hybrid Dashboard (Vårt + ChatGPT)

```
┌────────────────────────────────────────────────────────────────────┐
│ 🏗️ FieldNote                       [🔔 Varsler] [📱/📊] [Profil]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🎯 PROSJEKTVELGER                                                 │
│  Prosjekt: [Alle prosjekter ▾]   [Søk...] 🔍                      │
│  ⭐ Quick-select: [Nedre Torg] [Storgt 15] [Bygata 7] [Alle]      │
│                                                                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  HVIS "Alle prosjekter" valgt:                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ ⭐ FAVORITTER (4-6 kort)                                      │ │
│  │ [Kort] [Kort] [Kort] [Kort]                                  │ │
│  │                                                                │ │
│  │ 🔥 MEST AKTIVE (Top 5 liste)                                 │ │
│  │ 1. Nedre Torg 5    45 hendelser  [Velg →]                    │ │
│  │ 2. Bygata 7        32 hendelser  [Velg →]                    │ │
│  │ 3. Storgt 15       18 hendelser  [Velg →]                    │ │
│  │                                                                │ │
│  │ 📋 ALLE PROSJEKTER (247)    [Se full liste →]                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  HVIS "Nedre Torg 5" valgt:                                       │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ 🚨 KREVER HANDLING (filtrert på prosjekt)                    │ │
│  │ 🔴 5 oppgaver > 7 dager - ESKALERT                           │ │
│  │ 🟡 Befaring i morgen - mangler crew                          │ │
│  │                                                                │ │
│  │ 📊 KPI (filtrert på prosjekt)                                │ │
│  │ [⚠️ AVVIK] [📋 OPPGAVER] [🗓 FRISTER] [📸 BILDER]           │ │
│  │                                                                │ │
│  │ ┌─ Aktivitetsfeed ─────┬─ Foto-innboks ───────────┐         │ │
│  │ │ • Avvik #203 (VVS)   │ [IMG] 14:23               │         │ │
│  │ │ • 3 nye pins         │ Tagg til: [Befaring ▾]   │         │ │
│  │ └──────────────────────┴───────────────────────────┘         │ │
│  │                                                                │ │
│  │ 📂 MODULER                                                    │ │
│  │ Prosjekt: [Befaringer] [Avvik] [Sjekklister] [Bilder]       │ │
│  │ Globalt:  [👷 Bemanningsliste] [📊 HMS-tavle]                │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### 1.2 Navigasjonsflyt

```
Dashboard åpnes
    ↓
Smart default:
- HVIS kritiske alerts på andre prosjekter → Vis "Alle"
- ELLERS HVIS få favoritter + har sist brukt → Vis sist brukte
- ELLERS → Vis "Alle"
    ↓
Bruker velger prosjekt (dropdown eller chip)
    ↓
Dashboard filtreres umiddelbart
    ↓
KPI, alerts, feed, innboks - alt vises kun for valgt prosjekt
```

---

## 2. BRUKERROLLER & MODUS

### 2.1 Admin/Leder/Manager

**Leder-modus (desktop):**
- Full dashboard med alle features
- Oversikt over alle prosjekter
- KPI, rapporter, analyse

**Felt-modus (mobil/tablet) - kommer i Fase 2:**
- Forenklet UI
- Mine befaringer
- Oppgaver og kamera
- Toggle til leder-modus

### 2.2 Feltarbeider (user)

**Kun "Mitt Arbeid" dashboard:**
- Mine oppgaver
- Mine befaringer
- Timer
- Ingen toggle (enklere)

---

## 3. FASE 1: CORE FEATURES

### 3.1 Prosjektvelger
- [x] Dropdown med alle prosjekter
- [x] Favoritt-chips for quick-select
- [x] Søkefunksjon
- [x] Filtrerer hele dashbordet

### 3.2 Favoritter
- [x] Org-favoritter (alle kan sette)
- [x] Personlige favoritter
- [x] Aktivitetsbasert vekting
- [x] Max 4-6 kort (ikke overveldende)

### 3.3 "Mest aktive" prosjekter
- [x] Aktivitetsscore (siste 7 dager):
  - Bilder: 3 poeng
  - Oppgaver: 2 poeng
  - Befaringer: 2.5 poeng
  - Timer: 0.5 poeng
- [x] Top 5 liste (ikke grid)
- [x] Klikkbar → filtrerer dashboard

### 3.4 "Krever handling" alerts
- [x] Intelligens:
  - Oppgaver > 7 dager (kritisk 🔴)
  - Oppgaver > 3 dager (viktig 🟡)
  - Befaring < 24t uten crew (kritisk 🔴)
  - Timer ikke sendt > 7 dager (viktig 🟡)
- [x] Klikkbar → går til oppgave/befaring

### 3.5 KPI-kort
- [x] Åpne avvik (kritiske)
- [x] Oppgaver (befaring vs generelle)
- [x] Frister (neste 7 dager)
- [x] Nye bilder (siste 7 dager)
- [x] Klikkbar → går til modul

### 3.6 Foto-innboks ⭐ (NY!)
- [x] Feltarbeider MÅ velge prosjekt
- [x] Bilder uten befaring/oppgave → Inbox
- [x] Hovedinnboks: Gruppert per prosjekt
- [x] Admin tagger til befaring/oppgave
- [x] Kan opprette ny oppgave fra bilde

### 3.7 Aktivitetsfeed
- [x] Siste 24t
- [x] Filtrert på valgt prosjekt
- [x] Live oppdateringer
- [x] Klikkbar → går til aktivitet

### 3.8 Modul-system
- [x] Prosjektbasert (kun når prosjekt valgt):
  - Befaringer
  - Avvik (fremtidig)
  - Sjekklister (fremtidig)
  - Bilder
- [x] Globalt (alltid synlig):
  - Bemanningsliste / Min uke
  - HMS-tavle (fremtidig)

---

## 4. DATABASE SCHEMA

### 4.1 Nye tabeller

#### project_favorites
```sql
CREATE TABLE project_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  project_id uuid REFERENCES ttx_project_cache(id),
  org_id uuid REFERENCES organizations(id),
  is_org_favorite boolean DEFAULT false,  -- Org-favoritt (alle ser)
  is_pinned boolean DEFAULT false,         -- Pinned øverst
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Indekser
CREATE INDEX idx_project_favorites_user ON project_favorites(user_id);
CREATE INDEX idx_project_favorites_org ON project_favorites(org_id, is_org_favorite);

-- RLS
ALTER TABLE project_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favorites"
  ON project_favorites FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view org favorites"
  ON project_favorites FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );
```

#### project_activity
```sql
CREATE TABLE project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES ttx_project_cache(id),
  org_id uuid REFERENCES organizations(id),
  activity_type text NOT NULL,  -- 'image_uploaded', 'task_created', 'befaring_completed', etc.
  description text,
  related_id uuid,               -- befaring_id, oppgave_id, etc.
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp DEFAULT now(),
  metadata jsonb
);

-- Indekser
CREATE INDEX idx_project_activity_project ON project_activity(project_id, created_at DESC);
CREATE INDEX idx_project_activity_org ON project_activity(org_id, created_at DESC);
CREATE INDEX idx_project_activity_type ON project_activity(activity_type);

-- RLS
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org activity"
  ON project_activity FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );
```

#### user_preferences
```sql
CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE,
  last_selected_project uuid REFERENCES ttx_project_cache(id),
  preferred_mode text DEFAULT 'auto',  -- 'auto', 'field', 'leader'
  dashboard_layout jsonb,               -- Fleksibel config
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id);
```

### 4.2 Oppdatere eksisterende tabeller

#### oppgave_bilder (foto-innboks)
```sql
-- Legg til foto-innboks felter
ALTER TABLE oppgave_bilder 
ADD COLUMN prosjekt_id uuid REFERENCES ttx_project_cache(id) NOT NULL,
ADD COLUMN is_tagged boolean DEFAULT false,
ADD COLUMN inbox_date timestamp DEFAULT now(),
ADD COLUMN tagged_by uuid REFERENCES auth.users(id),
ADD COLUMN tagged_at timestamp;

-- Oppdater existing data (sett prosjekt_id fra befaring)
UPDATE oppgave_bilder ob
SET prosjekt_id = (
  SELECT b.tripletex_project_id 
  FROM oppgaver o
  JOIN befaringer bf ON o.befaring_id = bf.id
  WHERE o.id = ob.oppgave_id
  LIMIT 1
)
WHERE prosjekt_id IS NULL;

-- Marker eksisterende bilder som tagged
UPDATE oppgave_bilder 
SET is_tagged = true 
WHERE befaring_id IS NOT NULL OR oppgave_id IS NOT NULL;

-- Indekser
CREATE INDEX idx_oppgave_bilder_prosjekt ON oppgave_bilder(prosjekt_id, is_tagged);
CREATE INDEX idx_oppgave_bilder_inbox ON oppgave_bilder(prosjekt_id, inbox_date DESC) 
  WHERE is_tagged = false;
```

### 4.3 Views for performance

#### project_activity_summary
```sql
CREATE OR REPLACE VIEW project_activity_summary AS
SELECT 
  p.id as project_id,
  p.project_name,
  p.project_number,
  p.org_id,
  
  -- Aktivitetsscore (siste 7 dager)
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
  
  -- Telling
  COUNT(DISTINCT o.id) FILTER (WHERE o.status != 'lukket') as open_tasks,
  COUNT(DISTINCT ob.id) FILTER (WHERE ob.uploaded_at > NOW() - INTERVAL '7 days') as recent_images,
  COUNT(DISTINCT ob.id) FILTER (WHERE ob.is_tagged = false) as untagged_images,
  COUNT(DISTINCT bf.id) as total_befaringer,
  
  -- Timestamps
  MAX(o.created_at) as last_task_date,
  MAX(ob.uploaded_at) as last_image_date,
  MAX(bf.created_at) as last_befaring_date

FROM ttx_project_cache p
LEFT JOIN befaringer bf ON bf.tripletex_project_id = p.tripletex_project_id
LEFT JOIN oppgaver o ON o.befaring_id = bf.id OR o.prosjekt_id = p.id
LEFT JOIN oppgave_bilder ob ON ob.prosjekt_id = p.id

WHERE p.is_active = true
GROUP BY p.id, p.project_name, p.project_number, p.org_id;

-- Grant access
GRANT SELECT ON project_activity_summary TO authenticated;
```

#### project_inbox_summary
```sql
CREATE OR REPLACE VIEW project_inbox_summary AS
SELECT 
  p.id as project_id,
  p.project_name,
  p.project_number,
  p.org_id,
  COUNT(ob.id) as untagged_count,
  array_agg(
    jsonb_build_object(
      'id', ob.id,
      'file_url', ob.file_url,
      'file_name', ob.file_name,
      'uploaded_by', pr.display_name,
      'uploaded_at', ob.uploaded_at
    ) ORDER BY ob.uploaded_at DESC
  ) FILTER (WHERE ob.id IS NOT NULL) as images
FROM ttx_project_cache p
LEFT JOIN oppgave_bilder ob ON ob.prosjekt_id = p.id AND ob.is_tagged = false
LEFT JOIN profiles pr ON ob.uploaded_by = pr.user_id
WHERE p.is_active = true
GROUP BY p.id, p.project_name, p.project_number, p.org_id
HAVING COUNT(ob.id) > 0;

-- Grant access
GRANT SELECT ON project_inbox_summary TO authenticated;
```

---

## 5. IMPLEMENTERINGSPLAN

### 5.1 Dag 1: Database & Backend (2-3 timer)

**Steg 1: Kjør migreringer** (30 min)
```bash
# 1. Lag migrasjonsfil
touch supabase/migrations/20251014000000_create_dashboard_system.sql

# 2. Kopier SQL fra seksjon 4
# 3. Kjør migrering
npx supabase db push
```

**Steg 2: Test queries** (30 min)
```sql
-- Test favoritter
SELECT * FROM project_favorites WHERE org_id = '...';

-- Test aktivitetsscore
SELECT * FROM project_activity_summary 
ORDER BY activity_score DESC 
LIMIT 5;

-- Test foto-innboks
SELECT * FROM project_inbox_summary;
```

**Steg 3: API functions** (1-2 timer)
- `getFavorites(orgId, userId)` → Henter org + personlige favoritter
- `getMostActive(orgId, limit)` → Top N mest aktive prosjekter
- `getPhotoInbox(projectId?)` → Henter ukategoriserte bilder
- `tagPhoto(photoId, befaringId?, oppgaveId?)` → Tagger bilde
- `getActivityFeed(projectId, hours)` → Henter aktivitet

### 5.2 Dag 2: UI Components (4-6 timer)

**Komponent-struktur:**
```
src/components/dashboard/
├── ProjectSelector.tsx        (Dropdown + Chips)
├── FavoriteProjects.tsx       (Grid med favoritter)
├── MostActiveProjects.tsx     (Top 5 liste)
├── ActionRequired.tsx         ("Krever handling")
├── KPICards.tsx               (Avvik, Oppgaver, Frister, Bilder)
├── ActivityFeed.tsx           (Siste 24t)
├── PhotoInbox.tsx             (Foto-innboks med tagging)
└── ModuleCards.tsx            (Prosjekt + Globale moduler)
```

**Steg 1: ProjectSelector** (1 time)
```typescript
// Dropdown med søk + favoritt-chips
<ProjectSelector 
  selectedProject={selectedProject}
  onSelectProject={setSelectedProject}
  favorites={favorites}
  onToggleFavorite={toggleFavorite}
/>
```

**Steg 2: Conditional rendering basert på selection** (1 time)
```typescript
{selectedProject === 'all' ? (
  <AllProjectsView>
    <FavoriteProjects />
    <MostActiveProjects />
  </AllProjectsView>
) : (
  <SingleProjectView>
    <ActionRequired projectId={selectedProject} />
    <KPICards projectId={selectedProject} />
    <ActivityFeed projectId={selectedProject} />
    <PhotoInbox projectId={selectedProject} />
    <ModuleCards projectId={selectedProject} />
  </SingleProjectView>
)}
```

**Steg 3: Foto-innboks komponent** (2 timer)
```typescript
<PhotoInbox projectId={selectedProject}>
  {inboxImages.map(img => (
    <InboxImage 
      key={img.id}
      image={img}
      onTag={(befaringId, oppgaveId) => tagPhoto(img.id, befaringId, oppgaveId)}
      befaringer={befaringer}
      oppgaver={oppgaver}
    />
  ))}
</PhotoInbox>
```

### 5.3 Dag 3: Polish & Testing (2-3 timer)

**Steg 1: Smart default** (30 min)
```typescript
// Determine default view on load
useEffect(() => {
  const defaultProject = determineDefaultView({
    criticalAlerts,
    favorites,
    lastUsed
  });
  setSelectedProject(defaultProject);
}, []);
```

**Steg 2: localStorage persistence** (30 min)
```typescript
// Lagre siste valgte prosjekt
useEffect(() => {
  localStorage.setItem('lastSelectedProject', selectedProject);
}, [selectedProject]);
```

**Steg 3: Responsivt design** (1 time)
- Mobile: Stack vertikalt
- Tablet: 2 kolonner
- Desktop: Full layout

**Steg 4: Testing** (1 time)
- Test alle filtreringsscenarioer
- Test foto-innboks workflow
- Test favoritter (org + personlige)
- Test "krever handling" alerts

---

## 6. FASE 2 & 3: FREMTIDIG

### 6.1 Fase 2: Feltarbeider Dashboard (uke 2-3)
- [ ] "Mitt Arbeid" side (`/mitt-arbeid`)
- [ ] Mine oppgaver (gruppert per prosjekt)
- [ ] Mine befaringer (planlagt, pågående, fullført)
- [ ] Timer-tab (embed `/min/uke`)
- [ ] Mobiloptimalisering
- [ ] Offline-støtte

### 6.2 Fase 3: Avanserte Features (fremtidig)
- [ ] Sjekklister (templates + utførelse)
- [ ] HMS-tavle (global + prosjekt-knyttet)
- [ ] Avvik-modul (separat fra oppgaver)
- [ ] Real-time updates (Supabase subscriptions)
- [ ] Push-notifikasjoner
- [ ] PWA-funksjoner

---

## 7. SUCCESS METRICS

### 7.1 Fase 1 skal gi:
- ✅ Rask tilgang til favoritt-prosjekter (1 klikk)
- ✅ Umiddelbar oversikt over "krever handling"
- ✅ Effektiv foto-tagging (50% raskere enn manuell)
- ✅ Aktivitetsbasert prioritering (mest aktive øverst)
- ✅ Ingen "lost" bilder (alltid knyttet til prosjekt)

### 7.2 KPI for suksess:
- Tid fra bilde-opplasting til tagging: < 2 min
- Tid for å finne prosjekt: < 5 sek (med favoritter)
- Antall utaggede bilder: < 10% av totalt
- Bruker-tilfredshet: > 4/5

---

## 8. TEKNISK STACK

### 8.1 Frontend:
- React / Next.js 14
- TypeScript
- Tailwind CSS
- shadcn/ui components
- React Query (caching)

### 8.2 Backend:
- Supabase (database + auth)
- PostgreSQL views (performance)
- RLS policies (security)

### 8.3 Performance:
- Views for pre-beregnet data
- Indekser på kritiske felt
- React Query caching (5 min)
- Lazy loading for bilder

---

## 9. VEDLEGG

### 9.1 Database ER-diagram
```
ttx_project_cache (eksisterende)
    ↓ (1:N)
befaringer (eksisterende)
    ↓ (1:N)
oppgaver (eksisterende)
    ↓ (1:N)
oppgave_bilder (oppdatert med inbox-funksjon)
    
project_favorites (ny) → ttx_project_cache
project_activity (ny) → ttx_project_cache
user_preferences (ny) → auth.users
```

### 9.2 API Endpoints oversikt
```typescript
// Favoritter
GET  /api/favorites?orgId={id}
POST /api/favorites { projectId, isOrgFavorite }
DELETE /api/favorites/{id}

// Aktivitet
GET /api/activity?projectId={id}&hours=24

// Foto-innboks
GET  /api/inbox?projectId={id}
POST /api/inbox/{photoId}/tag { befaringId?, oppgaveId? }

// Mest aktive
GET /api/projects/most-active?limit=5
```

---

**SLUTT PÅ PLAN**

✅ **Neste steg:** Start database-migrering (Dag 1, Steg 1)

**Estimert tid til MVP:** 2-3 dager (Fase 1 komplett)

