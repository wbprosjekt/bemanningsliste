'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  Image as ImageIcon, 
  Calendar,
  MapPin,
  Building,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  Circle,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import PlantegningViewer from './PlantegningViewer';
import OppgaveForm from './OppgaveForm';
import PlantegningUpload from './PlantegningUpload';
import OppgaveImages from './OppgaveImages';
import OppgaveImageThumbnails from './OppgaveImageThumbnails';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Oppgave {
  id: string;
  oppgave_nummer: number;
  fag: string;
  fag_color: string;
  x_position: number;
  y_position: number;
  title?: string;
  description?: string;
  status: 'apen' | 'under_arbeid' | 'lukket';
  prioritet: 'kritisk' | 'høy' | 'medium' | 'lav';
  frist?: string;
  underleverandor_id?: string;
  underleverandor_navn?: string;
}

interface Plantegning {
  id: string;
  title: string;
  image_url: string;
  display_order: number;
  file_type?: string;
  rotation?: number; // Rotation in degrees (0, 90, 180, 270)
  oppgaver: Oppgave[];
}

interface Befaring {
  id: string;
  title: string;
  description?: string;
  befaring_date: string;
  befaring_type: string;
  adresse?: string;
  postnummer?: string;
  sted?: string;
  land?: string;
  status: string;
  tripletex_project_id?: number;
  project_name?: string;
}

interface BefaringDetailProps {
  befaringId: string;
  orgId: string;
  userId: string;
  onBack: () => void;
}

export default function BefaringDetail({
  befaringId,
  orgId,
  userId,
  onBack,
}: BefaringDetailProps) {
  const [befaring, setBefaring] = useState<Befaring | null>(null);
  const [plantegninger, setPlantegninger] = useState<Plantegning[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlantegningViewer, setShowPlantegningViewer] = useState(false);
  const [currentPlantegningIndex, setCurrentPlantegningIndex] = useState(0);
  const [selectedOppgave, setSelectedOppgave] = useState<Oppgave | null>(null);
  const [showOppgaveForm, setShowOppgaveForm] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [showPlantegningUpload, setShowPlantegningUpload] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [plantegningToDelete, setPlantegningToDelete] = useState<Plantegning | null>(null);
  const [activeTab, setActiveTab] = useState('plantegninger');
  const { toast } = useToast();

  const normalizeStatus = (status: string | null | undefined): Oppgave['status'] => {
    switch (status) {
      case 'apen':
      case 'under_arbeid':
      case 'lukket':
        return status;
      default:
        return 'apen';
    }
  };

  const normalizePrioritet = (prioritet: string | null | undefined): Oppgave['prioritet'] => {
    switch (prioritet) {
      case 'kritisk':
      case 'høy':
      case 'medium':
      case 'lav':
        return prioritet;
      default:
        return 'medium';
    }
  };

  const sanitizeOppgave = (raw: any): Oppgave => ({
    id: raw.id,
    oppgave_nummer: raw.oppgave_nummer ?? 0,
    fag: raw.fag ?? 'annet',
    fag_color: raw.fag_color ?? '#94a3b8',
    x_position: raw.x_position ?? 0,
    y_position: raw.y_position ?? 0,
    title: raw.title ?? undefined,
    description: raw.description ?? undefined,
    status: normalizeStatus(raw.status),
    prioritet: normalizePrioritet(raw.prioritet),
    frist: raw.frist ?? undefined,
    underleverandor_id: raw.underleverandor_id ?? undefined,
    underleverandor_navn: raw.underleverandorer?.navn ?? raw.underleverandor_navn ?? undefined,
  });

  useEffect(() => {
    loadBefaringData();
  }, [befaringId]);

  const loadBefaringData = useCallback(async () => {
    console.log('🔄 loadBefaringData called for befaring:', befaringId);
    setLoading(true);
    try {
      // Load befaring details
      const { data: befaringData, error: befaringError } = await supabase
        .from('befaringer')
        .select(`
          *,
          ttx_project_cache!inner(project_name)
        `)
        .eq('id', befaringId)
        .eq('org_id', orgId)
        .single();

      if (befaringError) throw befaringError;
      const sanitizedBefaring: Befaring = {
        id: befaringData.id,
        title: befaringData.title ?? 'Uten tittel',
        description: befaringData.description ?? undefined,
        befaring_date: befaringData.befaring_date ?? new Date().toISOString(),
        befaring_type: befaringData.befaring_type ?? 'forbefaring',
        adresse: befaringData.adresse ?? undefined,
        postnummer: befaringData.postnummer ?? undefined,
        sted: befaringData.sted ?? undefined,
        land: (befaringData as any).land ?? undefined,
        status: befaringData.status ?? 'aktiv',
        tripletex_project_id: befaringData.tripletex_project_id ?? undefined,
        project_name: (befaringData as any).ttx_project_cache?.project_name ?? undefined,
      };

      setBefaring(sanitizedBefaring);

      // Load plantegninger with oppgaver
      const { data: plantegningerData, error: plantegningerError } = await supabase
        .from('plantegninger')
        .select(`
          *,
          oppgaver (
            *,
            underleverandorer!left(navn)
          )
        `)
        .eq('befaring_id', befaringId)
        .order('display_order');

      console.log('📊 Plantegninger data:', plantegningerData);
      console.log('❌ Plantegninger error:', plantegningerError);

      if (plantegningerError) throw plantegningerError;

      const processedPlantegninger: Plantegning[] = (plantegningerData || []).map((p: any) => ({
        id: p.id,
        title: p.title ?? 'Uten tittel',
        image_url: p.image_url ?? '',
        display_order: p.display_order ?? 0,
        file_type: p.file_type ?? 'image', // Default to 'image' if not set
        rotation: p.rotation ?? 0, // Rotation in degrees (0, 90, 180, 270)
        oppgaver: (p.oppgaver ?? []).map((o: any) => sanitizeOppgave(o)),
      }));

      setPlantegninger(processedPlantegninger);
    } catch (error: any) {
      console.error('Error loading befaring:', error);
      toast({
        title: 'Feil',
        description: `Kunne ikke laste befaring: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [befaringId, userId]);

  const handlePlantegningClick = (index: number) => {
    console.log('🖱️ Plantegning clicked:', index, plantegninger[index]?.title);
    setCurrentPlantegningIndex(index);
    setShowPlantegningViewer(true);
    console.log('✅ PlantegningViewer should now be visible');
  };

  const handleAddOppgave = async (x: number, y: number) => {
    const plantegning = plantegninger[currentPlantegningIndex];
    if (!plantegning) return;

    // Create new oppgave with default values
    const { data: maxNumData } = await supabase
      .from('oppgaver')
      .select('oppgave_nummer')
      .eq('plantegning_id', plantegning.id)
      .order('oppgave_nummer', { ascending: false })
      .limit(1);

    const lastOppgaveNummer = maxNumData && maxNumData.length > 0 ? maxNumData[0].oppgave_nummer ?? 0 : 0;
    const nextNummer = lastOppgaveNummer + 1;

    const { data, error } = await supabase
      .from('oppgaver')
      .insert({
        plantegning_id: plantegning.id,
        oppgave_nummer: nextNummer,
        fag: 'annet',
        fag_color: '#94a3b8',
        x_position: x,
        y_position: y,
        status: 'apen',
        prioritet: 'medium',
        created_by: userId, // Use userId directly (auth.uid())
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating oppgave:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke opprette oppgave.',
        variant: 'destructive',
      });
      return;
    }

    // Reload data to get the new oppgave
    loadBefaringData();
    
    // Open the oppgave form for editing
    setSelectedOppgave(sanitizeOppgave(data));
    setShowOppgaveForm(true);
  };

  const handleOppgaveClick = (oppgave: Oppgave) => {
    setSelectedOppgave(oppgave);
    setShowOppgaveForm(true);
  };

  const handleOppgaveSave = () => {
    loadBefaringData();
    setSelectedOppgave(null);
    setShowOppgaveForm(false);
  };

  const handleDeletePlantegning = (plantegning: Plantegning, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setPlantegningToDelete(plantegning);
    setShowDeleteDialog(true);
  };

  const confirmDeletePlantegning = async () => {
    if (!plantegningToDelete) return;

    try {
      // Delete from Supabase Storage first
      const fileName = plantegningToDelete.image_url.split('/').pop();
      if (fileName) {
        const { error: storageError } = await supabase.storage
          .from('befaring-assets')
          .remove([`${befaringId}/${fileName}`]);
        
        if (storageError) {
          console.warn('Storage delete error:', storageError);
          // Continue with database delete even if storage fails
        }
      }

      // Delete from database (this will cascade delete oppgaver)
      const { error: dbError } = await supabase
        .from('plantegninger')
        .delete()
        .eq('id', plantegningToDelete.id);

      if (dbError) throw dbError;

      toast({
        title: 'Plantegning slettet',
        description: `${plantegningToDelete.title ?? 'Plantegning'} har blitt slettet.`
      });

      // Close plantegning viewer since it's been deleted
      setShowPlantegningViewer(false);

      // Refresh data
      loadBefaringData();
    } catch (error) {
      console.error('Error deleting plantegning:', error);
      toast({
        title: 'Feil ved sletting',
        description: 'Kunne ikke slette plantegningen. Prøv igjen.',
        variant: 'destructive'
      });
    } finally {
      setShowDeleteDialog(false);
      setPlantegningToDelete(null);
    }
  };

  const getStatusIcon = (status?: string | null) => {
    switch (status) {
      case 'apen': return <Circle className="h-4 w-4 text-amber-500" />;
      case 'under_arbeid': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'lukket': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Circle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityIcon = (prioritet?: string | null) => {
    switch (prioritet) {
      case 'kritisk': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'høy': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'lav': return <AlertTriangle className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  const getBefaringTypeLabel = (type?: string | null) => {
    switch (type) {
      case 'forbefaring': return 'Forbefaring';
      case 'ferdigbefaring': return 'Ferdigbefaring';
      case 'kvalitetskontroll': return 'Kvalitetskontroll';
      case 'sikkerhetsbefaring': return 'Sikkerhetsbefaring';
      case 'vedlikeholdsbefaring': return 'Vedlikeholdsbefaring';
      default: return 'Annet';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!befaring) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p className="text-muted-foreground">Befaring ikke funnet.</p>
          <Button onClick={onBack} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbake
          </Button>
        </div>
      </div>
    );
  }

  const allOppgaver = plantegninger.flatMap(p => p.oppgaver);
  const openOppgaver = allOppgaver.filter(o => o.status === 'apen');
  const inProgressOppgaver = allOppgaver.filter(o => o.status === 'under_arbeid');
  const closedOppgaver = allOppgaver.filter(o => o.status === 'lukket');

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbake
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{befaring.title || 'Uten tittel'}</h1>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
              <span className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {befaring.befaring_date
                  ? format(new Date(befaring.befaring_date), 'PPP', { locale: nb })
                  : 'Dato ikke satt'}
              </span>
              <span className="flex items-center">
                <Building className="h-4 w-4 mr-1" />
                {getBefaringTypeLabel(befaring.befaring_type)}
              </span>
              {befaring.adresse && (
                <span className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  {befaring.adresse}, {befaring.postnummer} {befaring.sted}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            {allOppgaver.length} oppgaver
          </Badge>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            PDF-rapport
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Circle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{openOppgaver.length}</p>
                <p className="text-sm text-muted-foreground">Åpne oppgaver</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{inProgressOppgaver.length}</p>
                <p className="text-sm text-muted-foreground">Under arbeid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{closedOppgaver.length}</p>
                <p className="text-sm text-muted-foreground">Lukkede oppgaver</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ImageIcon className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{plantegninger.length}</p>
                <p className="text-sm text-muted-foreground">Plantegninger</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="plantegninger">Plantegninger</TabsTrigger>
          <TabsTrigger value="oppgaver">Alle oppgaver</TabsTrigger>
        </TabsList>

        <TabsContent value="plantegninger" className="space-y-4">
          {/* Upload button - always visible */}
          <div className="flex justify-end">
            <Button onClick={() => setShowPlantegningUpload(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Last opp plantegning
            </Button>
          </div>

          {plantegninger.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ingen plantegninger</h3>
                <p className="text-muted-foreground mb-4">
                  Last opp plantegninger for å kunne legge til oppgaver.
                </p>
                <Button onClick={() => setShowPlantegningUpload(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Last opp plantegning
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plantegninger.map((plantegning, index) => (
                <Card 
                  key={plantegning.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handlePlantegningClick(index)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {plantegning.title || 'Uten tittel'}
                      </CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => handleDeletePlantegning(plantegning, e)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Slett plantegning
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Oppgaver:</span>
                        <Badge variant="outline">{plantegning.oppgaver.length}</Badge>
                      </div>
                      
                      {plantegning.oppgaver.length > 0 && (
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="flex items-center">
                            <Circle className="h-3 w-3 text-amber-500 mr-1" />
                            {plantegning.oppgaver.filter(o => o.status === 'apen').length}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 text-blue-500 mr-1" />
                            {plantegning.oppgaver.filter(o => o.status === 'under_arbeid').length}
                          </span>
                          <span className="flex items-center">
                            <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                            {plantegning.oppgaver.filter(o => o.status === 'lukket').length}
                          </span>
                        </div>
                      )}
                      
                      <Button size="sm" className="w-full mt-3">
                        Åpne plantegning
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="oppgaver" className="space-y-4">
          {allOppgaver.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ingen oppgaver</h3>
                <p className="text-muted-foreground mb-4">
                  Klikk på plantegninger for å legge til oppgaver.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {allOppgaver.map((oppgave) => {
                const oppgaveNummer = oppgave.oppgave_nummer;
                const fagColor = oppgave.fag_color || '#94a3b8';
                const fagLabel = oppgave.fag || 'Ukjent fag';
                const oppgaveTitle = oppgave.title ?? `${fagLabel} oppgave`;

                return (
                  <Card key={oppgave.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent 
                      className="p-4" 
                      onClick={(e) => {
                        // Don't open edit dialog if image viewer is open
                        if (imageViewerOpen) return;
                        handleOppgaveClick(oppgave);
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge 
                              className="bg-gray-100 border-gray-500 text-gray-700"
                            >
                              #{oppgaveNummer}
                            </Badge>
                            <Badge 
                              style={{ 
                                backgroundColor: `${fagColor}20`, 
                                borderColor: fagColor,
                                color: fagColor
                              }}
                            >
                              {fagLabel}
                            </Badge>
                            <div className="flex items-center">
                              {getStatusIcon(oppgave.status)}
                            </div>
                            {getPriorityIcon(oppgave.prioritet)}
                          </div>
                          
                          <h3 className="font-semibold mb-1">
                            {oppgaveTitle}
                          </h3>
                          
                          {oppgave.description && (
                            <p className="text-sm text-muted-foreground mb-2 break-words overflow-wrap-anywhere">
                              {oppgave.description}
                            </p>
                          )}
                          
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            {oppgave.frist && (
                              <span>
                                Frist: {new Date(oppgave.frist).toLocaleDateString('no-NO')}
                              </span>
                            )}
                            {oppgave.underleverandor_navn && (
                              <span>UL: {oppgave.underleverandor_navn}</span>
                            )}
                            <OppgaveImageThumbnails 
                              oppgaveId={oppgave.id} 
                              maxThumbnails={3}
                              showUploadButton={false}
                              onViewerStateChange={setImageViewerOpen}
                            />
                          </div>
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOppgaveClick(oppgave);
                          }}
                        >
                          Rediger
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Plantegning Viewer */}
      {showPlantegningViewer && (
        <PlantegningViewer
          plantegninger={plantegninger}
          currentIndex={currentPlantegningIndex}
          onClose={() => setShowPlantegningViewer(false)}
          onNavigate={setCurrentPlantegningIndex}
          onOppgaveClick={handleOppgaveClick}
          onAddOppgave={handleAddOppgave}
          onUpdateOppgave={async (id, updates) => {
            // This would be implemented to update oppgave positions
            console.log('Update oppgave:', id, updates);
          }}
          onDeleteOppgave={async (id) => {
            try {
              const { error } = await supabase
                .from('oppgaver')
                .delete()
                .eq('id', id);

              if (error) throw error;

              // Reload data to refresh the plantegning with updated oppgaver
              loadBefaringData();
            } catch (error) {
              console.error('Error deleting oppgave:', error);
              throw error; // Re-throw to let PlantegningViewer handle the error display
            }
          }}
          onDeletePlantegning={async (plantegningId) => {
            const plantegning = plantegninger.find(p => p.id === plantegningId);
            if (plantegning) {
              setPlantegningToDelete(plantegning);
              setShowDeleteDialog(true);
              // Don't close viewer - let user decide in dialog
            }
          }}
        />
      )}

      {/* Oppgave Form */}
      {showOppgaveForm && selectedOppgave && (
        <OppgaveForm
          oppgave={selectedOppgave}
          plantegningId={selectedOppgave.id} // This should be the plantegning ID
          orgId={orgId}
          isOpen={showOppgaveForm}
          onClose={() => {
            setShowOppgaveForm(false);
            setSelectedOppgave(null);
          }}
          onSave={handleOppgaveSave}
        />
      )}

      {/* Plantegning Upload */}
      {showPlantegningUpload && (
        <PlantegningUpload
          open={showPlantegningUpload}
          onOpenChange={setShowPlantegningUpload}
          befaringId={befaringId}
          onSuccess={loadBefaringData}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slett plantegning</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil slette "{plantegningToDelete?.title ?? 'Plantegning'}"? 
              Denne handlingen kan ikke angres og vil også slette alle tilknyttede oppgaver.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeletePlantegning}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Slett plantegning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
