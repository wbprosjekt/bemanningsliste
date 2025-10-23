'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Loader2, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      console.log('=== LOADING PROJECTS DEBUG ===');
      console.log('Current Project ID:', currentProjectId);
      
      const { data, error } = await supabase
        .from('ttx_project_cache')
        .select('tripletex_project_id, project_name, project_number')
        .not('tripletex_project_id', 'is', null)
        .order('project_name');

      if (error) {
        console.error('Database error loading projects:', error);
        throw error;
      }

      console.log('Raw projects from database:', data);
      console.log('Number of projects:', data?.length || 0);

      // Filter out current project if any
      const filteredProjects = data?.filter(p => p.tripletex_project_id !== currentProjectId) || [];
      console.log('Filtered projects (excluding current):', filteredProjects);
      console.log('Number of filtered projects:', filteredProjects.length);
      
      setProjects(filteredProjects);
      setFilteredProjects(filteredProjects);
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

  // Smart search with prioritization
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProjects(projects);
    } else {
      const searchTerm = searchQuery.toLowerCase();
      
      const scoredProjects = projects.map(project => {
        const number = project.project_number?.toString() || '';
        const name = project.project_name?.toLowerCase() || '';
        
        let score = 0;
        
        // Exact number match (highest priority)
        if (number === searchQuery) score = 100;
        // Starts with number
        else if (number.startsWith(searchQuery)) score = 80;
        // Name contains
        else if (name.includes(searchTerm)) score = 60;
        // Number contains (lowest priority)
        else if (number.includes(searchQuery)) score = 40;
        
        return { ...project, score };
      })
      .filter(project => project.score > 0)
      .sort((a, b) => b.score - a.score);
      
      setFilteredProjects(scoredProjects);
    }
  }, [searchQuery, projects]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      loadProjects();
    } else {
      setSelectedProjectId('');
      setSearchQuery('');
      setShowDropdown(false);
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setShowDropdown(false);
    
    // Update search query to show selected project
    const selectedProject = projects.find(p => p.tripletex_project_id?.toString() === projectId);
    if (selectedProject) {
      const number = selectedProject.project_number?.toString() || '';
      const name = selectedProject.project_name || 'Ukjent prosjekt';
      
      // Remove project number from name if it starts with it
      const cleanName = name.startsWith(number + ' ') 
        ? name.substring(number.length + 1)
        : name;
      
      setSearchQuery(`${number} - ${cleanName}`);
    }
  };

  const getSelectedProjectDisplay = () => {
    if (!selectedProjectId) return '';
    const selectedProject = projects.find(p => p.tripletex_project_id?.toString() === selectedProjectId);
    if (!selectedProject) return '';
    
    const number = selectedProject.project_number?.toString() || '';
    const name = selectedProject.project_name || 'Ukjent prosjekt';
    
    // Remove project number from name if it starts with it
    const cleanName = name.startsWith(number + ' ') 
      ? name.substring(number.length + 1)
      : name;
    
    return `${number} - ${cleanName}`;
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

    const projectId = parseInt(selectedProjectId);
    const selectedProject = projects.find(p => p.tripletex_project_id === projectId);
    
    if (!selectedProject) {
      toast({
        title: 'Prosjekt ikke funnet',
        description: 'Det valgte prosjektet ble ikke funnet.',
        variant: 'destructive',
      });
      return;
    }

    // Show confirmation dialog
    const cleanProjectName = selectedProject.project_name?.startsWith(selectedProject.project_number + ' ') 
      ? selectedProject.project_name.substring(selectedProject.project_number.toString().length + 1)
      : selectedProject.project_name;
    
    const confirmMessage = currentProjectId 
      ? `Er du sikker på at du vil flytte "${befaringTitle}" til prosjekt ${selectedProject.project_number} - ${cleanProjectName}?`
      : `Er du sikker på at du vil flytte "${befaringTitle}" til prosjekt ${selectedProject.project_number} - ${cleanProjectName}?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    setLoading(true);
    try {
      // Debug: Log user info and project details
      console.log('=== FLYTT TIL PROSJEKT DEBUG ===');
      console.log('Befaring ID:', befaringId);
      console.log('Selected Project ID:', projectId);
      console.log('Selected Project:', selectedProject);
      
      // 1. Check user role first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();
      
      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        throw new Error(`Kunne ikke hente brukerinfo: ${profileError.message}`);
      }
      
      console.log('User role:', profile?.role);
      
      // Check if user has permission (admin/manager can move any befaring, users can only move their own)
      if (!['admin', 'manager'].includes(profile?.role)) {
        // For regular users, check if they created the befaring
        const { data: befaringData } = await supabase
          .from('fri_befaringer' as any)
          .select('created_by')
          .eq('id', befaringId)
          .single();
        
        if (befaringData?.created_by !== (await supabase.auth.getUser()).data.user?.id) {
          toast({
            title: 'Ingen tilgang',
            description: 'Du kan kun flytte befaringsrapporter du har opprettet.',
            variant: 'destructive',
          });
          return;
        }
      }
      
      // Project already verified above
      
      // 3. Update the fri_befaring with new project
      console.log('Attempting database update...');
      const { error } = await supabase
        .from('fri_befaringer' as any)
        .update({ 
          tripletex_project_id: projectId,
          updated_at: new Date().toISOString()
        })
        .eq('id', befaringId)
        .eq('org_id', orgId);

      if (error) {
        console.error('Database error:', error);
        throw new Error(`Database feil: ${error.message}`);
      }
      
      console.log('Database update successful!');

      // 4. Update project's last_synced to reflect activity
      console.log('Updating project last_synced...');
      const { error: projectUpdateError } = await supabase
        .from('ttx_project_cache')
        .update({ 
          last_synced: new Date().toISOString()
        })
        .eq('tripletex_project_id', projectId);

      if (projectUpdateError) {
        console.warn('Could not update project last_synced:', projectUpdateError);
        // Don't throw error - this is not critical
      } else {
        console.log('Project last_synced updated successfully!');
      }

      // 5. Success feedback
      const cleanProjectName = selectedProject.project_name?.startsWith(selectedProject.project_number + ' ') 
        ? selectedProject.project_name.substring(selectedProject.project_number.toString().length + 1)
        : selectedProject.project_name;
      
      toast({
        title: currentProjectId ? 'Prosjekt endret' : 'Befaring flyttet til prosjekt',
        description: `"${befaringTitle}" er nå koblet til prosjekt ${selectedProject.project_number} - ${cleanProjectName}`,
      });

      setIsOpen(false);
      onSuccess();
      
    } catch (error) {
      console.error('=== FLYTT TIL PROSJEKT ERROR ===');
      console.error('Full error:', error);
      console.error('Error message:', error.message);
      console.error('Error details:', error);
      
      toast({
        title: 'Feil ved flytting',
        description: error.message || 'Kunne ikke flytte befaring til prosjekt. Prøv igjen.',
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
          <DialogTitle>
            {currentProjectId ? 'Endre prosjekt' : 'Flytt befaring til prosjekt'}
          </DialogTitle>
          <DialogDescription>
            {currentProjectId 
              ? `Velg nytt prosjekt for "${befaringTitle}". Alle bilder, punkter og oppgaver følger automatisk med.`
              : `Velg prosjektet du vil flytte "${befaringTitle}" til. Alle bilder, punkter og oppgaver følger automatisk med.`
            }
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
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Søk etter prosjekt..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                    if (!e.target.value) {
                      setSelectedProjectId('');
                    }
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="pl-10 pr-4"
                />
              </div>
              
              {showDropdown && filteredProjects.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredProjects.map((project) => (
                    <button
                      key={project.tripletex_project_id || 'unknown'}
                      onClick={() => handleProjectSelect((project.tripletex_project_id || 0).toString())}
                      className={cn(
                        "w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between",
                        selectedProjectId === (project.tripletex_project_id || 0).toString() && "bg-blue-50"
                      )}
                    >
                      <div>
                        <div className="font-medium">
                          {(() => {
                            const number = project.project_number?.toString() || '';
                            const name = project.project_name || 'Ukjent prosjekt';
                            
                            // Remove project number from name if it starts with it
                            const cleanName = name.startsWith(number + ' ') 
                              ? name.substring(number.length + 1)
                              : name;
                            
                            return `${number} - ${cleanName}`;
                          })()}
                        </div>
                      </div>
                      {selectedProjectId === (project.tripletex_project_id || 0).toString() && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {showDropdown && filteredProjects.length === 0 && searchQuery && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500">
                  Ingen prosjekter funnet for "{searchQuery}"
                </div>
              )}
            </div>
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
            onClick={() => {
              console.log('=== BUTTON CLICK DEBUG ===');
              console.log('loading:', loading);
              console.log('selectedProjectId:', selectedProjectId);
              console.log('projects.length:', projects.length);
              console.log('filteredProjects.length:', filteredProjects.length);
              console.log('Button disabled:', loading || !selectedProjectId || projects.length === 0);
              handleMoveToProject();
            }}
            disabled={loading || !selectedProjectId || projects.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {currentProjectId ? 'Endrer...' : 'Flytter...'}
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                {currentProjectId ? 'Endre prosjekt' : 'Flytt til prosjekt'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
