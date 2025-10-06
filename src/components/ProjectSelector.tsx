import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronsUpDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

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
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const loadProjects = useCallback(async () => {
    if (!orgId) return;
    
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

  const syncProjects = useCallback(async () => {
    setSyncing(true);
    console.log('🔄 Starting project sync...', { orgId });
    try {
      // Use Supabase client instead of manual fetch for proper auth
      const { data, error } = await supabase.functions.invoke('tripletex-api', {
        body: {
          action: 'sync-projects',
          orgId: orgId
        }
      });

      if (error) {
        throw error;
      }

      const result = data;
      console.log('📦 Response data:', result);

      if (result?.success) {
        // Log debug info to browser console
        if (result.data?.debug) {
          console.log('🔍 DEBUG: First 3 projects from Tripletex:', result.data.debug);
          console.table(result.data.debug);
        }
        
        toast({
          title: "✓ Prosjekter oppdatert",
          description: result.data?.count 
            ? `${result.data.count} prosjekt(er) synkronisert!`
            : "Prosjektlisten er oppdatert.",
        });
        await loadProjects();
      } else {
        throw new Error(result.error || 'Synkronisering feilet');
      }
    } catch (error) {
      console.error('Error syncing projects:', error);
      toast({
        title: "Feil ved synkronisering",
        description: error instanceof Error ? error.message : "Kunne ikke synkronisere.",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  }, [orgId, toast, loadProjects]);

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
          <div className="flex items-center border-b px-3">
            <CommandInput placeholder="Søk prosjekter..." className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={syncProjects}
              disabled={syncing || loading || !isOnline}
              className="ml-2 h-8 px-2"
              title={!isOnline ? "Du er offline" : "Oppdater fra Tripletex"}
            >
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            </Button>
          </div>
          <CommandList>
            <CommandEmpty>
              {loading ? (
                <div className="py-6 text-center text-sm">Laster prosjekter...</div>
              ) : projects.length === 0 ? (
                <div className="py-6 px-4 text-center">
                  <p className="text-sm font-medium mb-2">Ingen prosjekter funnet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={syncProjects}
                    disabled={syncing}
                    className="mt-2"
                  >
                    {syncing ? (
                      <><RefreshCw className="mr-2 h-3 w-3 animate-spin" />Synkroniserer...</>
                    ) : (
                      <><RefreshCw className="mr-2 h-3 w-3" />Hent fra Tripletex</>
                    )}
                  </Button>
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
