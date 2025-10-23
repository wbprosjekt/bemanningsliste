'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  FileText, 
  MapPin, 
  MousePointer,
  CheckSquare,
  Signature,
  Database,
  ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FriBefaringDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  userId: string;
  tripletexProjectId?: number | null; // Optional project context
  onSuccess?: () => void; // Callback when befaring is created
}

type BefaringType = 'med_plantegning' | 'fri_befaring';
type ProjectConnection = 'koblet_til_prosjekt' | 'uten_prosjekt';

export default function FriBefaringDialog({
  isOpen,
  onClose,
  orgId,
  userId,
  tripletexProjectId,
  onSuccess
}: FriBefaringDialogProps) {
  const [selectedType, setSelectedType] = useState<BefaringType | null>(null);
  const [projectConnection, setProjectConnection] = useState<ProjectConnection>('koblet_til_prosjekt');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleContinue = async () => {
    if (!selectedType) return;

    if (selectedType === 'med_plantegning') {
      // Redirect to befaring page which will show the existing dialog
      router.push('/befaring');
      onClose();
    } else {
      // Create fri befaring directly
      setIsCreating(true);
      try {
        const befaringData = {
          title: 'Ny fri befaring',
          description: 'Beskrivelse kommer...',
          org_id: orgId,
          created_by: userId,
          status: 'aktiv',
          tripletex_project_id: projectConnection === 'koblet_til_prosjekt' ? tripletexProjectId : null,
          befaring_date: new Date().toISOString().split('T')[0]
        };

        const { data, error } = await supabase
          .from('fri_befaringer' as any)
          .insert(befaringData)
          .select()
          .single();

        if (error) throw error;

        toast({
          title: 'Fri befaring opprettet',
          description: 'Befaringen er opprettet og klar for bruk.',
        });

        // Redirect to the new befaring
        router.push(`/fri-befaring/${(data as any).id}`);
        onClose();
        
        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
        }
      } catch (error: any) {
        console.error('Error creating fri befaring:', error);
        toast({
          title: 'Feil ved opprettelse',
          description: error.message || 'Kunne ikke opprette fri befaring.',
          variant: 'destructive',
        });
      } finally {
        setIsCreating(false);
      }
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    setProjectConnection('koblet_til_prosjekt');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Ny befaring</DialogTitle>
          <DialogDescription>
            Velg type befaring og prosjekt-tilknytning
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Befaring Type Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Velg type befaring:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Befaring med plantegning */}
              <Card 
                className={`cursor-pointer transition-all duration-200 ${
                  selectedType === 'med_plantegning' 
                    ? 'ring-2 ring-blue-500 bg-blue-50' 
                    : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedType('med_plantegning')}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Building2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg mb-2">Befaring med plantegning</h4>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4" />
                          <span>Oppgaver med x,y koordinater</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MousePointer className="h-4 w-4" />
                          <span>Interaktiv plantegning</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckSquare className="h-4 w-4" />
                          <span>Klikk for å opprette oppgaver</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span>Tekstbasert signatur</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Fri befaring */}
              <Card 
                className={`cursor-pointer transition-all duration-200 ${
                  selectedType === 'fri_befaring' 
                    ? 'ring-2 ring-green-500 bg-green-50' 
                    : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedType('fri_befaring')}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <FileText className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg mb-2">Fri befaring</h4>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <CheckSquare className="h-4 w-4" />
                          <span>Enkel liste med punkter</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4" />
                          <span>Uten koordinater</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Signature className="h-4 w-4" />
                          <span>Canvas-signatur</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Database className="h-4 w-4" />
                          <span>Immutable snapshots</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Project Connection Selection - Only show for fri befaring */}
          {selectedType === 'fri_befaring' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Prosjekt-tilknytning:</h3>
              <div className="space-y-3">
                <Card 
                  className={`cursor-pointer transition-all duration-200 ${
                    projectConnection === 'koblet_til_prosjekt' 
                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setProjectConnection('koblet_til_prosjekt')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <div>
                        <h4 className="font-medium">Koblet til prosjekt</h4>
                        <p className="text-sm text-gray-600">
                          {tripletexProjectId 
                            ? `Befaringen kobles til gjeldende prosjekt` 
                            : 'Velg prosjekt fra dropdown'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all duration-200 ${
                    projectConnection === 'uten_prosjekt' 
                      ? 'ring-2 ring-orange-500 bg-orange-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setProjectConnection('uten_prosjekt')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-orange-600" />
                      <div>
                        <h4 className="font-medium">Uten prosjekt (untagged)</h4>
                        <p className="text-sm text-gray-600">
                          Befaringen kan flyttes til prosjekt senere
                        </p>
                        <Badge variant="secondary" className="mt-1">
                          Ny funksjonalitet
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleClose}>
            Avbryt
          </Button>
          <Button 
            onClick={handleContinue}
            disabled={!selectedType || isCreating}
            className="flex items-center space-x-2"
          >
            <span>{isCreating ? 'Oppretter...' : 'Fortsett'}</span>
            {!isCreating && <ArrowRight className="h-4 w-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
