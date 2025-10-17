# Prosjekt-innboks for bilder - Detaljert Plan

**Dato:** 14. oktober 2025  
**Prioritet:** ⭐⭐⭐ Høy  
**Status:** Planlagt  
**Estimat:** 3-4 timer

---

## 🎯 PROBLEM

Feltarbeider ute i felten:
- "Jeg har tatt noen bilder, men jeg vet ikke hvilken befaring/oppgave de tilhører"
- "Jeg bare tar bilder av alt, så fikser vi hva de tilhører senere på kontoret"
- "Jeg har ikke tid til å gå inn i en spesifikk befaring/oppgave nå"

**Nåværende løsning krever:**
- ❌ Gå inn i spesifikk befaring
- ❌ Gå inn i spesifikk oppgave
- ❌ Velge hvor bildet skal plasseres
- ❌ Sløser tid for feltarbeider

---

## 💡 LØSNING: Prosjekt-innboks for bilder

Feltarbeider kan laste opp bilder **direkte til prosjektet** (fra timer/bemanningsliste). Bildene havner i "prosjekt-innboksen" og kan tagges til riktig befaring/oppgave senere.

---

## 🔄 WORKFLOW

### Feltarbeider (Mobil):
```
1. Åpne Timer/Bemanningsliste
2. Velg prosjekt (allerede valgt)
3. Klikk "📷 Ta bilder" eller "📁 Velg fra bibliotek"
4. Velg/last opp bilder
5. Bildene lagres med:
   - prosjekt_id = valgt prosjekt
   - befaring_id = null
   - oppgave_id = null
   - is_tagged = false
6. Bildene havner i "prosjekt-innboksen"
```

### Admin (Kontor):
```
1. Åpne Dashboard
2. Velg prosjekt
3. Se "Foto-innboks" card
4. Klikk på bilde
5. Tagge til:
   - Befaring
   - Oppgave
   - Generelt prosjekt-bilde
6. Bilde er nå tagget
```

---

## 📊 DATABASE

### ✅ Allerede implementert i migrasjon 2!

**oppgave_bilder tabell:**
- ✅ `prosjekt_id` (uuid) - Hvilket prosjekt
- ✅ `befaring_id` (uuid, nullable) - Hvilken befaring
- ✅ `oppgave_id` (uuid, nullable) - Hvilken oppgave
- ✅ `is_tagged` (boolean) - Er bildet tagget?
- ✅ `inbox_date` (timestamp) - Når lastet til innboks
- ✅ `tagged_by` (uuid, nullable) - Hvem tagget
- ✅ `tagged_at` (timestamp, nullable) - Når tagget

**project_photo_inbox view:**
```sql
CREATE OR REPLACE VIEW project_photo_inbox AS
SELECT 
  img.id,
  img.prosjekt_id,
  img.image_url,
  img.storage_path,
  img.inbox_date,
  img.is_tagged,
  img.tagged_by,
  img.tagged_at,
  img.uploaded_by,
  img.org_id,
  
  -- Metadata
  p.project_name,
  p.project_number,
  
  -- Uploader info
  up.full_name as uploaded_by_name,
  
  -- Age
  EXTRACT(EPOCH FROM (now() - img.inbox_date)) / 3600 as hours_in_inbox
  
FROM oppgave_bilder img
LEFT JOIN ttx_project_cache p ON p.id = img.prosjekt_id
LEFT JOIN profiles up ON up.id = img.uploaded_by

WHERE img.is_tagged = false
  AND img.prosjekt_id IS NOT NULL
  AND img.org_id = current_setting('app.current_org_id')::uuid

ORDER BY img.inbox_date DESC;
```

---

## 🎨 UI ENDRINGER

### 1. Ny komponent: `ProjectPhotoUpload.tsx`

**Lokasjon:** `src/components/ProjectPhotoUpload.tsx`

**Funksjon:**
- Last opp bilder direkte til prosjekt
- Client-side komprimering (max 5MB, webp)
- Støtte for både kamera og bibliotek
- Upload til Supabase Storage
- Lagre metadata i database

**Props:**
```typescript
interface ProjectPhotoUploadProps {
  projectId: string;
  projectName: string;
  orgId: string;
  userId: string;
}
```

**Features:**
- ✅ Ta bilde (kamera)
- ✅ Velg fra bibliotek
- ✅ Multiple bilder samtidig
- ✅ Client-side komprimering
- ✅ Webp format
- ✅ Loading state
- ✅ Toast notifications
- ✅ Error handling

**Kode:** Se `FIELDNOTE_DASHBOARD_PLAN.md` seksjon 1.4 for full kode

---

### 2. Integrer i Timer/Bemanningsliste

**Lokasjon:** `src/app/min/page.tsx` (Timer)

**Endringer:**
```typescript
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

**Lokasjon:** `src/app/uke/page.tsx` (Bemanningsliste)

**Endringer:** Samme som over

---

### 3. Foto-innboks i Dashboard

**Lokasjon:** `src/components/ProjectDashboard.tsx`

**Endringer:**
```typescript
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

---

### 4. Tag Photo Dialog (NY)

**Lokasjon:** `src/components/TagPhotoDialog.tsx`

**Funksjon:**
- Tagge bilder til befaring/oppgave
- Velg fra dropdown
- Bekreft → Update database

**Props:**
```typescript
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
```

**Features:**
- ✅ Vis bilde
- ✅ Radio buttons: Befaring / Oppgave / Generelt
- ✅ Dropdown for befaring
- ✅ Dropdown for oppgave
- ✅ Update database
- ✅ Toast notifications
- ✅ Loading state

**Kode:** Se `FIELDNOTE_DASHBOARD_PLAN.md` seksjon 1.4 for full kode

---

## 🧪 TESTING CHECKLIST

### Unit Tests:
- [ ] `ProjectPhotoUpload` - Ta bilde fungerer
- [ ] `ProjectPhotoUpload` - Velg fra bibliotek fungerer
- [ ] `ProjectPhotoUpload` - Multiple bilder samtidig
- [ ] `ProjectPhotoUpload` - Client-side komprimering
- [ ] `ProjectPhotoUpload` - Upload til Supabase Storage
- [ ] `ProjectPhotoUpload` - Lagre metadata i database
- [ ] `TagPhotoDialog` - Tagge til befaring
- [ ] `TagPhotoDialog` - Tagge til oppgave
- [ ] `TagPhotoDialog` - Tagge som generelt bilde

### Integration Tests:
- [ ] Feltarbeider laster opp bilder fra timer
- [ ] Feltarbeider laster opp bilder fra bemanningsliste
- [ ] Bildene havner i prosjekt-innboksen
- [ ] Admin ser bilder i dashboard
- [ ] Admin tagger bilder til befaring
- [ ] Admin tagger bilder til oppgave
- [ ] Admin tagger bilder som generelt
- [ ] Bildene vises nå i riktig sted

### Edge Cases:
- [ ] Hva hvis ingen bilder i innboksen?
- [ ] Hva hvis 100+ bilder i innboksen? (pagination)
- [ ] Hva hvis bilde-størrelse > 5MB? (komprimering)
- [ ] Hva hvis upload feiler? (error handling)
- [ ] Hva hvis bruker ikke har valgt prosjekt? (disable upload)

---

## 📋 IMPLEMENTERING STEG

### Dag 1 (2 timer):
1. ✅ `ProjectPhotoUpload.tsx` - Opprett komponent
2. ✅ Test upload funksjonalitet
3. ✅ Integrer i Timer (`src/app/min/page.tsx`)

### Dag 2 (2 timer):
4. ✅ Integrer i Bemanningsliste (`src/app/uke/page.tsx`)
5. ✅ `TagPhotoDialog.tsx` - Opprett komponent
6. ✅ Test tag funksjonalitet

### Dag 3 (1-2 timer):
7. ✅ Foto-innboks i Dashboard
8. ✅ Testing: Full workflow
9. ✅ Bug fixes

---

## 🚨 RISIKO & MITIGERING

### Risiko 1: Mange bilder i innboksen blir kaotisk
**Mitigering:**
- Dashboard viser kun siste 50
- Pagination for flere
- Link til full liste

### Risiko 2: Feltarbeider glemmer å laste opp
**Mitigering:**
- Påminnelse i UI ("Du har ikke lastet opp bilder i dag")
- Email reminder (fase 2)

### Risiko 3: Bilde-størrelse
**Mitigering:**
- Client-side komprimering (max 5MB)
- Webp format (30% mindre)
- Thumbnail generering (fase 2)

### Risiko 4: Upload feiler
**Mitigering:**
- Error handling
- Toast notifications
- Retry logic (fase 2)

---

## 🎯 ACCEPTANCE CRITERIA

- [ ] Feltarbeider kan laste opp bilder fra timer
- [ ] Feltarbeider kan laste opp bilder fra bemanningsliste
- [ ] Bildene havner i prosjekt-innboksen
- [ ] Admin ser alle bilder i dashboard
- [ ] Admin kan tagge bilder til befaring
- [ ] Admin kan tagge bilder til oppgave
- [ ] Admin kan tagge bilder som generelt
- [ ] Bildene vises nå i riktig sted
- [ ] Ingen data-tap under tagging
- [ ] Client-side komprimering fungerer
- [ ] Webp format brukes
- [ ] Error handling fungerer

---

## 📝 NOTATER

- **Prioritet:** Høy (bedre UX for feltarbeidere, kan brukes fra timer/bemanningsliste)
- **Kompleksitet:** Medium (UI + upload logic + tagging)
- **Estimat:** 3-4 timer
- **Avhengigheter:** Database migrasjon 2 (allerede kjørt ✅)
- **Blokkerer:** Ingen

---

## 🔗 RELATERTE FEATURES

- **Fri Befaring** (`FRI_BEFARING_FEATURE.md`)
  - Lik workflow, men for befaringer
  - Kan kombineres med prosjekt-innboks

- **Foto-innboks i Dashboard** (`FIELDNOTE_DASHBOARD_PLAN.md` seksjon 1.4)
  - Allerede planlagt
  - Kan brukes sammen

- **Presigned URLs + Thumbnails** (`FIELDNOTE_DASHBOARD_PLAN.md` seksjon 1.2)
  - Forbedrer ytelse
  - Kan implementeres senere

---

**Status:** Planlagt ✅  
**Neste steg:** Opprett `ProjectPhotoUpload.tsx` komponent

