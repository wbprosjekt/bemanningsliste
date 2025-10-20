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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

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
  project_number: string;
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
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const { toast } = useToast();
  
  const isBulkTagging = photoIds.length > 0;

  // Load projects when dialog opens
  useEffect(() => {
    if (open) {
      loadProjects();
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
      
      setProjects(data || []);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isBulkTagging ? `Tagge ${photoIds.length} bilder` : 'Tagge bilde'}
          </DialogTitle>
          <DialogDescription>
            Velg hvilket prosjekt bildet tilhører
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div>
            <Label htmlFor="project-select">Velg prosjekt</Label>
            <Select
              value={selectedProject}
              onValueChange={setSelectedProject}
              disabled={loadingProjects}
            >
              <SelectTrigger id="project-select" className="mt-1">
                <SelectValue placeholder={loadingProjects ? "Laster prosjekter..." : "Velg prosjekt..."} />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_name} #{p.project_number}
                    {p.customer_name && ` - ${p.customer_name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projects.length === 0 && !loadingProjects && (
              <p className="text-xs text-muted-foreground mt-1">
                Ingen aktive prosjekter funnet
              </p>
            )}
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
  );
}

