# Project Inbox Integration Plan

## 🎯 Status: READY FOR INTEGRATION

**Dato:** October 19, 2025  
**Branch:** `feature/befaring-module`  
**Version:** 0.2.94

---

## ✅ HVA VI ALLEREDE HAR

### **Database** ✅
- `oppgave_bilder.comment` - Kommentar for utaggede bilder
- `oppgave_bilder.oppgave_id` - Nullable (NULL for inbox-bilder)
- `oppgave_bilder.prosjekt_id` - For å knytte til prosjekt
- `oppgave_bilder.is_tagged` - Boolean (false for inbox-bilder)
- `oppgave_bilder.inbox_date` - Dato når bildet ble lastet opp
- RLS policies for `oppgave_bilder`

### **Komponenter** ✅
- `ProjectPhotoUpload.tsx` - Upload med/uten prosjekt
  - To moduser: "Med prosjekt" eller "Uten prosjekt"
  - Kommentar-felt når uten prosjekt
  - Drag & drop, file selection
  - Komprimering til 5MB
  - Mobile-optimeret

- `PhotoInbox.tsx` - Visning av utaggede bilder
  - Grid-visning av alle utaggede bilder
  - Filtrer per prosjekt
  - Image viewer modal
  - Info om prosjekt, kommentar, dato, bruker
  - Mobile-optimeret

### **Test Pages** ✅
- `/test-upload` - Test upload-funksjonen
- `/test-inbox` - Test inbox-visningen

---

## 🚀 NESTE STEG - IMPLEMENTATION

### **Prioritet 1: Integrer i Timeføring (`min/uke`)** 🔥

**Mål:** La brukere laste opp bilder direkte fra timeføring

**Filer å endre:**
- `src/app/min/uke/page.tsx` (eller `src/app/min/uke-v2/page.tsx`)

**Implementasjon:**
```typescript
1. Legg til "Upload Photo" knapp i UI
2. Åpne ProjectPhotoUpload dialog
3. La brukeren velge:
   - "Med prosjekt" → Velg prosjekt fra dropdown
   - "Uten prosjekt" → Skriv kommentar
4. Upload bilder til prosjekt-innboks
5. Vis toast "Bilder lastet opp til prosjekt-innboks"
```

**Kode-eksempel:**
```typescript
import ProjectPhotoUpload from '@/components/ProjectPhotoUpload';

// I komponenten:
const [showPhotoUpload, setShowPhotoUpload] = useState(false);
const [orgId, setOrgId] = useState('');

// Legg til knapp:
<Button onClick={() => setShowPhotoUpload(true)}>
  <Camera className="h-4 w-4 mr-2" />
  Last opp bilder
</Button>

// Dialog:
{showPhotoUpload && (
  <ProjectPhotoUpload
    open={showPhotoUpload}
    onOpenChange={setShowPhotoUpload}
    orgId={orgId}
  />
)}
```

---

### **Prioritet 2: Implementer Tagging-funksjon** 🔥

**Mål:** La brukere tagge bilder fra inbox til oppgaver

**Filer å endre:**
- `src/components/PhotoInbox.tsx`

**Implementasjon:**
```typescript
1. Legg til "Tag" knapp på hvert bilde
2. Åpne TagPhotoDialog
3. La brukeren velge:
   - Befaring
   - Oppgave (hvis relevant)
4. Oppdater oppgave_id i database
5. Set is_tagged = true
6. Fjern bildet fra inbox (eller vis som "tagged")
```

**Kode-eksempel:**
```typescript
// Ny komponent: TagPhotoDialog.tsx
interface TagPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photo: Photo;
  orgId: string;
  onSuccess: () => void;
}

export default function TagPhotoDialog({ open, onOpenChange, photo, orgId, onSuccess }: TagPhotoDialogProps) {
  const [selectedBefaring, setSelectedBefaring] = useState('');
  const [selectedOppgave, setSelectedOppgave] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Hent befaringer for prosjektet
  const { data: befaringer } = useQuery({
    queryKey: ['befaringer', photo.prosjekt_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('befaringer')
        .select('*')
        .eq('tripletex_project_id', photo.prosjekt_id)
        .order('befaring_date', { ascending: false });
      return data;
    }
  });
  
  // Hent oppgaver for befaringen
  const { data: oppgaver } = useQuery({
    queryKey: ['oppgaver', selectedBefaring],
    queryFn: async () => {
      if (!selectedBefaring) return [];
      const { data } = await supabase
        .from('oppgaver')
        .select('*')
        .eq('befaring_id', selectedBefaring)
        .order('oppgave_nummer', { ascending: true });
      return data;
    },
    enabled: !!selectedBefaring
  });
  
  const handleTag = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('oppgave_bilder')
        .update({
          oppgave_id: selectedOppgave,
          is_tagged: true,
          tagged_by: user?.id,
          tagged_at: new Date().toISOString()
        })
        .eq('id', photo.id);
      
      if (error) throw error;
      
      toast({
        title: 'Bilde tagget',
        description: 'Bildet er nå knyttet til oppgaven'
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error tagging photo:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke tagge bildet',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tag bilde</DialogTitle>
          <DialogDescription>
            Velg hvilken befaring og oppgave bildet skal til
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Velg befaring */}
          <div>
            <Label>Befaring</Label>
            <Select value={selectedBefaring} onValueChange={setSelectedBefaring}>
              <SelectTrigger>
                <SelectValue placeholder="Velg befaring" />
              </SelectTrigger>
              <SelectContent>
                {befaringer?.map((befaring) => (
                  <SelectItem key={befaring.id} value={befaring.id}>
                    {befaring.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Velg oppgave (hvis relevant) */}
          {selectedBefaring && (
            <div>
              <Label>Oppgave (valgfritt)</Label>
              <Select value={selectedOppgave} onValueChange={setSelectedOppgave}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg oppgave (valgfritt)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ingen oppgave (generelt bilde)</SelectItem>
                  {oppgaver?.map((oppgave) => (
                    <SelectItem key={oppgave.id} value={oppgave.id}>
                      #{oppgave.oppgave_nummer} - {oppgave.fag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleTag} disabled={loading || !selectedBefaring}>
            {loading ? 'Tagger...' : 'Tag bilde'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### **Prioritet 3: Dashboard-integrasjon** 🔥

**Mål:** Vis photo inbox i dashboard

**Filer å endre:**
- `src/components/ProjectDashboard.tsx` (eller ny dashboard)

**Implementasjon:**
```typescript
1. Legg til "Photo Inbox" card i dashboard
2. Vis antall utaggede bilder
3. Quick link til inbox
4. "Requires action" notifikasjon hvis > 0 bilder
```

**Kode-eksempel:**
```typescript
// I ProjectDashboard.tsx
const { data: untaggedPhotos } = useQuery({
  queryKey: ['untagged-photos', orgId],
  queryFn: async () => {
    const { data } = await supabase
      .from('oppgave_bilder')
      .select('id')
      .eq('org_id', orgId)
      .eq('is_tagged', false);
    return data?.length || 0;
  }
});

// I UI:
<Card className="cursor-pointer" onClick={() => router.push('/photo-inbox')}>
  <CardHeader>
    <CardTitle>Photo Inbox</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex items-center justify-between">
      <span className="text-2xl font-bold">{untaggedPhotos}</span>
      <span className="text-sm text-muted-foreground">Utaggede bilder</span>
    </div>
    {untaggedPhotos > 0 && (
      <Badge variant="destructive" className="mt-2">
        Krever oppmerksomhet
      </Badge>
    )}
  </CardContent>
</Card>
```

---

### **Prioritet 4: Fjern Test Pages** 🔥

**Mål:** Rydd opp etter integrasjon

**Filer å slette:**
- `src/app/test-upload/page.tsx`
- `src/app/test-inbox/page.tsx`

**Når:**
- Etter at integrasjon er ferdig og testet

---

## 📋 ACCEPTANCE CRITERIA

### **Must Have:**
- ✅ Brukere kan laste opp bilder fra navigasjonsmenyen
- ✅ Brukere kan velge "Med prosjekt" eller "Uten prosjekt"
- ✅ Brukere kan se alle utaggede bilder i inbox
- ✅ **Kun admin/manager kan tagge bilder**
- ✅ Dashboard viser antall utaggede bilder
- ✅ Foto-knapp i navigasjonsmenyen (alle brukere)

### **Should Have:**
- ⏳ Filtrering per prosjekt i inbox
- ⏳ Søk i inbox
- ⏳ Bulk upload (flere bilder samtidig)
- ⏳ Drag & drop upload
- ⏳ Notifikasjoner når nye bilder kommer inn (admin/manager)

### **Nice to Have:**
- ⏳ Notifikasjoner for befaringer og timer
- ⏳ Bulk tagging (tag flere bilder samtidig)
- ⏳ AI-basert tagging (forslag)
- ⏳ Thumbnail preview
- ⏳ Real-time updates

---

## 🎯 IMPLEMENTATION ORDER

### **Fase 1: Core Functionality (Dag 1-2)**

#### **Dag 1: Navigation & Upload**
1. ✅ Legg til "Foto" knapp i navigasjonsmenyen
   - AdminNavigation.tsx
   - EmployeeNavigation.tsx
   - Camera ikon (lucide-react)
   - Kun ikon på mobil, tekst på desktop
2. ✅ Åpne ProjectPhotoUpload dialog fra menyen
3. ✅ Test upload-funksjonen
4. ✅ Fjern test pages

#### **Dag 2: Photo Inbox**
1. ✅ Opprett `/photo-inbox` side
2. ✅ Integrer PhotoInbox komponent
3. ✅ Vis alle utaggede bilder
4. ✅ Filtrering per prosjekt
5. ✅ Image viewer modal

### **Fase 2: Tagging & Access Control (Dag 3-4)**

#### **Dag 3: Tagging Functionality**
1. ✅ Implementer TagPhotoDialog
2. ✅ Legg til "Tag" knapp i PhotoInbox
3. ✅ **Access Control:** Kun admin/manager kan tagge
4. ✅ Test tagging-funksjonen

#### **Dag 4: Dashboard Integration**
1. ✅ Legg til "Photo Inbox" card i dashboard
2. ✅ Vis antall utaggede bilder
3. ✅ Quick link til inbox
4. ✅ "Requires action" notifikasjon

### **Fase 3: Advanced Features (Dag 5-7)**

#### **Dag 5-6: Notifikasjoner**
1. ✅ Implementer notifikasjonssystem
   - Når nye bilder kommer inn → Notify admin/manager
   - Når nye befaringer opprettes → Notify admin/manager
   - Når timer sendes inn → Notify admin/manager
2. ✅ Real-time updates (Supabase Realtime)
3. ✅ Bell icon i navigasjon med badge
4. ✅ Notifikasjons-center

#### **Dag 7: Bulk Upload & Drag & Drop**
1. ✅ Implementer bulk upload
   - Velg flere bilder samtidig
   - Progress bar for hvert bilde
   - Batch processing
2. ✅ Implementer drag & drop
   - Drag bilder fra filutforsker
   - Drop i upload-området
   - Visual feedback
3. ✅ Test på forskjellige enheter

---

## 🔔 NOTIFIKASJONSSYSTEM

### **Design Decision:**
- ✅ Notifikasjoner for admin/manager når:
  - Nye bilder lastes opp
  - Nye befaringer opprettes
  - Timer sendes inn
- ✅ Real-time updates med Supabase Realtime
- ✅ Bell icon i navigasjon med badge
- ✅ Notifikasjons-center

### **Implementasjon:**

#### **1. Database Schema**
```sql
-- Notifikasjoner tabell
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES org(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'photo_upload', 'befaring_created', 'timer_submitted'
  title text NOT NULL,
  message text NOT NULL,
  entity_type text, -- 'photo', 'befaring', 'timer'
  entity_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- Index for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

#### **2. Supabase Realtime**
```typescript
// Listen for new notifications
useEffect(() => {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`
      },
      (payload) => {
        // Show toast notification
        toast({
          title: payload.new.title,
          description: payload.new.message,
        });
        
        // Update notification count
        setUnreadCount(prev => prev + 1);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user]);
```

#### **3. Notification Bell Component**
```typescript
// NotificationBell.tsx
export default function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20);
      return data;
    }
  });
  
  return (
    <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifikasjoner</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications?.map((notification) => (
          <DropdownMenuItem
            key={notification.id}
            onClick={() => handleNotificationClick(notification)}
          >
            <div className="flex flex-col">
              <span className="font-semibold">{notification.title}</span>
              <span className="text-xs text-muted-foreground">
                {notification.message}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### **4. Trigger Notifications**
```typescript
// Når bilde lastes opp
const createNotification = async (orgId: string, type: string, title: string, message: string) => {
  // Hent alle admin/manager i org
  const { data: admins } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('org_id', orgId)
    .in('role', ['admin', 'manager']);
  
  // Opprett notifikasjoner
  const notifications = admins?.map(admin => ({
    user_id: admin.user_id,
    org_id: orgId,
    type,
    title,
    message,
    is_read: false
  }));
  
  if (notifications) {
    await supabase.from('notifications').insert(notifications);
  }
};

// Eksempel: Når bilde lastes opp
await createNotification(
  orgId,
  'photo_upload',
  'Nytt bilde lastet opp',
  `${user?.email} har lastet opp et bilde til prosjekt-innboks`
);
```

---

## 🔒 ACCESS CONTROL

### **Design Decision:**
- ✅ **Alle brukere** kan laste opp bilder
- ✅ **Kun admin/manager** kan tagge bilder
- ✅ **Kun admin/manager** ser notifikasjoner

### **Implementasjon:**

#### **1. Role-based Access Control**
```typescript
// Check if user can tag photos
const canTagPhotos = (role: string | null) => {
  return role === 'admin' || role === 'manager';
};

// In PhotoInbox.tsx
{canTagPhotos(profile.role) && (
  <Button onClick={() => handleTagPhoto(photo)}>
    <Tag className="h-4 w-4 mr-2" />
    Tag bilde
  </Button>
)}
```

#### **2. Protected Routes**
```typescript
// Only admin/manager can access photo inbox
<ProtectedRoute requiredRole="admin-manager">
  <PhotoInbox orgId={orgId} />
</ProtectedRoute>
```

#### **3. Database RLS Policies**
```sql
-- Only admin/manager can update (tag) photos
CREATE POLICY "Only admin/manager can tag photos"
ON oppgave_bilder
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'manager')
  )
);
```

---

## 📸 BULK UPLOAD & DRAG & DROP

### **Design Decision:**
- ✅ **Bulk upload:** Velg flere bilder samtidig
- ✅ **Drag & drop:** Drag bilder fra filutforsker
- ✅ **Progress bar:** Vis fremgang for hvert bilde
- ✅ **Batch processing:** Last opp alle bilder i en batch

### **Implementasjon:**

#### **1. Bulk Upload**
```typescript
// ProjectPhotoUpload.tsx
const handleFileSelect = (files: FileList | null) => {
  if (!files) return;
  
  const fileArray = Array.from(files);
  setSelectedFiles(prev => [...prev, ...fileArray]);
};

// Allow multiple file selection
<input
  ref={fileInputRef}
  type="file"
  multiple
  accept="image/*"
  capture="environment"
  onChange={(e) => handleFileSelect(e.target.files)}
  className="hidden"
/>
```

#### **2. Drag & Drop**
```typescript
const [dragOver, setDragOver] = useState(false);

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setDragOver(false);
  
  const files = e.dataTransfer.files;
  const fileArray = Array.from(files);
  setSelectedFiles(prev => [...prev, ...fileArray]);
};

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  setDragOver(true);
};

const handleDragLeave = () => {
  setDragOver(false);
};

// In JSX
<div
  className={`border-2 border-dashed rounded-lg p-8 text-center ${
    dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
  }`}
  onDrop={handleDrop}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
>
  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
  <p className="text-sm text-gray-600 mb-2">
    Dra bilder hit eller klikk for å velge
  </p>
  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
    <ImageIcon className="h-4 w-4 mr-2" />
    Velg bilder
  </Button>
</div>
```

#### **3. Progress Bar**
```typescript
const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});

const handleUpload = async () => {
  for (const file of selectedFiles) {
    const fileId = `${file.name}-${Date.now()}`;
    
    // Start upload
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
    
    // Upload with progress tracking
    const { error } = await supabase.storage
      .from('befaring-assets')
      .upload(filePath, file, {
        onUploadProgress: (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
          setUploadProgress(prev => ({ ...prev, [fileId]: percent }));
        }
      });
    
    if (error) {
      console.error('Upload error:', error);
      setUploadProgress(prev => ({ ...prev, [fileId]: -1 })); // Error state
    } else {
      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
    }
  }
};

// Progress bar UI
{Object.entries(uploadProgress).map(([fileId, progress]) => (
  <div key={fileId} className="space-y-2">
    <div className="flex justify-between text-sm">
      <span>{fileId}</span>
      <span>{progress}%</span>
    </div>
    <Progress value={progress} />
  </div>
))}
```

---

## 📚 REFERANSEDOKUMENTER

- `PROJEKT_INNBOKS_FEATURE.md` - Original feature spec
- `FIELDNOTE_DASHBOARD_PLAN.md` - Dashboard plan
- `SESSION_SUMMARY_20251019.md` - Session summary

---

## 🏁 STATUS

**Status:** READY FOR INTEGRATION  
**Next Step:** Legg til "Foto" knapp i navigasjonsmenyen  
**Estimated Time:** 5-7 dager (inkl. notifikasjoner og bulk upload)  
**Priority:** HIGH

### **Design Decisions:**
- ✅ Foto-knapp i navigasjonsmenyen (alle brukere)
- ✅ Kun admin/manager kan tagge bilder
- ✅ Notifikasjoner for admin/manager (bilder, befaringer, timer)
- ✅ Bulk upload og drag & drop
- ✅ Real-time updates med Supabase Realtime

---

*Last Updated: October 19, 2025*

