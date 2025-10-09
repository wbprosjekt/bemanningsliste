import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, User, Phone, Mail, FileText, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  number: number;
  description?: string;
  startDate?: string;
  endDate?: string;
  customer: {
    name: string;
    email?: string;
    phoneNumber?: string;
  };
  projectManager?: {
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
  };
  department?: {
    name: string;
  };
  isClosed: boolean;
  displayName: string;
}

const ProjectDetailDialog = ({ open, onClose, project, orgId }: ProjectDetailDialogProps) => {
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadProjectDetails = useCallback(async () => {
    setLoading(true);
    try {
      // Call Tripletex API through our edge function using Supabase client
      const { data, error } = await supabase.functions.invoke('tripletex-api', {
        body: {
          action: 'get_project_details',
          project_id: project.tripletex_project_id,
          orgId: orgId
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to load project details');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to load project details');
      }

      setProjectDetails(data.data);
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