import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, MessageSquare, Paperclip, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatTimeValue, validateTimeStep } from '@/lib/displayNames';
import { validateHours, validateUUID, validateStatus, validateFreeLineText, ValidationError } from '@/lib/validation';
import { useCSRFToken } from '@/lib/csrf';
import { useTimeEntryMutation, useDeleteTimeEntry } from '@/hooks/useStaffingData';

interface TimeEntryProps {
  vaktId: string;
  orgId: string;
  onSave?: () => void;
  defaultTimer?: number;
  existingEntry?: {
    id: string;
    timer: number;
    aktivitet_id: string;
    notat: string;
    status: string;
    original_timer?: number;
    original_aktivitet_id?: string;
    original_notat?: string;
    original_status?: string;
  };
}

interface Activity {
  id: string;
  navn: string;
}

const TimeEntry = ({ vaktId, orgId, onSave, defaultTimer = 0.0, existingEntry }: TimeEntryProps) => {
  const [hours, setHours] = useState(Math.floor(existingEntry?.timer || defaultTimer));
  const [minutes, setMinutes] = useState(Math.round(((existingEntry?.timer || defaultTimer) % 1) * 60));
  const [aktivitetId, setAktivitetId] = useState(existingEntry?.aktivitet_id || '');
  const [notat, setNotat] = useState(existingEntry?.notat || '');
  const [status, setStatus] = useState<'utkast' | 'sendt' | 'godkjent'>((existingEntry?.status as 'utkast' | 'sendt' | 'godkjent') || 'utkast');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { addCSRFHeader } = useCSRFToken();
  
  // React Query mutations
  const timeEntryMutation = useTimeEntryMutation();
  const deleteTimeEntryMutation = useDeleteTimeEntry();
  
  // Use React Query loading state instead of local loading
  const isLoading = timeEntryMutation.isPending || deleteTimeEntryMutation.isPending || loading;

  // Separate overtime time entries for 100% and 50%
  const [overtime100Hours, setOvertime100Hours] = useState(0);
  const [overtime100Minutes, setOvertime100Minutes] = useState(0);
  const [overtime50Hours, setOvertime50Hours] = useState(0);
  const [overtime50Minutes, setOvertime50Minutes] = useState(0);
  const [showOvertime, setShowOvertime] = useState(false); // Collapsed by default
  const [isLocked, setIsLocked] = useState(false);
  const [tripletexSynced, setTripletexSynced] = useState(false);

  // Calculate total timer value from hours and minutes
  const timer = hours + (minutes / 60);
  const overtime100Timer = overtime100Hours + (overtime100Minutes / 60);
  const overtime50Timer = overtime50Hours + (overtime50Minutes / 60);
  const totalOvertimeTimer = overtime100Timer + overtime50Timer;

  const loadActivities = useCallback(async () => {
    try {
      console.log('Loading activities for orgId:', orgId);
      
      // First, let's check what data exists in the table
      const { data: allData, error: allError } = await supabase
        .from('ttx_activity_cache')
        .select('id, navn, aktiv, org_id')
        .eq('org_id', orgId);
      
      console.log('All activities for org:', allData);
      console.log('All activities error:', allError);
      
      if (allError) {
        console.error('Supabase error loading all activities:', allError);
        throw allError;
      }
      
      // Now try the filtered query (removed aktiv filter as column doesn't exist)
      const { data, error } = await supabase
        .from('ttx_activity_cache')
        .select('id, navn')
        .eq('org_id', orgId)
        .order('navn');

      console.log('Activities for org:', data);
      console.log('Activities error:', error);

      if (error) {
        console.error('Supabase error loading activities:', error);
        throw error;
      }
      
      // If no active activities found, try without the aktiv filter
      if (!data || data.length === 0) {
        console.log('No active activities found, trying without aktiv filter...');
        const { data: allActiveData, error: allActiveError } = await supabase
          .from('ttx_activity_cache')
          .select('id, navn')
          .eq('org_id', orgId)
          .order('navn');
        
        console.log('All activities without aktiv filter:', allActiveData);
        
        if (!allActiveError && allActiveData && allActiveData.length > 0) {
          console.log('Found activities without aktiv filter, using them');
          // Filter out overtime activities from the fallback data too
          const filteredFallbackData = allActiveData.filter(activity => {
            const navn = activity.navn?.toLowerCase() || '';
            return !navn.includes('overtid') && 
                   !navn.includes('overtime') && 
                   !navn.includes('50%') && 
                   !navn.includes('100%');
          });
          setActivities(filteredFallbackData);
          return;
        }
      }
      
      // Filter out overtime activities from the main dropdown
      const filteredData = (data || []).filter(activity => {
        const navn = activity.navn?.toLowerCase() || '';
        return !navn.includes('overtid') && 
               !navn.includes('overtime') && 
               !navn.includes('50%') && 
               !navn.includes('100%');
      });
      
      setActivities(filteredData);
      
      if (!filteredData || filteredData.length === 0) {
        console.log('No non-overtime activities found for orgId:', orgId);
        toast({
          title: "Ingen aktiviteter funnet",
          description: "Det er ingen aktive aktiviteter konfigurert for denne organisasjonen.",
          variant: "destructive"
        });
      } else {
        console.log(`Successfully loaded ${filteredData.length} activities (overtime activities filtered out)`);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      toast({
        title: "Feil ved lasting av aktiviteter",
        description: error instanceof Error ? error.message : "Kunne ikke laste aktiviteter.",
        variant: "destructive"
      });
    }
  }, [orgId, toast]);

  useEffect(() => {
    // Load activities when component mounts
    loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    // Load all existing timer entries and update state when existingEntry changes
    const loadData = async () => {
      // Reset all state before loading
      setOvertime100Hours(0);
      setOvertime100Minutes(0);
      setOvertime50Hours(0);
      setOvertime50Minutes(0);
      setShowOvertime(false);

      // Load ALL existing timer entries for this vakt (both regular and overtime)
      try {
        const { data, error } = await supabase
          .from('vakt_timer')
          .select('timer, is_overtime, lonnstype, aktivitet_id, notat, status, original_timer, original_aktivitet_id, original_notat, original_status, tripletex_synced_at')
          .eq('vakt_id', vaktId);

        if (error) throw error;

        if (data && data.length > 0) {
          // Check if ANY entry is locked (godkjent, sendt, or synced to Tripletex)
          const anyLocked = data.some(entry => 
            entry.status === 'godkjent' || 
            entry.status === 'sendt' || 
            entry.tripletex_synced_at !== null
          );
          setIsLocked(anyLocked);
          setTripletexSynced(data.some(entry => entry.tripletex_synced_at !== null));
          
          // Separate regular time and overtime
          let totalRegularTime = 0;
          let totalOvertime50 = 0;
          let totalOvertime100 = 0;
          const firstEntry = data[0]; // Use first entry for activity, note, status
          
          data.forEach(entry => {
            const timer = entry.timer ?? 0;
            const lonnstype = entry.lonnstype || '';
            
            if (entry.is_overtime) {
              // Use lonnstype to determine overtime type
              if (lonnstype === 'overtid_50') {
                totalOvertime50 += timer;
              } else if (lonnstype === 'overtid_100') {
                totalOvertime100 += timer;
              } else {
                // Fallback for old entries without specific overtime type
                if (timer <= 4) {
                  totalOvertime50 += timer;
                } else {
                  totalOvertime100 += timer;
                }
              }
            } else {
              totalRegularTime += timer;
            }
          });

          // Set regular time
          setHours(Math.max(0, Math.min(8, Math.floor(totalRegularTime))));
          setMinutes(Math.max(0, Math.min(45, Math.round((totalRegularTime % 1) * 60 / 15) * 15)));

          // Set 50% overtime
          if (totalOvertime50 > 0) {
            setOvertime50Hours(Math.floor(totalOvertime50));
            setOvertime50Minutes(Math.max(0, Math.min(45, Math.round((totalOvertime50 % 1) * 60 / 15) * 15)));
          }

          // Set 100% overtime
          if (totalOvertime100 > 0) {
            setOvertime100Hours(Math.floor(totalOvertime100));
            setOvertime100Minutes(Math.max(0, Math.min(45, Math.round((totalOvertime100 % 1) * 60 / 15) * 15)));
          }

          // Show overtime section if any overtime exists
          if (totalOvertime50 > 0 || totalOvertime100 > 0) {
            setShowOvertime(true);
          }

          // Set activity, note, and status from first entry (use original values if available)
          setAktivitetId((firstEntry.original_aktivitet_id ?? firstEntry.aktivitet_id) || '');
          setNotat((firstEntry.original_notat ?? firstEntry.notat) || '');
          setStatus(((firstEntry.original_status ?? firstEntry.status) || 'utkast') as 'utkast' | 'sendt' | 'godkjent');
        } else {
          // For new entries, reset to default values
          setHours(Math.floor(defaultTimer));
          setMinutes(Math.max(0, Math.min(45, Math.round((defaultTimer % 1) * 60 / 15) * 15)));
          setAktivitetId('');
          setNotat('');
          setStatus('utkast');
        }
      } catch (error) {
        console.error('Error loading existing timer entries:', error);
        // Fallback to existingEntry if database load fails
        if (existingEntry) {
          const baseTimer = existingEntry.original_timer ?? existingEntry.timer ?? defaultTimer;
          const baseHours = Math.floor(baseTimer);
          const baseMinutes = Math.round((baseTimer % 1) * 60);

          setHours(Math.max(0, Math.min(8, baseHours)));
          setMinutes(Math.max(0, Math.min(45, Math.round(baseMinutes / 15) * 15)));
          setAktivitetId((existingEntry.original_aktivitet_id ?? existingEntry.aktivitet_id) || '');
          setNotat((existingEntry.original_notat ?? existingEntry.notat) || '');
          setStatus(((existingEntry.original_status ?? existingEntry.status) || 'utkast') as 'utkast' | 'sendt' | 'godkjent');
        }
      }
    };

    loadData();
  }, [vaktId, existingEntry, defaultTimer]);

  const adjustHours = (delta: number) => {
    const newHours = Math.max(0, Math.min(16, hours + delta));
    setHours(newHours);
  };

  const adjustMinutes = (delta: number) => {
    const newMinutes = Math.max(0, Math.min(45, minutes + delta));
    // Ensure minutes are in 15-minute intervals
    const roundedMinutes = Math.round(newMinutes / 15) * 15;
    setMinutes(roundedMinutes);
  };

  const adjustOvertime100Hours = (delta: number) => {
    const newHours = Math.max(0, Math.min(10, overtime100Hours + delta));
    setOvertime100Hours(newHours);
  };

  const adjustOvertime100Minutes = (delta: number) => {
    const newMinutes = Math.max(0, Math.min(45, overtime100Minutes + delta));
    const roundedMinutes = Math.round(newMinutes / 15) * 15;
    setOvertime100Minutes(roundedMinutes);
  };

  const adjustOvertime50Hours = (delta: number) => {
    const newHours = Math.max(0, Math.min(10, overtime50Hours + delta));
    setOvertime50Hours(newHours);
  };

  const adjustOvertime50Minutes = (delta: number) => {
    const newMinutes = Math.max(0, Math.min(45, overtime50Minutes + delta));
    const roundedMinutes = Math.round(newMinutes / 15) * 15;
    setOvertime50Minutes(roundedMinutes);
  };

  const handleSave = async (nextStatus: 'utkast' | 'sendt' | 'godkjent' = status) => {
    console.log('handleSave called with:', { aktivitetId, timer, nextStatus, activities: activities.length });
    
    try {
      // Validate all inputs
      const validatedData = {
        vaktId: validateUUID(vaktId),
        orgId: validateUUID(orgId),
        aktivitetId: validateUUID(aktivitetId),
        timer: validateHours(timer),
        overtime100Timer: validateHours(overtime100Timer),
        overtime50Timer: validateHours(overtime50Timer),
        status: validateStatus(nextStatus),
        notat: validateFreeLineText(notat)
      };
      
      if (!aktivitetId) {
        toast({
          title: "Aktivitet påkrevd",
          description: "Du må velge en aktivitet før du kan lagre.",
          variant: "destructive"
        });
        return;
      }

      if (activities.length === 0) {
        toast({
          title: "Ingen aktiviteter tilgjengelig",
          description: "Det er ingen aktive aktiviteter konfigurert. Kontakt administrator.",
          variant: "destructive"
        });
        return;
      }

      // Verify the selected activity exists
      const selectedActivity = activities.find(a => a.id === aktivitetId);
      if (!selectedActivity) {
        toast({
          title: "Ugyldig aktivitet",
          description: "Den valgte aktiviteten eksisterer ikke lenger.",
          variant: "destructive"
        });
        return;
      }

      if (!validateTimeStep(validatedData.timer)) {
        toast({
          title: "Ugyldig timesteg",
          description: "Timer må være i 0,25-steg (f.eks. 7,25, 7,50, 7,75, 8,00).",
          variant: "destructive"
        });
        return;
      }

      if (
        totalOvertimeTimer > 0 &&
        (!validateTimeStep(overtime100Timer) || !validateTimeStep(overtime50Timer))
      ) {
        toast({
          title: "Ugyldig overtidstidsverdi",
          description: "Overtidstimer må være i 0,25-steg (f.eks. 1,25, 2,50, 3,75, 4,00).",
          variant: "destructive"
        });
        return;
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        toast({
          title: "Ugyldig input",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      throw error;
    }

    // Find specific overtime activities (50% and 100%)
    let overtime50ActivityId = null;
    let overtime100ActivityId = null;
    
    if (overtime100Timer > 0 || overtime50Timer > 0) {
      try {
        // Look for specific overtime activities (removed aktiv filter as column doesn't exist)
        const { data: overtimeActivities, error: overtimeError } = await supabase
          .from('ttx_activity_cache')
          .select('id, navn, ttx_id')
          .eq('org_id', orgId)
          .ilike('navn', '%overtid%');

        if (overtimeError) {
          console.error('Error loading overtime activities:', overtimeError);
        } else if (overtimeActivities && overtimeActivities.length > 0) {
          console.log('Available overtime activities:', overtimeActivities.map(a => ({ id: a.id, navn: a.navn })));
          
          // Find specific overtime activities with more flexible search
          const overtime50Activity = overtimeActivities.find(act => 
            act.navn && (
              act.navn.toLowerCase().includes('50%') ||
              act.navn.toLowerCase().includes('50') ||
              act.navn.toLowerCase().includes('halv')
            )
          );
          const overtime100Activity = overtimeActivities.find(act => 
            act.navn && (
              act.navn.toLowerCase().includes('100%') ||
              act.navn.toLowerCase().includes('100') ||
              act.navn.toLowerCase().includes('full') ||
              act.navn.toLowerCase().includes('hel')
            )
          );
          
          if (overtime50Activity) {
            overtime50ActivityId = overtime50Activity.id;
            console.log('Found 50% overtime activity:', overtime50Activity);
          }
          if (overtime100Activity) {
            overtime100ActivityId = overtime100Activity.id;
            console.log('Found 100% overtime activity:', overtime100Activity);
          }
        } else {
          console.log('No overtime activities found in cache - edge function will create them automatically');
        }
      } catch (error) {
        console.error('Error finding overtime activities:', error);
      }
    }

    const previousStatus = status;
    setStatus(nextStatus);
    setLoading(true);

    // Prepare entries for React Query mutation
    const entries = [];
    
    // Normal time entry
    entries.push({
      timer,
      aktivitetId,
      notat: notat || '',
      status: nextStatus,
      isOvertime: false,
      lonnstype: 'normal'
    });

    // Overtime entries
    if (overtime100Timer > 0) {
      entries.push({
        timer: overtime100Timer,
        aktivitetId,
        overtimeAktivitetId: overtime100ActivityId || undefined,
        notat: notat || '',
        status: nextStatus,
        isOvertime: true,
        lonnstype: 'overtid_100'
      });
    }

    if (overtime50Timer > 0) {
      entries.push({
        timer: overtime50Timer,
        aktivitetId,
        overtimeAktivitetId: overtime50ActivityId || undefined,
        notat: notat || '',
        status: nextStatus,
        isOvertime: true,
        lonnstype: 'overtid_50'
      });
    }

    // Use React Query mutation
    timeEntryMutation.mutate(
      {
        vaktId,
        orgId,
        entries
      },
      {
        onSuccess: () => {
          toast({
            title: "Lagret",
            description: `Timeføring lagret${totalOvertimeTimer > 0 ? ` med ${formatTimeValue(totalOvertimeTimer)} overtid` : ''}.`
          });
          onSave?.();
          setLoading(false);
        },
        onError: (error: unknown) => {
          toast({
            title: "Lagring feilet",
            description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
            variant: "destructive"
          });
          setStatus(previousStatus);
          setLoading(false);
        }
      }
    );
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'godkjent':
        return <Badge className="bg-green-500">🟢 Godkjent</Badge>;
      case 'sendt':
        return <Badge className="bg-blue-500">🔵 Sendt</Badge>;
      default:
        return <Badge variant="outline">📝 Utkast</Badge>;
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeføring
          </span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Locked Message */}
        {isLocked && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-semibold">Timer er godkjent og kan ikke endres</p>
                <p className="text-sm mt-1">
                  {tripletexSynced 
                    ? 'Timene er sendt til Tripletex og kan ikke redigeres.' 
                    : 'Timene er godkjent av admin og kan ikke redigeres.'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Label>Timer</Label>
          <div className="flex items-center justify-center gap-6 p-4 border rounded-lg bg-muted/20">
            {/* Hours Section */}
            <div className="flex flex-col items-center space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-12 w-16"
                onClick={() => adjustHours(1)}
                disabled={hours >= 16 || isLocked}
              >
                <ChevronUp className="h-6 w-6" />
              </Button>
              <div className="text-3xl font-bold w-16 text-center">
                {hours.toString().padStart(2, '0')}
                <div className="text-xs text-muted-foreground font-normal mt-1">T</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-12 w-16"
                onClick={() => adjustHours(-1)}
                disabled={hours <= 0 || isLocked}
              >
                <ChevronDown className="h-6 w-6" />
              </Button>
            </div>

            {/* Minutes Section */}
            <div className="flex flex-col items-center space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-12 w-16"
                onClick={() => adjustMinutes(15)}
                disabled={minutes >= 45 || isLocked}
              >
                <ChevronUp className="h-6 w-6" />
              </Button>
              <div className="text-3xl font-bold w-16 text-center">
                {minutes.toString().padStart(2, '0')}
                <div className="text-xs text-muted-foreground font-normal mt-1">M</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-12 w-16"
                onClick={() => adjustMinutes(-15)}
                disabled={minutes <= 0 || isLocked}
              >
                <ChevronDown className="h-6 w-6" />
              </Button>
            </div>
          </div>

          {/* Quick Select Buttons */}
          {!isLocked && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground text-center">Hurtigvalg:</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  { label: '0.5t', hours: 0, minutes: 30 },
                  { label: '1t', hours: 1, minutes: 0 },
                  { label: '2t', hours: 2, minutes: 0 },
                  { label: '4t', hours: 4, minutes: 0 },
                  { label: '7.5t', hours: 7, minutes: 30 },
                  { label: '8t', hours: 8, minutes: 0 },
                ].map((quick) => (
                  <Button
                    key={quick.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setHours(quick.hours);
                      setMinutes(quick.minutes);
                    }}
                    className="bg-blue-600 text-white hover:bg-blue-700 border-0 min-w-[60px]"
                  >
                    {quick.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            Total: {formatTimeValue(timer)} timer
            {totalOvertimeTimer > 0 && (
              <span className="ml-2 text-yellow-600 font-bold">
                + {formatTimeValue(totalOvertimeTimer)} overtid ⚡
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="aktivitet">Aktivitet *</Label>
          <Select 
            value={aktivitetId} 
            onValueChange={(value) => {
              console.log('Activity selected:', value);
              setAktivitetId(value);
            }}
            disabled={activities.length === 0 || isLocked}
          >
            <SelectTrigger>
              <SelectValue placeholder={activities.length === 0 ? "Ingen aktiviteter tilgjengelig" : "Velg aktivitet"} />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              {activities.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Ingen aktiviteter tilgjengelig
                </div>
              ) : (
                activities.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.navn}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {activities.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Kontakt administrator for å få aktiviteter konfigurert.
            </p>
          )}
        </div>

        {/* Overtime Section */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowOvertime(!showOvertime)}
            className="w-full h-12 justify-between px-4 hover:bg-gray-100 rounded-lg"
            disabled={isLocked}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Overtid</span>
            </div>
            <ChevronDown className={`h-5 w-5 transition-transform ${showOvertime ? 'rotate-180' : ''}`} />
          </Button>
          
          {showOvertime && (
            <div className="space-y-4 p-4 border rounded-lg bg-yellow-50 border-yellow-200">
              {/* 100% Overtime */}
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium">Overtidstillegg 100%</Label>
                <div className="flex items-center justify-center gap-6">
                  {/* 100% Hours */}
                  <div className="flex flex-col items-center space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-12 w-16"
                      onClick={() => adjustOvertime100Hours(1)}
                      disabled={overtime100Hours >= 10 || isLocked}
                    >
                      <ChevronUp className="h-6 w-6" />
                    </Button>
                    <div className="text-3xl font-bold w-16 text-center">
                      {overtime100Hours.toString().padStart(2, '0')}
                      <div className="text-xs text-muted-foreground font-normal mt-1">T</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-12 w-16"
                      onClick={() => adjustOvertime100Hours(-1)}
                      disabled={overtime100Hours <= 0 || isLocked}
                    >
                      <ChevronDown className="h-6 w-6" />
                    </Button>
                  </div>

                  {/* 100% Minutes */}
                  <div className="flex flex-col items-center space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-12 w-16"
                      onClick={() => adjustOvertime100Minutes(15)}
                      disabled={overtime100Minutes >= 45 || isLocked}
                    >
                      <ChevronUp className="h-6 w-6" />
                    </Button>
                    <div className="text-3xl font-bold w-16 text-center">
                      {overtime100Minutes.toString().padStart(2, '0')}
                      <div className="text-xs text-muted-foreground font-normal mt-1">M</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-12 w-16"
                      onClick={() => adjustOvertime100Minutes(-15)}
                      disabled={overtime100Minutes <= 0 || isLocked}
                    >
                      <ChevronDown className="h-6 w-6" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* 50% Overtime */}
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium">Overtidstillegg 50%</Label>
                <div className="flex items-center justify-center gap-6">
                  {/* 50% Hours */}
                  <div className="flex flex-col items-center space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-12 w-16"
                      onClick={() => adjustOvertime50Hours(1)}
                      disabled={overtime50Hours >= 10 || isLocked}
                    >
                      <ChevronUp className="h-6 w-6" />
                    </Button>
                    <div className="text-3xl font-bold w-16 text-center">
                      {overtime50Hours.toString().padStart(2, '0')}
                      <div className="text-xs text-muted-foreground font-normal mt-1">T</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-12 w-16"
                      onClick={() => adjustOvertime50Hours(-1)}
                      disabled={overtime50Hours <= 0 || isLocked}
                    >
                      <ChevronDown className="h-6 w-6" />
                    </Button>
                  </div>

                  {/* 50% Minutes */}
                  <div className="flex flex-col items-center space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-12 w-16"
                      onClick={() => adjustOvertime50Minutes(15)}
                      disabled={overtime50Minutes >= 45 || isLocked}
                    >
                      <ChevronUp className="h-6 w-6" />
                    </Button>
                    <div className="text-3xl font-bold w-16 text-center">
                      {overtime50Minutes.toString().padStart(2, '0')}
                      <div className="text-xs text-muted-foreground font-normal mt-1">M</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-12 w-16"
                      onClick={() => adjustOvertime50Minutes(-15)}
                      disabled={overtime50Minutes <= 0 || isLocked}
                    >
                      <ChevronDown className="h-6 w-6" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {showOvertime && (
            <div className="text-center text-sm text-muted-foreground">
              Overtid: {formatTimeValue(totalOvertimeTimer)} timer
              {totalOvertimeTimer > 0 && <span className="ml-2 text-yellow-600 font-bold">⚡</span>}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notat">Notat</Label>
          <Textarea
            id="notat"
            value={notat}
            onChange={(e) => setNotat(e.target.value)}
            placeholder="Valgfritt notat..."
            rows={3}
            disabled={isLocked}
          />
        </div>

        <div className="flex gap-2 justify-between">
          {!isLocked && (
            <div className="flex gap-2">
              <Button
                onClick={() => handleSave('utkast')}
                disabled={isLoading}
                variant="outline"
              >
                {isLoading && status === 'utkast' ? 'Lagrer...' : 'Lagre utkast'}
              </Button>
              <Button
                onClick={() => handleSave('sendt')}
                disabled={isLoading}
              >
                {isLoading && status === 'sendt' ? 'Sender...' : 'Send til godkjenning'}
              </Button>
            </div>
          )}
          {existingEntry && (
            <div className="flex gap-1">
              <Button variant="outline" size="icon">
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeEntry;
