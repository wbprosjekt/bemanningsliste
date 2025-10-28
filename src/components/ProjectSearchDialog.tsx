import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, User, Building } from 'lucide-react';
import { getPersonDisplayName } from '@/lib/displayNames';
import { validateUUID, validateDate, ValidationError } from '@/lib/validation';
import ProjectSelector from './ProjectSelector';

interface ProjectSearchDialogProps {
  open: boolean;
  onClose: () => void;
  date: string;
  personId: string;
  orgId: string;
  onProjectAssigned: () => void;
}

interface Person {
  fornavn: string;
  etternavn: string;
}

const ProjectSearchDialog = ({ open, onClose, date, personId, orgId, onProjectAssigned }: ProjectSearchDialogProps) => {
  const [person, setPerson] = useState<Person | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [existingProjectIds, setExistingProjectIds] = useState<string[]>([]);
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

  const loadExistingProjects = useCallback(async () => {
    if (!personId || !date || !orgId) return;
    
    try {
      const { data, error } = await supabase
        .from('vakt')
        .select('project_id')
        .eq('person_id', personId)
        .eq('dato', date)
        .eq('org_id', orgId);

      if (error) throw error;
      
      const projectIds = (data || [])
        .map(v => v.project_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      setExistingProjectIds(projectIds);
    } catch (error) {
      console.error('Error loading existing projects:', error);
    }
  }, [personId, date, orgId]);

  useEffect(() => {
    if (open) {
      loadPerson();
      loadExistingProjects();
      setSelectedProjectId('');
    }
  }, [open, loadPerson, loadExistingProjects]);

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
      // Validate all inputs
      const validatedData = {
        date: validateDate(date),
        personId: validateUUID(personId),
        projectId: validateUUID(selectedProjectId),
        orgId: validateUUID(orgId)
      };

      const { error } = await supabase
        .from('vakt')
        .insert({
          dato: validatedData.date,
          person_id: validatedData.personId,
          project_id: validatedData.projectId,
          org_id: validatedData.orgId
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
      
      // Handle validation errors specifically
      if (error instanceof ValidationError) {
        toast({
          title: "Ugyldig input",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Feil ved tilordning",
          description: error instanceof Error ? error.message : "Kunne ikke tilordne prosjekt.",
          variant: "destructive"
        });
      }
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
      <DialogContent className="w-full max-w-lg mx-4 sm:mx-0 sm:w-auto sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Finn prosjekt
          </DialogTitle>
          <DialogDescription>
            Søk etter prosjekt og tilordne det til denne dagen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Person info */}
          {person && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {getPersonDisplayName(person.fornavn, person.etternavn)}
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
              excludeProjectIds={existingProjectIds}
            />
            <p className="text-xs text-muted-foreground">
              {existingProjectIds.length > 0 
                ? `${existingProjectIds.length} prosjekt(er) allerede lagt til for denne dagen og vises ikke.`
                : "Alle aktive prosjekter vil vises."
              }
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
