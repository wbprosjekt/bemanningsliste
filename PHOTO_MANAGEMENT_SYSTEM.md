# FieldNote - Photo Management System

## 🎯 Vision: Komplett Photo Management System

**Dato:** October 19, 2025  
**Status:** DESIGN PHASE  
**Priority:** HIGH

---

## 🏗️ SYSTEM ARKITEKTUR

### **3-Lag Photo Management:**

```
┌─────────────────────────────────────────────────────────┐
│  LAG 1: DASHBOARD (Oversikt)                            │
│  - KPI Cards                                            │
│  - Photo Inbox Quick Access                             │
│  - Aktive Prosjekter                                    │
│  - Requires Action                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  LAG 2: PHOTO INBOX (Utaggede bilder)                   │
│  - Alle utaggede bilder                                 │
│  - Drag & Drop til prosjekter                           │
│  - Bulk tagging                                         │
│  - Filtrering og søk                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  LAG 3: PROSJEKT FOTO-BIBLIOTEK (Organisert)            │
│  - Alle bilder for et prosjekt                          │
│  - Knytt til befaringer/oppgaver                        │
│  - Kommentarer og metadata                              │
│  - Kategorisering og folders                            │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 LAG 1: DASHBOARD

### **Komponenter:**

#### **1. KPI Cards**
```typescript
interface KPICard {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  link?: string;
}

// Eksempel:
const kpiCards: KPICard[] = [
  {
    title: 'Aktive Prosjekter',
    value: 12,
    icon: <Building className="h-5 w-5" />,
    link: '/projects'
  },
  {
    title: 'Utaggede Bilder',
    value: 5,
    icon: <Image className="h-5 w-5" />,
    trend: 'up',
    link: '/photo-inbox'
  },
  {
    title: 'Åpne Oppgaver',
    value: 23,
    icon: <ClipboardList className="h-5 w-5" />,
    link: '/tasks'
  },
  {
    title: 'Venter på Godkjenning',
    value: 3,
    icon: <Clock className="h-5 w-5" />,
    trend: 'down'
  }
];
```

#### **2. Photo Inbox Quick Access**
```typescript
// Quick access card til Photo Inbox
<Card className="cursor-pointer hover:shadow-lg transition-shadow">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Image className="h-5 w-5" />
      Photo Inbox
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-3xl font-bold">{untaggedPhotos}</p>
        <p className="text-sm text-muted-foreground">Utaggede bilder</p>
      </div>
      <Button onClick={() => router.push('/photo-inbox')}>
        <ArrowRight className="h-4 w-4 mr-2" />
        Åpne Inbox
      </Button>
    </div>
    {untaggedPhotos > 0 && (
      <Badge variant="destructive" className="mt-2">
        Krever oppmerksomhet
      </Badge>
    )}
  </CardContent>
</Card>
```

#### **3. Aktive Prosjekter Liste**
```typescript
// Liste over aktive prosjekter med quick access
const activeProjects = [
  {
    id: '1',
    name: 'Prosjekt 1',
    photoCount: 12,
    taskCount: 5,
    lastActivity: '2 timer siden',
    status: 'active'
  },
  // ...
];

// Card for hvert prosjekt
<Card className="cursor-pointer hover:shadow-lg transition-shadow">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>{project.name}</CardTitle>
      <Badge variant="outline">{project.status}</Badge>
    </div>
  </CardHeader>
  <CardContent>
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <span className="flex items-center gap-1">
        <Image className="h-4 w-4" />
        {project.photoCount} bilder
      </span>
      <span className="flex items-center gap-1">
        <ClipboardList className="h-4 w-4" />
        {project.taskCount} oppgaver
      </span>
    </div>
    <div className="flex gap-2 mt-4">
      <Button size="sm" variant="outline" onClick={() => router.push(`/project/${project.id}`)}>
        <Eye className="h-4 w-4 mr-2" />
        Åpne
      </Button>
      <Button size="sm" variant="outline" onClick={() => router.push(`/project/${project.id}/photos`)}>
        <Image className="h-4 w-4 mr-2" />
        Foto-bibliotek
      </Button>
    </div>
  </CardContent>
</Card>
```

#### **4. Requires Action**
```typescript
// Seksjon for ting som krever oppmerksomhet
const requiresAction = [
  {
    type: 'photo',
    count: 5,
    message: 'bilder trenger tagging',
    action: 'Tag bilder',
    link: '/photo-inbox'
  },
  {
    type: 'befaring',
    count: 3,
    message: 'befaringer venter på godkjenning',
    action: 'Se befaringer',
    link: '/befaring'
  },
  {
    type: 'timer',
    count: 12,
    message: 'timer trenger kontroll',
    action: 'Kontroller timer',
    link: '/admin/timer'
  }
];

// Render
<div className="space-y-2">
  {requiresAction.map((item) => (
    <div key={item.type} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div>
        <p className="font-semibold">{item.count} {item.message}</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => router.push(item.link)}>
        {item.action}
      </Button>
    </div>
  ))}
</div>
```

---

## 📥 LAG 2: PHOTO INBOX

### **Features:**

#### **1. Grid-visning av utaggede bilder**
```typescript
// PhotoInbox.tsx
- Grid layout (responsive)
- Thumbnail preview
- Hover overlay med info
- Click for full view
```

#### **2. Drag & Drop til prosjekter**
```typescript
// Drag source: Photo
// Drop target: Project card

const handleDragStart = (photo: Photo) => {
  setDraggedPhoto(photo);
};

const handleDragOver = (e: React.DragEvent, project: Project) => {
  e.preventDefault();
  setHoveredProject(project.id);
};

const handleDrop = async (e: React.DragEvent, project: Project) => {
  e.preventDefault();
  
  // Update photo with project_id
  await supabase
    .from('oppgave_bilder')
    .update({ prosjekt_id: project.id })
    .eq('id', draggedPhoto.id);
  
  // Refresh inbox
  loadPhotos();
  
  toast({
    title: 'Bilde flyttet',
    description: `Bilde er nå knyttet til ${project.name}`
  });
};
```

#### **3. Bulk Tagging**
```typescript
// Select multiple photos
const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

const togglePhotoSelection = (photoId: string) => {
  setSelectedPhotos(prev => 
    prev.includes(photoId)
      ? prev.filter(id => id !== photoId)
      : [...prev, photoId]
  );
};

// Bulk tag
const handleBulkTag = async () => {
  for (const photoId of selectedPhotos) {
    await supabase
      .from('oppgave_bilder')
      .update({
        oppgave_id: selectedOppgave,
        is_tagged: true,
        tagged_by: user?.id,
        tagged_at: new Date().toISOString()
      })
      .eq('id', photoId);
  }
  
  toast({
    title: 'Bilder tagget',
    description: `${selectedPhotos.length} bilder er nå tagget`
  });
  
  loadPhotos();
  setSelectedPhotos([]);
};
```

#### **4. Filtrering og søk**
```typescript
// Filter by project
const [selectedProject, setSelectedProject] = useState<string | null>(null);

// Search by comment
const [searchQuery, setSearchQuery] = useState('');

// Filter photos
const filteredPhotos = photos.filter(photo => {
  const matchesProject = !selectedProject || photo.prosjekt_id === selectedProject;
  const matchesSearch = !searchQuery || 
    photo.comment?.toLowerCase().includes(searchQuery.toLowerCase());
  
  return matchesProject && matchesSearch;
});
```

---

## 📸 LAG 3: PROSJEKT FOTO-BIBLIOTEK

### **Features:**

#### **1. Vis alle bilder for et prosjekt**
```typescript
// ProjectPhotoLibrary.tsx
interface ProjectPhotoLibraryProps {
  projectId: string;
  orgId: string;
}

export default function ProjectPhotoLibrary({ projectId, orgId }: ProjectPhotoLibraryProps) {
  const { data: photos } = useQuery({
    queryKey: ['project-photos', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('oppgave_bilder')
        .select(`
          *,
          ttx_project_cache(project_name),
          befaringer(title),
          oppgaver(oppgave_nummer, fag)
        `)
        .eq('prosjekt_id', projectId)
        .order('created_at', { ascending: false });
      
      return data;
    }
  });
  
  // Render
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Foto-bibliotek</h1>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Last opp bilder
        </Button>
      </div>
      
      {/* Filters */}
      <div className="flex gap-2">
        <Button variant={selectedFilter === 'all' ? 'default' : 'outline'} onClick={() => setSelectedFilter('all')}>
          Alle ({photos?.length})
        </Button>
        <Button variant={selectedFilter === 'befaring' ? 'default' : 'outline'} onClick={() => setSelectedFilter('befaring')}>
          Befaringer
        </Button>
        <Button variant={selectedFilter === 'oppgave' ? 'default' : 'outline'} onClick={() => setSelectedFilter('oppgave')}>
          Oppgaver
        </Button>
        <Button variant={selectedFilter === 'general' ? 'default' : 'outline'} onClick={() => setSelectedFilter('general')}>
          Generelt
        </Button>
      </div>
      
      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredPhotos?.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} onEdit={handleEditPhoto} />
        ))}
      </div>
    </div>
  );
}
```

#### **2. Knytt til befaringer/oppgaver**
```typescript
// PhotoCard.tsx
interface PhotoCardProps {
  photo: Photo;
  onEdit: (photo: Photo) => void;
}

export default function PhotoCard({ photo, onEdit }: PhotoCardProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  
  return (
    <Card className="group cursor-pointer hover:shadow-lg transition-shadow">
      <div className="relative aspect-square">
        <img
          src={photo.image_url}
          alt={photo.comment || 'Photo'}
          className="w-full h-full object-cover rounded-t-lg"
        />
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowLinkDialog(true)}>
            <Link className="h-4 w-4 mr-1" />
            Knytt
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onEdit(photo)}>
            <Edit className="h-4 w-4 mr-1" />
            Rediger
          </Button>
        </div>
        
        {/* Badge for linked items */}
        {photo.oppgave_id && (
          <Badge className="absolute top-2 right-2">
            Oppgave #{photo.oppgaver?.oppgave_nummer}
          </Badge>
        )}
        {photo.befaring_id && (
          <Badge className="absolute top-2 right-2">
            Befaring
          </Badge>
        )}
      </div>
      
      <CardContent className="p-3">
        <p className="text-sm font-semibold truncate">
          {photo.comment || 'Uten kommentar'}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(photo.created_at), 'dd.MM.yyyy')}
        </p>
      </CardContent>
    </Card>
  );
}
```

#### **3. Kommentarer og metadata**
```typescript
// PhotoDetailDialog.tsx
export default function PhotoDetailDialog({ photo, open, onOpenChange }: PhotoDetailDialogProps) {
  const [comment, setComment] = useState(photo.comment || '');
  const [projectComment, setProjectComment] = useState(photo.project_comment || '');
  
  const handleSave = async () => {
    await supabase
      .from('oppgave_bilder')
      .update({
        comment,
        project_comment
      })
      .eq('id', photo.id);
    
    toast({
      title: 'Lagret',
      description: 'Kommentarer er oppdatert'
    });
    
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bilde Detaljer</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Image */}
          <div>
            <img
              src={photo.image_url}
              alt={photo.comment || 'Photo'}
              className="w-full h-auto rounded-lg"
            />
          </div>
          
          {/* Details */}
          <div className="space-y-4">
            <div>
              <Label>Kommentar (opprinnelig)</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Beskrivelse av bildet..."
                rows={3}
              />
            </div>
            
            <div>
              <Label>Prosjekt Kommentar</Label>
              <Textarea
                value={projectComment}
                onChange={(e) => setProjectComment(e.target.value)}
                placeholder="Notater for prosjektet..."
                rows={3}
              />
            </div>
            
            <div>
              <Label>Knyttet til</Label>
              <div className="space-y-2">
                {photo.oppgave_id && (
                  <Badge>
                    Oppgave #{photo.oppgaver?.oppgave_nummer} - {photo.oppgaver?.fag}
                  </Badge>
                )}
                {photo.befaring_id && (
                  <Badge>
                    Befaring: {photo.befaringer?.title}
                  </Badge>
                )}
                {!photo.oppgave_id && !photo.befaring_id && (
                  <Badge variant="outline">Generelt bilde</Badge>
                )}
              </div>
            </div>
            
            <div>
              <Label>Metadata</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Opplastet: {format(new Date(photo.created_at), 'dd.MM.yyyy HH:mm')}</p>
                <p>Av: {photo.uploaded_by_display_name}</p>
                <p>Størrelse: {(photo.file_size_bytes / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSave}>
            Lagre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### **4. Kategorisering og folders**
```typescript
// PhotoFolderManager.tsx
export default function PhotoFolderManager({ projectId }: { projectId: string }) {
  const { data: folders } = useQuery({
    queryKey: ['photo-folders', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('photo_library_folders')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      return data;
    }
  });
  
  const createFolder = async (name: string) => {
    await supabase
      .from('photo_library_folders')
      .insert({
        project_id: projectId,
        name,
        description: ''
      });
    
    // Refresh folders
    queryClient.invalidateQueries(['photo-folders', projectId]);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mappestruktur</h2>
        <Button onClick={() => setShowCreateFolderDialog(true)}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Ny mappe
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Default folders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Alle bilder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {totalPhotos} bilder
            </p>
          </CardContent>
        </Card>
        
        {/* Custom folders */}
        {folders?.map((folder) => (
          <Card key={folder.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                {folder.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {folder.photo_count || 0} bilder
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## 🗄️ DATABASE SCHEMA

```sql
-- Utvid oppgave_bilder tabell
ALTER TABLE oppgave_bilder
ADD COLUMN comment text,
ADD COLUMN project_comment text,
ADD COLUMN category text DEFAULT 'general',
ADD COLUMN is_highlighted boolean DEFAULT false,
ADD COLUMN folder_id uuid REFERENCES photo_library_folders(id) ON DELETE SET NULL;

-- Kommentarer på bilder
COMMENT ON COLUMN oppgave_bilder.comment IS 'Opprinnelig kommentar fra upload';
COMMENT ON COLUMN oppgave_bilder.project_comment IS 'Prosjekt-spesifikk kommentar';
COMMENT ON COLUMN oppgave_bilder.category IS 'Kategori: general, befaring, oppgave';
COMMENT ON COLUMN oppgave_bilder.is_highlighted IS 'Fremhevet bilde i prosjektet';
COMMENT ON COLUMN oppgave_bilder.folder_id IS 'Mappe for organisering';

-- Ny tabell for foto-bibliotek mappestruktur
CREATE TABLE photo_library_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES ttx_project_cache(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#6366f1',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Index for performance
CREATE INDEX idx_photo_library_folders_project_id ON photo_library_folders(project_id);
CREATE INDEX idx_oppgave_bilder_folder_id ON oppgave_bilder(folder_id);
CREATE INDEX idx_oppgave_bilder_category ON oppgave_bilder(category);
```

---

## 🔄 WORKFLOW

### **Scenario 1: Nytt bilde fra felt**
```
1. Bruker tar bilde i felten
2. Laster opp via "Foto" knapp i menyen
3. Velger "Uten prosjekt" eller "Med prosjekt"
4. Bilde går til Photo Inbox
5. Admin/manager får notifikasjon
6. Admin/manager åpner Photo Inbox
7. Dra bilde til prosjekt
8. Bilde går til prosjekt foto-bibliotek
9. Tag til befaring/oppgave (valgfritt)
10. Legg til kommentarer
```

### **Scenario 2: Organisering**
```
1. Admin åpner prosjekt foto-bibliotek
2. Se alle bilder for prosjektet
3. Filtrer per befaring/oppgave/kategori
4. Organiser i folders
5. Legg til prosjekt-kommentarer
6. Fremhev viktige bilder
7. Knytt bilder til spesifikke oppgaver
```

### **Scenario 3: Bulk tagging**
```
1. Admin åpner Photo Inbox
2. Se alle utaggede bilder
3. Velg flere bilder (checkbox)
4. Klikk "Tag Selected"
5. Velg befaring og oppgave
6. Alle bilder tagges samtidig
7. Bilder flyttes til prosjekt foto-bibliotek
```

---

## 📋 IMPLEMENTATION PLAN

### **Fase 1: Foundation (Dag 1-3)**
- ✅ Dashboard KPI cards
- ✅ Photo Inbox basic
- ✅ Foto-knapp i navigasjonsmenyen
- ✅ Database schema

### **Fase 2: Core Features (Dag 4-6)**
- ✅ Prosjekt foto-bibliotek
- ✅ Drag & drop til prosjekter
- ✅ Kommentarer og metadata
- ✅ Knytt til befaringer/oppgaver

### **Fase 3: Organization (Dag 7-9)**
- ✅ Folders og kategorisering
- ✅ Filtrering og søk
- ✅ Bulk tagging
- ✅ Highlight feature

### **Fase 4: Polish (Dag 10-12)**
- ✅ Notifikasjoner
- ✅ Real-time updates
- ✅ Bulk upload & drag & drop
- ✅ Testing og dokumentasjon

---

## 🎯 ACCEPTANCE CRITERIA

### **Must Have:**
- ✅ Dashboard med KPI cards
- ✅ Photo Inbox med utaggede bilder
- ✅ Prosjekt foto-bibliotek
- ✅ Drag & drop til prosjekter
- ✅ Kommentarer på bilder
- ✅ Knytt til befaringer/oppgaver
- ✅ Filtrering per kategori

### **Should Have:**
- ⏳ Folders og mappestruktur
- ⏳ Bulk tagging
- ⏳ Highlight feature
- ⏳ Søk i foto-bibliotek
- ⏳ Notifikasjoner

### **Nice to Have:**
- ⏳ AI-basert tagging
- ⏳ Automatisk kategorisering
- ⏳ Thumbnail preview
- ⏳ Advanced filters

---

## 🎯 REVIDERT ARBEIDSFLYT (October 20, 2025)

### **Problem med tidligere tilnærming:**
Den opprinnelige planen hadde en kompleks tagging-flyt med 3 valg (Prosjekt/Befaring/Oppgave) direkte fra untaggede bilder. Dette var tungt og krevde mange dropdowns.

### **Ny, enklere tilnærming:**

#### **Steg 1: Enkel tagging fra untaggede bilder**
```
┌─────────────────────────────────────────┐
│  Untaggede bilder                       │
│  [Bilde 1] [Bilde 2] [Bilde 3]         │
│                                         │
│  Klikk "Tag" → Velg prosjekt → Ferdig! │
└─────────────────────────────────────────┘
```

**UI:**
```typescript
<TagPhotoDialog>
  <DialogTitle>Tagge bilde</DialogTitle>
  <DialogDescription>Velg hvilket prosjekt bildet tilhører</DialogDescription>
  
  <Select>
    <SelectTrigger>
      <SelectValue placeholder="Velg prosjekt" />
    </SelectTrigger>
    <SelectContent>
      {projects.map(p => (
        <SelectItem key={p.id} value={p.id}>
          {p.name} #{p.number}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  
  <DialogFooter>
    <Button variant="outline" onClick={onClose}>Avbryt</Button>
    <Button onClick={handleTag}>Tagge bilde</Button>
  </DialogFooter>
</TagPhotoDialog>
```

**Implementasjon:**
- Bare ett valg: Velg prosjekt
- Setter `prosjekt_id` og `is_tagged = true`
- Bilde flyttes til prosjekt-fotobiblioteket

---

#### **Steg 2: Valgfri organisering fra fotobiblioteket**
```
┌─────────────────────────────────────────┐
│  Prosjekt Foto-bibliotek                │
│  [Bilde 1] [Bilde 2] [Bilde 3]         │
│                                         │
│  Klikk "Organiser" → Flytt til:        │
│  ○ Behold i fotobibliotek              │
│  ○ Befaring                            │
│  ○ Oppgave                             │
│  ○ Sjekkliste                          │
└─────────────────────────────────────────┘
```

**UI:**
```typescript
<OrganizePhotoDialog>
  <DialogTitle>Organiser bilde</DialogTitle>
  <DialogDescription>Hvor skal bildet organiseres?</DialogDescription>
  
  <RadioGroup value={organizationType} onValueChange={setOrganizationType}>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="library" id="library" />
      <Label htmlFor="library">Behold i fotobibliotek</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="befaring" id="befaring" />
      <Label htmlFor="befaring">Befaring</Label>
    </div>
    {organizationType === 'befaring' && (
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Velg befaring" />
        </SelectTrigger>
        <SelectContent>
          {befaringer.map(b => (
            <SelectItem key={b.id} value={b.id}>
              {b.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )}
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="oppgave" id="oppgave" />
      <Label htmlFor="oppgave">Oppgave</Label>
    </div>
    {organizationType === 'oppgave' && (
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Velg oppgave" />
        </SelectTrigger>
        <SelectContent>
          {oppgaver.map(o => (
            <SelectItem key={o.id} value={o.id}>
              Oppgave #{o.oppgave_nummer}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )}
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="sjekkliste" id="sjekkliste" />
      <Label htmlFor="sjekkliste">Sjekkliste</Label>
    </div>
  </RadioGroup>
  
  <DialogFooter>
    <Button variant="outline" onClick={onClose}>Avbryt</Button>
    <Button onClick={handleOrganize}>Flytt</Button>
  </DialogFooter>
</OrganizePhotoDialog>
```

**Implementasjon:**
- Valgfritt steg - kun for bilder som trenger mer spesifikk organisering
- Setter `oppgave_id`, `befaring_id`, eller `sjekkliste_id` hvis relevant
- Bilde beholdes i fotobiblioteket, men er også knyttet til spesifikk kontekst

---

### **Fordeler med ny tilnærming:**

✅ **Enklere for vanlig bruk** - 90% av bilder trenger bare å være i prosjektet  
✅ **Mindre kognitiv belastning** - Færre valg = bedre UX  
✅ **Progressive disclosure** - Vis bare det som er nødvendig nå  
✅ **Fleksibilitet** - Kan gjøre detaljert organisering senere hvis nødvendig  
✅ **Bedre oversikt** - Alle bilder i prosjektet først, deretter kategorisering  

---

### **Typisk bruk:**

**90% av tilfeller:**
```
"Jeg tok et bilde av jobben" 
→ Tag til prosjekt 
→ Ferdig! ✅
```

**10% av tilfeller:**
```
"Dette bildet er spesifikt for oppgave #5" 
→ Fra fotobiblioteket 
→ Organiser → Oppgave #5
```

---

### **Database endringer:**

**Ingen endringer nødvendig!** Vi bruker eksisterende struktur:
- `oppgave_bilder.prosjekt_id` - For fotobibliotek
- `oppgave_bilder.oppgave_id` - For oppgaver
- `oppgaver.befaring_id` - For befaringer (via oppgave)

**Fremtidig:**
- Kan legge til `sjekkliste_id` når sjekkliste-funksjonen implementeres

---

## 📚 REFERANSEDOKUMENTER

- `PROJEKT_INNBOKS_INTEGRATION_PLAN.md` - Original integration plan
- `FIELDNOTE_DASHBOARD_PLAN.md` - Dashboard plan
- `SESSION_SUMMARY_20251019.md` - Session summary
- `DASHBOARD_WIREFRAME.md` - Dashboard wireframe

---

## 🏁 STATUS

**Status:** DESIGN COMPLETE  
**Next Step:** Start Fase 1 - Foundation  
**Estimated Time:** 10-12 dager  
**Priority:** HIGH

### **Design Decisions:**
- ✅ 3-lag system (Dashboard → Inbox → Library)
- ✅ **Enkel tagging-flyt** - Bare velg prosjekt fra untaggede bilder
- ✅ **Progressive disclosure** - Valgfri organisering fra fotobiblioteket
- ✅ Kommentarer på flere nivåer
- ✅ Folders for organisering
- ✅ Bulk operations
- ✅ Real-time updates

### **Recent Changes:**
- 🔄 **October 20, 2025:** Revidert arbeidsflyt - Enklere tagging-flyt
  - Fjernet kompleks tagging med 3 valg fra untaggede bilder
  - Ny tilnærming: Tag til prosjekt → Valgfri organisering fra fotobiblioteket
  - Bedre UX med progressive disclosure

---

*Last Updated: October 20, 2025*

