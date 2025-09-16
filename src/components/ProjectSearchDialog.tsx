import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, X } from 'lucide-react';
import { getPersonDisplayName, generateProjectColor, getContrastColor } from '@/lib/displayNames';

interface ProjectSearchDialogProps {
  open: boolean;
  onClose: () => void;
  date: string;
  personId: string;
  orgId: string;
  onProjectAssigned: () => void;
}

const ProjectSearchDialog = ({ open, onClose, date, personId, orgId, onProjectAssigned }: ProjectSearchDialogProps) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [person, setPerson] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadProjects();
      loadPerson();
      setSearchTerm('');
    }
  }, [open, orgId]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.filter(project =>
        project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.project_number.toString().includes(searchTerm) ||
        project.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProjects(filtered);
    }
  }, [searchTerm, projects]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ttx_project_cache')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('project_name');

      if (error) throw error;
      setProjects(data || []);
      setFilteredProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "Feil ved lasting av prosjekter",
        description: "Kunne ikke laste prosjektliste",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPerson = async () => {
    try {
      const { data, error } = await supabase
        .from('person')
        .select('*')
        .eq('id', personId)
        .single();

      if (error) throw error;
      setPerson(data);
    } catch (error) {
      console.error('Error loading person:', error);
    }
  };

  const assignProject = async (project: any) => {
    try {
      // Get the project UUID from tripletex_project_id
      const { data: projectData } = await supabase
        .from('ttx_project_cache')
        .select('id')
        .eq('tripletex_project_id', project.tripletex_project_id)
        .eq('org_id', orgId)
        .single();

      if (!projectData) {
        throw new Error('Prosjekt ikke funnet');
      }

      // Create new vakt
      const { data: newVakt, error } = await supabase
        .from('vakt')
        .insert({
          person_id: personId,
          project_id: projectData.id,
          dato: date,
          org_id: orgId
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Prosjekt tilordnet",
        description: `${project.project_name} er tilordnet ${person ? getPersonDisplayName(person.fornavn, person.etternavn) : 'ansatt'} for ${new Date(date).toLocaleDateString('no-NO')}`
      });

      onProjectAssigned();
      onClose();
    } catch (error: any) {
      toast({
        title: "Tilordning feilet",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getProjectColor = (tripletexProjectId: number) => {
    return generateProjectColor(tripletexProjectId);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              Velg prosjekt - {new Date(date).toLocaleDateString('no-NO', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {person && (
            <div className="bg-blue-50 p-3 rounded">
              <div className="font-medium">
                {getPersonDisplayName(person.fornavn, person.etternavn)}
              </div>
              <div className="text-sm text-muted-foreground">
                {new Date(date).toLocaleDateString('no-NO')}
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Søk prosjekter (navn, nummer, kunde)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Laster prosjekter...
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'Ingen prosjekter funnet' : 'Ingen aktive prosjekter'}
              </div>
            ) : (
              filteredProjects.map(project => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => assignProject(project)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: getProjectColor(project.tripletex_project_id) }}
                      />
                      <div>
                        <div className="font-medium">
                          {project.project_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          #{project.project_number}
                          {project.customer_name && ` • ${project.customer_name}`}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button size="sm" variant="outline">
                    Velg
                  </Button>
                </div>
              ))
            )}
          </div>

          {filteredProjects.length > 0 && (
            <div className="text-xs text-muted-foreground text-center">
              {filteredProjects.length} prosjekt{filteredProjects.length !== 1 ? 'er' : ''} funnet
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectSearchDialog;