'use client';

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Loader2 } from 'lucide-react';

interface MoveToProjectDialogProps {
  befaringId: string;
  befaringTitle: string;
  currentProjectId: number | null;
  onSuccess: () => void;
  children: React.ReactNode;
}

interface Project {
  tripletex_project_id: number | null;
  project_name: string | null;
  project_number: number | null;
}

export default function MoveToProjectDialog({
  befaringId,
  befaringTitle,
  currentProjectId,
  onSuccess,
  children
}: MoveToProjectDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const { toast } = useToast();

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('ttx_project_cache')
        .select('tripletex_project_id, project_name, project_number')
        .not('tripletex_project_id', 'is', null)
        .order('project_name');

      if (error) throw error;

      // Filter out current project if any
      const filteredProjects = data?.filter(p => p.tripletex_project_id !== currentProjectId) || [];
      setProjects(filteredProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: 'Feil ved lasting av prosjekter',
        description: 'Kunne ikke laste prosjektliste. Prøv igjen.',
        variant: 'destructive',
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      loadProjects();
    } else {
      setSelectedProjectId('');
    }
  };

  const handleMoveToProject = async () => {
    if (!selectedProjectId) {
      toast({
        title: 'Velg prosjekt',
        description: 'Du må velge et prosjekt først.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const projectId = parseInt(selectedProjectId);
      
      // Update the fri_befaring with new project
      const { error } = await supabase
        .from('fri_befaringer' as any)
        .update({ 
          tripletex_project_id: projectId,
          updated_at: new Date().toISOString()
        })
        .eq('id', befaringId);

      if (error) throw error;

      const selectedProject = projects.find(p => p.tripletex_project_id === projectId);
      
      toast({
        title: 'Befaring flyttet til prosjekt',
        description: `"${befaringTitle}" er nå koblet til prosjekt ${selectedProject?.project_number} - ${selectedProject?.project_name}`,
      });

      setIsOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Error moving befaring to project:', error);
      toast({
        title: 'Feil ved flytting',
        description: 'Kunne ikke flytte befaring til prosjekt. Prøv igjen.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Flytt befaring til prosjekt</DialogTitle>
          <DialogDescription>
            Velg prosjektet du vil flytte "{befaringTitle}" til. 
            Alle bilder, punkter og oppgaver følger automatisk med.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadingProjects ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Laster prosjekter...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen tilgjengelige prosjekter funnet.
            </div>
          ) : (
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Velg prosjekt..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem 
                    key={project.tripletex_project_id || 'unknown'} 
                    value={(project.tripletex_project_id || 0).toString()}
                  >
                    {project.project_number || 'N/A'} - {project.project_name || 'Ukjent prosjekt'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            disabled={loading}
          >
            Avbryt
          </Button>
          <Button 
            onClick={handleMoveToProject}
            disabled={loading || !selectedProjectId || projects.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Flytter...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Flytt til prosjekt
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
