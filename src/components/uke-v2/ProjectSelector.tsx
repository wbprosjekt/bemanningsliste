'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search } from 'lucide-react';

interface ProjectSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (project: any) => void;
  orgId: string;
}

export default function ProjectSelector({ open, onClose, onSelect, orgId }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadProjects();
    }
  }, [open, orgId]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = projects.filter(project =>
        project.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.project_number?.toString().includes(searchQuery)
      );
      setFilteredProjects(filtered);
    } else {
      setFilteredProjects(projects);
    }
  }, [searchQuery, projects]);

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
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Velg prosjekt</SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Søk etter prosjekt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Projects List */}
        <div className="mt-4 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Laster prosjekter...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {searchQuery ? 'Ingen prosjekter funnet' : 'Ingen prosjekter tilgjengelig'}
            </div>
          ) : (
            filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelect(project)}
                className="w-full p-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-left transition-colors"
              >
                <div className="font-medium text-white">
                  {project.project_number} {project.project_name}
                </div>
                {project.customer && (
                  <div className="text-sm text-purple-100 mt-1">
                    {project.customer}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

