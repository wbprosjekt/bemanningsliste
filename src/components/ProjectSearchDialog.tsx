import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, User, Building } from 'lucide-react';
import { getPersonDisplayName } from '@/lib/displayNames';
import ProjectSelector from './ProjectSelector';

interface ProjectSearchDialogProps {
  open: boolean;
  onClose: () => void;
  date: string;
  personId: string;
  orgId: string;
  onProjectAssigned: () => void;
}

interface Project {
  id: string;
  project_name: string;
  project_number: number;
  tripletex_project_id: number;
  customer_name?: string;
}

interface Person {
  fornavn: string;
  etternavn: string;
}

const ProjectSearchDialog = ({ open, onClose, date, personId, orgId, onProjectAssigned }: ProjectSearchDialogProps) => {
  const [person, setPerson] = useState<Person | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadPerson = useCallback(async () => {
    if (!personId) return;
    
    try {
      const { data, error } = await supabase
        .from('person')
        .select('fornavn, etternavn')
        .eq('id', personId)
        .single();

      if (error) throw error;
      setPerson(data);
    } catch (error) {
      console.error('Error loading person:', error);
    }
  }, [personId]);

  useEffect(() => {
    if (open) {
      loadPerson();
      setSelectedProjectId('');
    }
  }, [open, loadPerson]);

  const assignProject = async () => {
    if (!selectedProjectId) {
      toast({
        title: "Prosjekt påkrevd",
        description: "Du må velge et prosjekt før du kan tilordne det.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('vakt')
        .insert({
          dato: date,
          person_id: personId,
          project_id: selectedProjectId,
          org_id: orgId
        });

      if (error) throw error;

      toast({
        title: "Prosjekt tilordnet",
        description: "Prosjektet har blitt tilordnet til denne dagen.",
      });

      onProjectAssigned();
      onClose();
    } catch (error) {
      console.error('Error assigning project:', error);
      toast({
        title: "Feil ved tilordning",
        description: error instanceof Error ? error.message : "Kunne ikke tilordne prosjekt.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedProjectId('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md mx-4 sm:mx-0 sm:w-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Finn prosjekt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Person info */}
          {person && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {getPersonDisplayName(person)}
              </span>
            </div>
          )}

          {/* Date info */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {new Date(date).toLocaleDateString('no-NO', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </span>
          </div>

          {/* Project selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Velg prosjekt</label>
            <ProjectSelector
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              orgId={orgId}
              personId={personId}
              placeholder="Søk og velg prosjekt..."
            />
            <p className="text-xs text-muted-foreground">
              Alle aktive prosjekter vil vises.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={assignProject}
              disabled={!selectedProjectId || loading}
              className="flex-1"
            >
              {loading ? "Tilordner..." : "Tilordne prosjekt"}
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Avbryt
            </Button>
          </div>

          {/* Info about admin request */}
          <div className="text-xs text-muted-foreground text-center p-3 bg-muted rounded-lg">
            <Building className="h-4 w-4 mx-auto mb-1" />
            <p>
              Hvis du ikke finner prosjektet du leter etter, kan du be administrator om å tilordne det.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectSearchDialog;