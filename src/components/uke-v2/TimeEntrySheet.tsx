'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { saveVehicleEntry, VehicleTypeOption } from '@/lib/vehicleEntries';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChevronRight } from 'lucide-react';
import ProjectSelector from './ProjectSelector';
import ActivitySelector from './ActivitySelector';

interface TimeEntrySheetProps {
  open: boolean;
  onClose: () => void;
  date: string;
  personId: string;
  orgId: string;
  entryId?: string; // For editing existing entry
}


const QUICK_HOURS = [
  { label: '0t 30m', value: 0.5 },
  { label: '1t', value: 1 },
  { label: '7t 30m', value: 7.5 },
  { label: '8t', value: 8 },
];

export default function TimeEntrySheet({ 
  open, 
  onClose, 
  date, 
  personId, 
  orgId,
  entryId 
}: TimeEntrySheetProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [comment, setComment] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleTypeOption>('none');
  const [vehicleDistanceKm, setVehicleDistanceKm] = useState<number>(0);
  
  // Separate state for vehicle types
  const [servicebilEnabled, setServicebilEnabled] = useState(false);
  const [kmUtenforEnabled, setKmUtenforEnabled] = useState(false);
  const [tilhengerEnabled, setTilhengerEnabled] = useState(false);

  // Sync separate states with vehicleType when vehicleType changes externally
  useEffect(() => {
    setServicebilEnabled(vehicleType === 'servicebil');
    setKmUtenforEnabled(vehicleType === 'km_utenfor');
    setTilhengerEnabled(vehicleType === 'tilhenger');
  }, [vehicleType]);
  
  // Dialog states
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [showActivitySelector, setShowActivitySelector] = useState(false);

  useEffect(() => {
    if (open && !entryId) {
      // Reset form for new entry
      setSelectedProject(null);
      setSelectedActivity(null);
      setHours(0);
      setMinutes(0);
      setComment('');
      setVehicleType('none');
      setVehicleDistanceKm(0);
      setServicebilEnabled(false);
      setKmUtenforEnabled(false);
      setTilhengerEnabled(false);
    }
  }, [open, entryId]);

  const totalHours = hours + (minutes / 60);

  const handleQuickSelect = (value: number) => {
    const wholeHours = Math.floor(value);
    const mins = Math.round((value - wholeHours) * 60);
    setHours(wholeHours);
    setMinutes(mins);
  };

  const handleVehicleToggle = (type: 'servicebil' | 'km_utenfor' | 'tilhenger', checked: boolean) => {
    if (type === 'servicebil') {
      setServicebilEnabled(checked);
      if (checked) {
        // Servicebil aktivert - deaktiver km_utenfor
        setKmUtenforEnabled(false);
        setVehicleType('servicebil');
        setVehicleDistanceKm(0);
      } else {
        // Servicebil deaktivert
        if (tilhengerEnabled) {
          setVehicleType('tilhenger');
        } else {
          setVehicleType('none');
        }
      }
    } else if (type === 'km_utenfor') {
      setKmUtenforEnabled(checked);
      if (checked) {
        // Km utenfor aktivert - deaktiver servicebil
        setServicebilEnabled(false);
        setVehicleType('km_utenfor');
        if (vehicleDistanceKm <= 0) {
          setVehicleDistanceKm(1);
        }
      } else {
        // Km utenfor deaktivert
        setVehicleDistanceKm(0);
        if (tilhengerEnabled) {
          setVehicleType('tilhenger');
        } else {
          setVehicleType('none');
        }
      }
    } else if (type === 'tilhenger') {
      setTilhengerEnabled(checked);
      // Tilhenger kan være aktiv uavhengig av servicebil/km_utenfor
      if (!checked) {
        // Hvis tilhenger er deaktivert, sjekk hva som skal være aktiv
        if (servicebilEnabled) {
          setVehicleType('servicebil');
        } else if (kmUtenforEnabled) {
          setVehicleType('km_utenfor');
        } else {
          setVehicleType('none');
        }
      } else {
        // Tilhenger aktivert - hvis ingen annen type er aktiv, sett til tilhenger
        if (!servicebilEnabled && !kmUtenforEnabled) {
          setVehicleType('tilhenger');
        }
        // Hvis servicebil eller km_utenfor er aktiv, beholde den
      }
    }
  };

  const handleSave = async () => {
    if (!selectedProject || !selectedActivity) {
      toast({
        title: 'Mangler informasjon',
        description: 'Velg prosjekt og aktivitet',
        variant: 'destructive'
      });
      return;
    }

    if (totalHours <= 0) {
      toast({
        title: 'Mangler timer',
        description: 'Legg til antall timer',
        variant: 'destructive'
      });
      return;
    }

    if (vehicleType === 'km_utenfor' && vehicleDistanceKm <= 0) {
      toast({
        title: 'Manglende kilometer',
        description: 'Oppgi antall kilometer for kjøring utenfor Oslo/Akershus.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // First, create or get vakt entry
      const { data: existingVakt, error: vaktError } = await supabase
        .from('vakt')
        .select('id')
        .eq('person_id', personId)
        .eq('dato', date)
        .eq('project_id', selectedProject.id)
        .eq('org_id', orgId)
        .single();

      if (vaktError && vaktError.code !== 'PGRST116') {
        throw vaktError;
      }

      let vaktId = existingVakt?.id;

      if (!vaktId) {
        // Create new vakt entry
        const { data: newVakt, error: vaktCreateError } = await supabase
          .from('vakt')
          .insert({
            person_id: personId,
            dato: date,
            project_id: selectedProject.id,
            org_id: orgId
          })
          .select('id')
          .single();

        if (vaktCreateError) throw vaktCreateError;
        vaktId = newVakt.id;
      }

      // Create vakt_timer entry
      const { error: timerError } = await supabase
        .from('vakt_timer')
        .insert({
          vakt_id: vaktId,
          timer: totalHours,
          aktivitet_id: selectedActivity.id,
          status: 'godkjent',
          notat: comment || null,
          is_overtime: false,
          lonnstype: 'normal',
          org_id: orgId
        });

      if (timerError) throw timerError;

      // Save primary vehicle entry (servicebil or km_utenfor)
      if (vehicleType !== 'none' && vehicleType !== 'tilhenger') {
        await saveVehicleEntry({
          supabase,
          vaktId,
          orgId,
          vehicleType,
          distanceKm: vehicleDistanceKm,
        });
      }

      // Save tilhenger entry separately if enabled
      if (tilhengerEnabled) {
        // Find existing tilhenger entry if it exists
        const { data: existingTilhenger } = await supabase
          .from('vehicle_entries')
          .select('id, tripletex_entry_id')
          .eq('vakt_id', vaktId)
          .eq('vehicle_type', 'tilhenger')
          .maybeSingle();

        await saveVehicleEntry({
          supabase,
          vaktId,
          orgId,
          vehicleType: 'tilhenger',
          distanceKm: 0,
          existingEntryId: existingTilhenger?.id ?? null,
          existingTripletexEntryId: existingTilhenger?.tripletex_entry_id ?? null,
        });
      } else {
        // Remove tilhenger entry if it exists
        const { data: existingTilhenger } = await supabase
          .from('vehicle_entries')
          .select('id, tripletex_entry_id')
          .eq('vakt_id', vaktId)
          .eq('vehicle_type', 'tilhenger')
          .maybeSingle();

        if (existingTilhenger) {
          if (!existingTilhenger.tripletex_entry_id) {
            // Not synced yet - delete directly
            await supabase
              .from('vehicle_entries')
              .delete()
              .eq('id', existingTilhenger.id);
          } else {
            // Mark for deletion
            await supabase
              .from('vehicle_entries')
              .update({
                sync_status: 'pending_delete',
                sync_log: null,
                distance_km: 0,
              })
              .eq('id', existingTilhenger.id);
          }
        }
      }

      toast({
        title: 'Lagret',
        description: `${totalHours}t registrert på ${selectedProject.project_name}`
      });

      onClose();
    } catch (error) {
      console.error('Error saving time entry:', error);
      toast({
        title: 'Feil ved lagring',
        description: 'Kunne ikke lagre timeregistrering',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    // TODO: Implement delete functionality
    toast({
      title: 'Ikke implementert ennå',
      description: 'Slett-funksjonalitet kommer snart'
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-center">
              Dag: {new Date(date).toLocaleDateString('nb-NO', { 
                day: 'numeric', 
                month: 'short' 
              })}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Project Selector */}
            <button
              onClick={() => setShowProjectSelector(true)}
              className="w-full p-4 bg-gray-50 rounded-lg flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <div className="text-left">
                <div className="text-sm text-gray-500">Prosjekt</div>
                <div className="font-medium text-gray-900">
                  {selectedProject ? selectedProject.project_name : 'Velg prosjekt'}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            {/* Activity Selector */}
            <button
              onClick={() => selectedProject && setShowActivitySelector(true)}
              disabled={!selectedProject}
              className="w-full p-4 bg-gray-50 rounded-lg flex items-center justify-between hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-left flex items-center gap-3">
                {selectedActivity && (
                  <div className="w-8 h-8 rounded-full bg-purple-600"></div>
                )}
                <div>
                  <div className="text-sm text-gray-500">Aktivitet</div>
                  <div className="font-medium text-gray-900">
                    {selectedActivity ? selectedActivity.navn : 'Velg aktivitet'}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            {/* Hours Input */}
            <div className="space-y-3">
              <label className="text-sm text-gray-700 font-medium">Antall timer</label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={hours}
                    onChange={(e) => setHours(parseInt(e.target.value) || 0)}
                    className="text-center text-2xl font-bold h-16"
                  />
                  <div className="text-center text-sm text-gray-500 mt-1">t</div>
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    step="15"
                    value={minutes}
                    onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
                    className="text-center text-2xl font-bold h-16"
                  />
                  <div className="text-center text-sm text-gray-500 mt-1">m</div>
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex gap-2">
                {QUICK_HOURS.map((quick) => (
                  <Button
                    key={quick.value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSelect(quick.value)}
                    className="flex-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 border-0"
                  >
                    {quick.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <label className="text-sm text-gray-700 font-medium flex items-center gap-2">
                Kommentar
                <span className="text-xs text-gray-400">(valgfritt)</span>
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Legg til kommentar..."
                className="min-h-[80px] resize-none"
              />
              <p className="text-xs text-gray-400">
                Sensitive opplysninger bør ikke inkluderes her.
              </p>
            </div>

            {/* Vehicle compensation */}
            <div className="space-y-3">
              <label className="text-sm text-gray-700 font-medium">Kjøretøy-kompensasjon</label>
              
              <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                {/* Servicebil */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="servicebil-switch-sheet" className="cursor-pointer font-normal">
                    Servicebil Oslo/Akershus
                  </Label>
                  <Switch
                    id="servicebil-switch-sheet"
                    checked={servicebilEnabled}
                    onCheckedChange={(checked) => handleVehicleToggle('servicebil', checked)}
                    disabled={kmUtenforEnabled}
                  />
                </div>

                {/* Km utenfor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="km-utenfor-switch-sheet" className="cursor-pointer font-normal">
                      Km utenfor Oslo/Akershus
                    </Label>
                    <Switch
                      id="km-utenfor-switch-sheet"
                      checked={kmUtenforEnabled}
                      onCheckedChange={(checked) => handleVehicleToggle('km_utenfor', checked)}
                      disabled={servicebilEnabled}
                    />
                  </div>
                  {kmUtenforEnabled && (
                    <div className="flex items-center gap-3 pl-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={Number.isFinite(vehicleDistanceKm) ? vehicleDistanceKm : 0}
                        onChange={(event) => setVehicleDistanceKm(Math.max(0, Number(event.target.value) || 0))}
                        className="w-32"
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-500">km</span>
                    </div>
                  )}
                </div>

                {/* Tilhenger */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="tilhenger-switch-sheet" className="cursor-pointer font-normal">
                    Tilhenger
                  </Label>
                  <Switch
                    id="tilhenger-switch-sheet"
                    checked={tilhengerEnabled}
                    onCheckedChange={(checked) => handleVehicleToggle('tilhenger', checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="absolute bottom-6 left-6 right-6 flex gap-3">
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={loading || !entryId}
              className="flex-1 py-6 text-lg"
            >
              Slett
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !selectedProject || !selectedActivity || totalHours <= 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
            >
              {loading ? 'Lagrer...' : 'Lagre'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Project Selector Dialog */}
      {showProjectSelector && (
        <ProjectSelector
          open={showProjectSelector}
          onClose={() => setShowProjectSelector(false)}
          onSelect={(project) => {
            setSelectedProject(project);
            setShowProjectSelector(false);
          }}
          orgId={orgId}
        />
      )}

      {/* Activity Selector Dialog */}
      {showActivitySelector && selectedProject && (
        <ActivitySelector
          open={showActivitySelector}
          onClose={() => setShowActivitySelector(false)}
          onSelect={(activity) => {
            setSelectedActivity(activity);
            setShowActivitySelector(false);
          }}
          projectId={selectedProject.id}
        />
      )}
    </>
  );
}
