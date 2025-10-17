# "Fri Befaring" Feature - Detaljert Plan

**Dato:** 14. oktober 2025  
**Prioritet:** ⭐⭐ Høy  
**Status:** Planlagt  
**Estimat:** 4-6 timer

---

## 🎯 PROBLEM

Feltarbeider ute i felten:
- "Jeg må lage en befaring, men jeg vet ikke hvilket prosjekt dette er..."
- "Jeg har ikke tid til å søke gjennom 200+ prosjekter nå"
- "Jeg bare tar bilder og oppgaver, så fikser vi prosjektet senere"

**Nåværende løsning krever:**
- ✅ Velge prosjekt fra dropdown (obligatorisk)
- ❌ Søke gjennom hundrevis av prosjekter
- ❌ Sløser tid for feltarbeider

---

## 💡 LØSNING: "Fri Befaring"

Feltarbeider kan lage befaring **UTEN** å velge prosjekt. Alt data lagres, og admin kan knytte til riktig prosjekt senere.

---

## 🔄 WORKFLOW

### Feltarbeider (Mobil):
```
1. Åpne "Ny Befaring"
2. Fyll inn: Tittel, Dato, Beskrivelse
3. Klikk "Skip prosjekt" (eller "Knytt senere")
4. Lagre befaring
5. Legg til oppgaver + bilder
6. Alt lagres under "fri befaring"
```

### Admin (Kontor):
```
1. Åpne Dashboard
2. Se "Frie Befaringer" card (rød alert)
3. Klikk "Knytt til prosjekt"
4. Velg prosjekt fra dropdown
5. Alle oppgaver/bilder flyttes automatisk
6. Befaring er nå "knyttet"
```

---

## 📊 DATABASE ENDRINGER

### 1. Alter `befaringer` tabell

```sql
-- Steg 1: Gjør tripletex_project_id nullable (temporary)
ALTER TABLE befaringer
ALTER COLUMN tripletex_project_id DROP NOT NULL;

-- Steg 2: Legg til "fri befaring" kolonner
ALTER TABLE befaringer
ADD COLUMN is_orphaned boolean DEFAULT false,
ADD COLUMN orphaned_until timestamptz;

-- Steg 3: Index for rask oppslag
CREATE INDEX idx_befaring_orphaned 
ON befaringer(org_id, is_orphaned, created_at DESC)
WHERE is_orphaned = true;

-- Steg 4: Constraint check
ALTER TABLE befaringer
ADD CONSTRAINT check_orphaned_consistency 
CHECK (
  (is_orphaned = true AND tripletex_project_id IS NULL) OR
  (is_orphaned = false AND tripletex_project_id IS NOT NULL)
);
```

### 2. View for "Frie Befaringer"

```sql
CREATE OR REPLACE VIEW orphaned_befaringer_summary AS
SELECT 
  b.id,
  b.title,
  b.befaring_date,
  b.description,
  b.org_id,
  b.created_at,
  b.created_by,
  
  -- Counts
  COUNT(DISTINCT o.id) as oppgaver_count,
  COUNT(DISTINCT img.id) as bilder_count,
  
  -- Metadata
  EXTRACT(EPOCH FROM (now() - b.created_at)) / 3600 as hours_old
  
FROM befaringer b
LEFT JOIN oppgaver o ON o.befaring_id = b.id
LEFT JOIN oppgave_bilder img ON img.befaring_id = b.id

WHERE b.is_orphaned = true
  AND b.org_id = current_setting('app.current_org_id')::uuid

GROUP BY b.id
ORDER BY b.created_at DESC;
```

---

## 🎨 UI ENDRINGER

### 1. CreateBefaringDialog.tsx

**Endringer:**
- Legg til "Skip prosjekt" knapp
- Hvis skipProject = true: Ikke vis prosjekt-dropdown
- Lagre med `tripletex_project_id = null`, `is_orphaned = true`

**Kode:**
```typescript
const [skipProject, setSkipProject] = useState(false);

// I JSX:
{!skipProject && (
  <div>
    <Label>Prosjekt *</Label>
    <ProjectSelector
      value={selectedProject}
      onChange={setSelectedProject}
      placeholder="Søk etter prosjekt..."
    />
  </div>
)}

<div className="flex items-center space-x-2">
  <Button
    type="button"
    variant="outline"
    onClick={() => setSkipProject(true)}
    disabled={skipProject}
  >
    {skipProject ? '✓ Skippet prosjekt' : 'Skip prosjekt (knytt senere)'}
  </Button>
  
  {skipProject && (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setSkipProject(false)}
    >
      Velg prosjekt
    </Button>
  )}
</div>

{skipProject && (
  <Alert className="bg-orange-50 border-orange-200">
    <AlertCircle className="h-4 w-4 text-orange-600" />
    <AlertDescription className="text-orange-800">
      Du kan knytte denne befaringen til et prosjekt senere fra dashboardet.
    </AlertDescription>
  </Alert>
)}

// I handleSave:
const { data, error } = await supabase
  .from('befaringer')
  .insert({
    title,
    befaring_date,
    description,
    tripletex_project_id: skipProject ? null : selectedProject,
    is_orphaned: skipProject,
    org_id: orgId,
    created_by: user.id
  });
```

### 2. BefaringList.tsx

**Endringer:**
- Hent frie befaringer separat
- Vis i egen seksjon (rød alert)

**Kode:**
```typescript
const [orphanedBefaringer, setOrphanedBefaringer] = useState([]);

useEffect(() => {
  const fetchOrphanedBefaringer = async () => {
    const { data, error } = await supabase
      .from('befaringer')
      .select(`
        *,
        oppgaver(count),
        oppgave_bilder(count)
      `)
      .eq('org_id', orgId)
      .eq('is_orphaned', true)
      .order('created_at', { ascending: false });
    
    if (data) setOrphanedBefaringer(data);
  };
  
  fetchOrphanedBefaringer();
}, [orgId]);

// I JSX (før vanlige befaringer):
{orphanedBefaringer.length > 0 && (
  <Card className="border-orange-500 bg-orange-50 mb-6">
    <CardHeader>
      <CardTitle className="text-orange-700 flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        Frie Befaringer ({orphanedBefaringer.length})
      </CardTitle>
      <CardDescription>
        Disse må knyttes til et prosjekt
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {orphanedBefaringer.map(befaring => (
          <div 
            key={befaring.id}
            className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200"
          >
            <div>
              <p className="font-medium">{befaring.title}</p>
              <p className="text-sm text-gray-500">
                {befaring.oppgaver?.[0]?.count || 0} oppgaver · {' '}
                {befaring.oppgave_bilder?.[0]?.count || 0} bilder · {' '}
                {new Date(befaring.created_at).toLocaleDateString('no-NO')}
              </p>
            </div>
            <Button 
              size="sm" 
              onClick={() => openLinkDialog(befaring)}
            >
              Knytt til prosjekt
            </Button>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

### 3. LinkBefaringDialog.tsx (NY KOMPONENT)

**Funksjon:**
- Dialog for å knytte befaring til prosjekt
- Velg prosjekt fra dropdown
- Bekreft → Flytt alle oppgaver/bilder

**Kode:**
```typescript
'use client';

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LinkBefaringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  befaring: {
    id: string;
    title: string;
    oppgaver_count: number;
    bilder_count: number;
  };
  onSuccess?: () => void;
}

export default function LinkBefaringDialog({
  open,
  onOpenChange,
  befaring,
  onSuccess
}: LinkBefaringDialogProps) {
  const { orgId } = useAuth();
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

  // Fetch projects
  useEffect(() => {
    if (open) {
      const fetchProjects = async () => {
        const { data, error } = await supabase
          .from('ttx_project_cache')
          .select('id, project_name, project_number, customer_name')
          .eq('org_id', orgId)
          .eq('is_active', true)
          .order('project_name');
        
        if (data) setProjects(data);
      };
      
      fetchProjects();
    }
  }, [open, orgId]);

  const handleLink = async () => {
    if (!selectedProject) {
      toast({
        title: 'Velg prosjekt',
        description: 'Du må velge et prosjekt først',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Update befaring
      const { error: befaringError } = await supabase
        .from('befaringer')
        .update({
          tripletex_project_id: selectedProject,
          is_orphaned: false,
          orphaned_until: null
        })
        .eq('id', befaring.id);

      if (befaringError) throw befaringError;

      // 2. Update alle oppgaver (hvis de ikke har prosjekt)
      const { error: oppgaverError } = await supabase
        .from('oppgaver')
        .update({ project_id: selectedProject })
        .eq('befaring_id', befaring.id)
        .is('project_id', null);

      if (oppgaverError) throw oppgaverError;

      // 3. Update alle bilder (hvis de ikke har prosjekt)
      const { error: bilderError } = await supabase
        .from('oppgave_bilder')
        .update({ prosjekt_id: selectedProject })
        .eq('befaring_id', befaring.id)
        .is('prosjekt_id', null);

      if (bilderError) throw bilderError;

      // 4. Success!
      toast({
        title: 'Befaring knyttet',
        description: `${befaring.title} er nå knyttet til prosjektet`,
      });

      onSuccess?.();
      onOpenChange(false);
      setSelectedProject('');

    } catch (error) {
      console.error('Error linking befaring:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke knytte befaring til prosjekt',
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
          <DialogTitle>Knytt befaring til prosjekt</DialogTitle>
          <DialogDescription>
            Velg hvilket prosjekt denne befaringen tilhører
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Befaring</Label>
            <p className="text-sm text-gray-600 mt-1">{befaring.title}</p>
            <p className="text-xs text-gray-500 mt-1">
              {befaring.oppgaver_count} oppgaver · {befaring.bilder_count} bilder
            </p>
          </div>

          <div>
            <Label htmlFor="project">Prosjekt *</Label>
            <select
              id="project"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-md"
              disabled={loading}
            >
              <option value="">Velg prosjekt...</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.project_number} - {project.project_name}
                  {project.customer_name && ` (${project.customer_name})`}
                </option>
              ))}
            </select>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Alle oppgaver og bilder vil bli flyttet til dette prosjektet.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Avbryt
          </Button>
          <Button 
            onClick={handleLink}
            disabled={loading || !selectedProject}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Knytt til prosjekt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 4. ProjectDashboard.tsx

**Endringer:**
- Legg til "Frie Befaringer" card
- Vis alert hvis det er frie befaringer

**Kode:**
```typescript
const [orphanedBefaringer, setOrphanedBefaringer] = useState<any[]>([]);

useEffect(() => {
  const fetchOrphanedBefaringer = async () => {
    const { data, error } = await supabase
      .from('orphaned_befaringer_summary')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (data) setOrphanedBefaringer(data);
  };
  
  if (orgId) fetchOrphanedBefaringer();
}, [orgId]);

// I JSX (før andre cards):
{orphanedBefaringer.length > 0 && (
  <Card className="border-orange-500 bg-orange-50">
    <CardHeader>
      <CardTitle className="text-orange-700 flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        Frie Befaringer
      </CardTitle>
      <CardDescription>
        {orphanedBefaringer.length} befaring(er) uten prosjekt
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {orphanedBefaringer.map(befaring => (
          <div 
            key={befaring.id}
            className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200"
          >
            <div>
              <p className="font-medium text-sm">{befaring.title}</p>
              <p className="text-xs text-gray-500">
                {befaring.oppgaver_count} oppgaver, {befaring.bilder_count} bilder
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => openLinkDialog(befaring)}
            >
              Knytt
            </Button>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

---

## 🧪 TESTING CHECKLIST

### Unit Tests:
- [ ] `CreateBefaringDialog` - Skip prosjekt knapp fungerer
- [ ] `CreateBefaringDialog` - Lagre med `is_orphaned = true`
- [ ] `LinkBefaringDialog` - Velg prosjekt og knytt
- [ ] `linkBefaringToProject()` - Alle oppgaver/bilder flyttes

### Integration Tests:
- [ ] Feltarbeider lager fri befaring
- [ ] Feltarbeider legger til oppgaver + bilder
- [ ] Admin ser fri befaring i dashboard
- [ ] Admin knytter til prosjekt
- [ ] Alle oppgaver/bilder flyttes korrekt
- [ ] Befaring vises nå under riktig prosjekt

### Edge Cases:
- [ ] Hva hvis befaring har 0 oppgaver? (kun bilder)
- [ ] Hva hvis befaring har 0 bilder? (kun oppgaver)
- [ ] Hva hvis befaring har både oppgaver med/uten prosjekt?
- [ ] Hva hvis befaring har bilder med/uten prosjekt?

---

## 📋 IMPLEMENTERING STEG

### Dag 1 (2 timer):
1. ✅ Database migrasjon (alter tabell + view)
2. ✅ Test migrasjon i Supabase
3. ✅ `CreateBefaringDialog.tsx` - Legg til skip knapp

### Dag 2 (2 timer):
4. ✅ `BefaringList.tsx` - Vis frie befaringer
5. ✅ `LinkBefaringDialog.tsx` - Ny komponent
6. ✅ Backend: `linkBefaringToProject()` funksjon

### Dag 3 (2 timer):
7. ✅ `ProjectDashboard.tsx` - Frie befaringer card
8. ✅ Testing: Full workflow
9. ✅ Bug fixes

---

## 🚨 RISIKO & MITIGERING

### Risiko 1: Frie befaringer blir glemt
**Mitigering:**
- Dashboard alert (rød card)
- Email reminder etter 7 dager (fase 2)
- Max 10 frie befaringer per org (hard limit)

### Risiko 2: Feltarbeider glemmer å knytte
**Mitigering:**
- Auto-knytt basert på GPS-lokasjon (fase 2)
- Admin får notifikasjon ved nye frie befaringer

### Risiko 3: Flere frie befaringer blir kaotisk
**Mitigering:**
- Max 10 frie befaringer per org (hard limit)
- Dashboard viser kun top 5
- Link til full liste

---

## 🎯 ACCEPTANCE CRITERIA

- [ ] Feltarbeider kan lage befaring uten prosjekt
- [ ] Feltarbeider kan legge til oppgaver + bilder
- [ ] Admin ser alle frie befaringer i dashboard
- [ ] Admin kan knytte befaring til prosjekt
- [ ] Alle oppgaver/bilder flyttes automatisk
- [ ] Befaring vises nå under riktig prosjekt
- [ ] Ingen data-tap under flytting
- [ ] Audit log registrerer alle endringer

---

## 📝 NOTATER

- **Prioritet:** Høy (bedre UX for feltarbeidere)
- **Kompleksitet:** Medium (database + UI + backend)
- **Estimat:** 4-6 timer
- **Avhengigheter:** Ingen
- **Blokkerer:** Dashboard UI (kan gjøres parallelt)

---

**Status:** Planlagt ✅  
**Neste steg:** Start med database migrasjon

