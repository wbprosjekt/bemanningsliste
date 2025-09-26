import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  project_name: string;
  project_number: number;
  tripletex_project_id: number;
  customer_name?: string;
}

interface ProjectSelectorProps {
  value?: string;
  onValueChange: (projectId: string) => void;
  orgId: string;
  personId?: string;
  placeholder?: string;
  disabled?: boolean;
}

const ProjectSelector = ({ 
  value, 
  onValueChange, 
  orgId, 
  personId, 
  placeholder = "Velg prosjekt...",
  disabled = false 
}: ProjectSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadProjects = useCallback(async () => {
    if (!orgId) return;
    
    setLoading(true);
    try {
      console.log('Loading projects for orgId:', orgId, 'personId:', personId);
      
      let query = supabase
        .from('ttx_project_cache')
        .select(`
          id,
          project_name,
          project_number,
          tripletex_project_id,
          customer_name
        `)
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('project_name');

      // If personId is provided, show all active projects (not just assigned ones)
      // This allows assigning new projects to people
      if (personId) {
        console.log('Loading all active projects for person assignment');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error loading projects:', error);
        throw error;
      }
      
      console.log('Loaded projects:', data);
      setProjects(data || []);
      
      if (!data || data.length === 0) {
        toast({
          title: "Ingen aktive prosjekter funnet",
          description: "Det finnes ingen aktive prosjekter i systemet.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "Feil ved lasting av prosjekter",
        description: error instanceof Error ? error.message : "Kunne ikke laste prosjekter.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [orgId, personId, toast]);

  useEffect(() => {
    if (open) {
      loadProjects();
    }
  }, [open, loadProjects]);

  const selectedProject = projects.find(p => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedProject ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="break-words hyphens-auto leading-tight text-left">{selectedProject.project_name}</span>
              {selectedProject.project_number && (
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  #{selectedProject.project_number}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Søk prosjekter..." />
          <CommandList>
            <CommandEmpty>
              {loading ? (
                "Laster prosjekter..."
              ) : projects.length === 0 ? (
                "Ingen prosjekter funnet"
              ) : (
                "Ingen prosjekter matcher søket"
              )}
            </CommandEmpty>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`${project.project_name} ${project.project_number} ${project.customer_name || ''}`}
                  onSelect={() => {
                    onValueChange(project.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === project.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{project.project_name}</span>
                      {project.project_number && (
                        <Badge variant="secondary" className="text-xs">
                          #{project.project_number}
                        </Badge>
                      )}
                    </div>
                    {project.customer_name && (
                      <span className="text-sm text-muted-foreground">
                        {project.customer_name}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ProjectSelector;
