'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface TagPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photo: {
    id: string;
    image_url: string;
    prosjekt_id: string | null;
    comment: string | null;
  };
  orgId: string;
  photoIds?: string[]; // For bulk tagging
  onSuccess?: () => void;
}

interface Project {
  id: string;
  tripletex_project_id: number;
  project_name: string;
  project_number: string; // Always string after sanitization
  customer_name: string | null;
}

export default function TagPhotoDialog({
  open,
  onOpenChange,
  photo,
  orgId,
  photoIds = [],
  onSuccess
}: TagPhotoDialogProps) {
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const { toast } = useToast();
  
  const isBulkTagging = photoIds.length > 0;

  // Load projects when dialog opens
  useEffect(() => {
    if (open) {
      loadProjects();
      // Reset state when dialog opens
      setSelectedProject('');
      setIsPopoverOpen(false);
    }
  }, [open]);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('ttx_project_cache')
        .select('id, tripletex_project_id, project_name, project_number, customer_name')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('project_name', { ascending: true })
        .limit(100);
      
      if (error) throw error;
      
      // Sanitize projects
      const sanitizedProjects = (data || [])
        .filter((project) => project.tripletex_project_id !== null)
        .map((project) => ({
          id: project.id,
          tripletex_project_id: project.tripletex_project_id as number,
          project_name: project.project_name ?? 'Uten navn',
          project_number: String(project.project_number ?? '0'),
          customer_name: project.customer_name,
        }));
      
      setProjects(sanitizedProjects);
    } catch (error: any) {
      console.error('Error loading projects:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste prosjekter',
        variant: 'destructive'
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleTag = async () => {
    if (!selectedProject) return;
    
    setLoading(true);

    try {
      // Tag single photo or bulk
      const idsToUpdate = isBulkTagging ? photoIds : [photo.id];
      
      const { error } = await supabase
        .from('oppgave_bilder')
        .update({
          prosjekt_id: selectedProject,
          is_tagged: true
        })
        .in('id', idsToUpdate);

      if (error) throw error;

      toast({
        title: isBulkTagging ? 'Bilder tagget' : 'Bilde tagget',
        description: isBulkTagging 
          ? `${photoIds.length} bilder er nå knyttet til prosjektet`
          : 'Bildet er nå knyttet til prosjektet',
      });

      onSuccess?.();
      onOpenChange(false);
      
      // Reset
      setSelectedProject('');

    } catch (error: any) {
      console.error('Error tagging photo:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke tagge bilde(r)',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {isBulkTagging ? `Tagge ${photoIds.length} bilder` : 'Tagge bilde'}
            </DialogTitle>
            <DialogDescription>
              Velg hvilket prosjekt bildet tilhører
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[calc(90vh-180px)] overflow-y-auto pr-2">
            {!isBulkTagging && (
              <div className="flex justify-center">
                <img
                  src={photo.image_url}
                  alt="Photo to tag"
                  className="max-h-64 rounded-lg"
                />
              </div>
            )}
            
            {isBulkTagging && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  Du tagger {photoIds.length} bilder samtidig
                </p>
              </div>
            )}

            <div className="relative" id="project-select-container">
              <Label htmlFor="project-select">Velg prosjekt</Label>
              {selectedProject && (
                <div className="mt-1 mb-2 p-2 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Prosjekt valgt: {projects.find(p => p.id === selectedProject)?.project_name || 'Ukjent'}
                    </span>
                  </div>
                </div>
              )}
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between mt-1"
                    disabled={loadingProjects}
                  >
                    {selectedProject ? (
                      <span className="truncate">
                        {projects.find(p => p.id === selectedProject)?.project_name || 'Ukjent'} 
                        {' '}#{projects.find(p => p.id === selectedProject)?.project_number}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Søk etter prosjekt...</span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Søk prosjekter..." />
                    <CommandList className="max-h-[300px]">
                      <CommandEmpty>
                        {loadingProjects ? (
                          <div className="py-6 text-center text-sm">Laster prosjekter...</div>
                        ) : (
                          <div className="py-6 text-center text-sm">Ingen prosjekter funnet</div>
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {projects.map((project) => {
                          const isSelected = selectedProject === project.id;
                          
                          return (
                            <CommandItem
                              key={project.id}
                              value={`${project.project_name} ${project.project_number} ${project.customer_name || ''}`}
                              onSelect={() => {
                                setSelectedProject(project.id);
                                setIsPopoverOpen(false);
                                
                                // Show confirmation toast
                                toast({
                                  title: 'Prosjekt valgt',
                                  description: `${project.project_name} #${project.project_number} er valgt`,
                                });
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  isSelected ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1">
                                <div className="font-medium text-sm">{project.project_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  #{project.project_number}
                                  {project.customer_name && ` • ${project.customer_name}`}
                                </div>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Avbryt
            </Button>
            <Button 
              onClick={handleTag} 
              disabled={loading || !selectedProject}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Lagrer...
                </>
              ) : (
                isBulkTagging ? `Tagge ${photoIds.length} bilder` : 'Tagge bilde'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

