import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, User, Phone, Mail, FileText, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/types/supabase';

type TtxProjectCache = Database['public']['Tables']['ttx_project_cache']['Row'];

interface ProjectDetailDialogProps {
  open: boolean;
  onClose: () => void;
  project: {
    project_name: string | null;
    project_number: number | null;
    tripletex_project_id: number | null;
  };
  orgId: string;
}

interface ProjectDetails {
  id: number;
  name: string;
  number: string;
  customer: {
    id: number;
    name: string;
    email?: string;
    phoneNumber?: string;
  };
  projectManager?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
  };
  startDate: string;
  endDate?: string;
  status: string;
  isActive: boolean;
  isClosed: boolean;
  displayName: string;
  description?: string;
  department?: {
    name: string;
    id?: number;
  };
}

const ProjectDetailDialog = ({ open, onClose, project, orgId }: ProjectDetailDialogProps) => {
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadProjectDetails = useCallback(async () => {
    setLoading(true);
    try {
      const tripletexId = project.tripletex_project_id;
      if (!tripletexId) {
        throw new Error('Prosjektet mangler tilhørende Tripletex-ID.');
      }

      // Load project details from cache instead of API
      const { data: projectData, error: projectError } = await supabase
        .from('ttx_project_cache')
        .select('*')
        .eq('tripletex_project_id', tripletexId)
        .eq('org_id', orgId)
        .single();

      if (projectError) {
        console.error('Error loading cached project data:', projectError);
        throw new Error(projectError.message || 'Failed to load project details');
      }

      if (!projectData) {
        throw new Error('Project not found in cache');
      }

      // Transform cached data to match ProjectDetails interface
      const cacheRow = projectData as TtxProjectCache;
      const projectDetails: ProjectDetails = {
        id: cacheRow.tripletex_project_id!,
        name: cacheRow.project_name || '',
        number: cacheRow.project_number?.toString() || '',
        customer: {
          id: 0, // Not available in cache
          name: cacheRow.customer_name || 'Ukjent kunde',
          email: cacheRow.customer_email ?? undefined,
          phoneNumber: cacheRow.customer_phone ?? undefined
        },
        projectManager: cacheRow.project_manager_name ? {
          id: 0, // Not available in cache
          firstName: cacheRow.project_manager_name.split(' ')[0] || '',
          lastName: cacheRow.project_manager_name.split(' ').slice(1).join(' ') || '',
          email: cacheRow.project_manager_email || '',
          phoneNumber: cacheRow.project_manager_phone ?? undefined
        } : undefined,
        startDate: cacheRow.start_date || '',
        endDate: cacheRow.end_date ?? undefined,
        status: cacheRow.is_active ? 'active' : 'inactive',
        isActive: cacheRow.is_active ?? false,
        isClosed: cacheRow.is_closed ?? false,
        displayName: cacheRow.project_name || '',
        description: cacheRow.project_description ?? undefined,
        department: undefined
      };

      setProjectDetails(projectDetails);
    } catch (error) {
      console.error('Error loading project details:', error);
      toast({
        title: "Kunne ikke laste prosjektdetaljer", 
        description: error instanceof Error ? error.message : "Det oppstod en feil ved lasting av prosjektinformasjon fra Tripletex.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [project, orgId, toast]);

  useEffect(() => {
    if (open && project) {
      loadProjectDetails();
    }
  }, [open, project, loadProjectDetails]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md mx-4 sm:mx-0 sm:w-auto sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Prosjektdetaljer
          </DialogTitle>
          <DialogDescription>
            Vis detaljert informasjon om prosjektet
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Laster prosjektinformasjon...
          </div>
        ) : projectDetails ? (
          <div className="space-y-6">
            {/* Project Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="break-words hyphens-auto leading-tight">{projectDetails.displayName}</span>
                  <Badge variant={projectDetails.isClosed ? "secondary" : "default"} className="ml-2 flex-shrink-0">
                    {projectDetails.isClosed ? "Avsluttet" : "Aktiv"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 w-full overflow-hidden">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Prosjektnummer:</span>
                    <p>{projectDetails.number}</p>
                  </div>
                  <div>
                    <span className="font-medium">Prosjekt-ID:</span>
                    <p>{projectDetails.id}</p>
                  </div>
                </div>
                
                {projectDetails.description && (
                  <div className="w-full">
                    <span className="font-medium text-sm">Beskrivelse:</span>
                    <p className="text-sm text-muted-foreground mt-1 break-all overflow-wrap-anywhere word-break-break-all leading-relaxed whitespace-pre-wrap">{projectDetails.description}</p>
                  </div>
                )}

                {(projectDetails.startDate || projectDetails.endDate) && (
                  <div className="flex items-center gap-4 text-sm">
                    <Calendar className="h-4 w-4" />
                    <div className="flex gap-4">
                      {projectDetails.startDate && (
                        <div>
                          <span className="font-medium">Start:</span>
                          <span className="ml-1">{new Date(projectDetails.startDate).toLocaleDateString('no-NO')}</span>
                        </div>
                      )}
                      {projectDetails.endDate && (
                        <div>
                          <span className="font-medium">Slutt:</span>
                          <span className="ml-1">{new Date(projectDetails.endDate).toLocaleDateString('no-NO')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Kundeinformasjon
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium">Kunde:</span>
                  <p>{projectDetails.customer.name}</p>
                </div>
                
                {projectDetails.customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <a 
                      href={`mailto:${projectDetails.customer.email}`}
                      className="text-blue-600 hover:text-blue-800 underline break-all"
                    >
                      {projectDetails.customer.email}
                    </a>
                  </div>
                )}
                
                {projectDetails.customer.phoneNumber && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <a 
                      href={`tel:${projectDetails.customer.phoneNumber}`}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {projectDetails.customer.phoneNumber}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Project Manager */}
            {projectDetails.projectManager && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Prosjektleder
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="font-medium">Navn:</span>
                    <p>{projectDetails.projectManager.firstName} {projectDetails.projectManager.lastName}</p>
                  </div>
                  
                  {projectDetails.projectManager.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <a 
                        href={`mailto:${projectDetails.projectManager.email}`}
                        className="text-blue-600 hover:text-blue-800 underline break-all"
                      >
                        {projectDetails.projectManager.email}
                      </a>
                    </div>
                  )}
                  
                  {projectDetails.projectManager.phoneNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <a 
                        href={`tel:${projectDetails.projectManager.phoneNumber}`}
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {projectDetails.projectManager.phoneNumber}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Department */}
            {projectDetails.department && (
              <Card>
                <CardHeader>
                  <CardTitle>Avdeling</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{projectDetails.department.name}</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Kunne ikke laste prosjektinformasjon
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDetailDialog;
