import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  project_name: string | null;
  project_number: number | null;
  tripletex_project_id: number | null;
  customer_name?: string | null;
}

interface ProjectSelectorProps {
  value?: string;
  onValueChange: (projectId: string) => void;
  orgId: string;
  personId?: string;
  placeholder?: string;
  disabled?: boolean;
  excludeProjectIds?: string[]; // Projects to exclude from the list
}

const ProjectSelector = ({ 
  value, 
  onValueChange, 
  orgId, 
  personId, 
  placeholder = "Velg prosjekt...",
  disabled = false,
  excludeProjectIds = []
}: ProjectSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadProjects = useCallback(async () => {
    if (!orgId) return;
    
    console.log('🔄 loadProjects called', { orgId });
    setLoading(true);
    try {
      const query = supabase
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
      const { data, error } = await query;

      if (error) {
        throw error;
      }
      
      // Filter out excluded projects
      const filteredProjects = (data || []).filter(project => 
        !excludeProjectIds.includes(project.id)
      );
      
      setProjects(filteredProjects);
      
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
  }, [orgId, personId, toast, excludeProjectIds]);


  useEffect(() => {
    if (open) {
      loadProjects();
    }
  }, [open, orgId]); // Don't include loadProjects to avoid infinite loop

  // Polling for project updates (free alternative to Realtime)
  useEffect(() => {
    if (!open || !orgId) return;

    console.log('🔄 Setting up polling for project updates');
    
    const interval = setInterval(() => {
      console.log('🔄 Polling for project updates...', { orgId, open });
      loadProjects();
    }, 5000); // Poll every 5 seconds for testing
    
    console.log('🔄 Polling interval set up:', interval);

    return () => {
      console.log('🔄 Cleaning up polling');
      clearInterval(interval);
    };
  }, [open, orgId]); // Don't include loadProjects to avoid infinite loop

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
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[500px] p-0 max-h-[400px]" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <CommandInput placeholder="Søk prosjekter..." className="flex-1" />
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>
              {loading ? (
                <div className="py-6 text-center text-sm">Laster prosjekter...</div>
              ) : projects.length === 0 ? (
                <div className="py-6 px-4 text-center">
                  <p className="text-sm font-medium">Ingen prosjekter funnet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Prosjekter oppdateres automatisk via webhooks
                  </p>
                </div>
              ) : (
                <div className="py-6 text-center text-sm">Ingen prosjekter matcher søket</div>
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
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">
                        {project.project_number ? `${project.project_number} ${project.project_name}` : project.project_name}
                      </span>
                    </div>
                    {project.customer_name && (
                      <span className="text-sm text-muted-foreground truncate">
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
