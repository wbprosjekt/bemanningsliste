import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Plus, MessageSquare, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatTimeValue, getPersonDisplayName } from '@/lib/displayNames';
import TimeEntry from './TimeEntry';
import ProjectSearchDialog from './ProjectSearchDialog';
import ProjectDetailDialog from './ProjectDetailDialog';

interface DayCardProps {
  date: Date;
  orgId: string;
  personId?: string;
  forventetTimer?: number;
  calendarDays?: Array<{
    dato: string;
    is_holiday: boolean;
    is_weekend: boolean;
    holiday_name: string | null;
  }>;
}

interface VaktWithTimer {
  id: string;
  project_id: string | null;
  person: {
    fornavn: string;
    etternavn: string;
    forventet_dagstimer: number;
  };
  ttx_project_cache: {
    project_name: string;
    project_number: number;
    tripletex_project_id: number;
  } | null;
  vakt_timer: Array<{
    id: string;
    timer: number;
    status: string;
    aktivitet_id?: string | null;
    ttx_activity_cache: {
      navn: string;
    } | null;
    notat: string | null;
    lonnstype: string;
    is_overtime: boolean | null;
  }>;
}

interface ProjectColor {
  tripletex_project_id: number;
  hex: string;
}

const DayCard = ({ date, orgId, personId, forventetTimer = 8.0, calendarDays }: DayCardProps) => {
  const [vakter, setVakter] = useState<VaktWithTimer[]>([]);
  const [projectColors, setProjectColors] = useState<ProjectColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVaktId, setActiveVaktId] = useState<string | null>(null);
  const [selectedTimer, setSelectedTimer] = useState<VaktWithTimer['vakt_timer'][number] | null>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const { toast } = useToast();


  const loadDayData = useCallback(async () => {
    if (!personId) {
      setVakter([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const query = supabase
        .from('vakt')
        .select(`
          id,
          project_id,
          person:person_id (
            fornavn, 
            etternavn, 
            forventet_dagstimer
          ),
          ttx_project_cache:project_id (
            project_name,
            project_number,
            tripletex_project_id
          ),
          vakt_timer (
            id,
            timer,
            status,
            notat,
            lonnstype,
            is_overtime,
            aktivitet_id,
            ttx_activity_cache:aktivitet_id (
              navn
            )
          )
        `)
        .eq('org_id', orgId)
        .eq('dato', date.toISOString().split('T')[0])
        .eq('person_id', personId);

      const { data, error } = await query;

      if (error) throw error;
      setVakter(data || []);
    } catch (error) {
      console.error('Error loading day data:', error);
      toast({
        title: "Kunne ikke laste data",
        description: "Det oppstod en feil ved lasting av dagens data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [date, orgId, personId, toast]);

  const loadProjectColors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('project_color')
        .select('tripletex_project_id, hex')
        .eq('org_id', orgId);

      if (error) throw error;
      setProjectColors(data || []);
    } catch (error) {
      console.error('Error loading project colors:', error);
    }
  }, [orgId]);

  useEffect(() => {
    loadDayData();
    loadProjectColors();
  }, [loadDayData, loadProjectColors]);

  const getProjectColor = (tripletexProjectId?: number) => {
    if (!tripletexProjectId) return '#6b7280'; // default gray
    const colorConfig = projectColors.find(c => c.tripletex_project_id === tripletexProjectId);
    if (colorConfig) return colorConfig.hex;
    
    // Generate a consistent color based on project ID if no color is configured
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
    ];
    return colors[tripletexProjectId % colors.length];
  };

  const copyFromPreviousDay = async () => {
    if (!personId) {
      toast({
        title: "Kan ikke kopiere",
        description: "Fant ikke ansatt-ID for denne visningen.",
        variant: "destructive"
      });
      return;
    }

    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);

    const previousDateStr = previousDay.toISOString().split('T')[0];
    const todayDateStr = date.toISOString().split('T')[0];

    try {
      const { data: prevEntries, error } = await supabase
        .from('vakt_timer')
        .select(`
          timer,
          aktivitet_id,
          lonnstype,
          notat,
          is_overtime,
          vakt:vakt_id (
            person_id,
            project_id,
            id
          )
        `)
        .eq('vakt.dato', previousDateStr)
        .eq('vakt.org_id', orgId)
        .eq('vakt.person_id', personId);

      if (error) throw error;

      if (!prevEntries || prevEntries.length === 0) {
        toast({
          title: "Ingen data å kopiere",
          description: "Fant ingen timeføringer å kopiere fra forrige dag."
        });
        return;
      }

      const entriesByProject = new Map<string, Array<(typeof prevEntries)[number]>>();
      prevEntries.forEach(entry => {
        const projectId = entry.vakt?.project_id;
        if (!projectId) return;
        const existing = entriesByProject.get(projectId) ?? [];
        existing.push(entry);
        entriesByProject.set(projectId, existing);
      });

      let insertedCount = 0;

      for (const [projectId, entries] of entriesByProject) {
        const matchingVakt = vakter.find(v => v.project_id === projectId);
        let targetVaktId = matchingVakt?.id;

        if (!targetVaktId) {
          const { data: newVakt, error: createError } = await supabase
            .from('vakt')
            .insert({
              person_id: personId,
              project_id: projectId,
              dato: todayDateStr,
              org_id: orgId
            })
            .select('id')
            .single();

          if (createError) throw createError;
          targetVaktId = newVakt?.id;
        }

        if (!targetVaktId) {
          continue;
        }

        for (const entry of entries) {
          const alreadyExists = matchingVakt?.vakt_timer?.some(timer => {
            return (
              timer.aktivitet_id === entry.aktivitet_id &&
              Number(timer.timer) === Number(entry.timer)
            );
          });

          if (alreadyExists) {
            continue;
          }

          const { error: insertError } = await supabase
            .from('vakt_timer')
            .insert({
              vakt_id: targetVaktId,
              org_id: orgId,
              timer: entry.timer,
              aktivitet_id: entry.aktivitet_id,
              lonnstype: entry.lonnstype,
              notat: entry.notat,
              status: 'utkast',
              is_overtime: entry.is_overtime ?? false
            });

          if (insertError) throw insertError;
          insertedCount += 1;
        }
      }

      if (insertedCount > 0) {
        toast({
          title: "Kopiert fra forrige dag",
          description: `${insertedCount} timeføring${insertedCount === 1 ? '' : 'er'} kopiert.`
        });
      } else {
        toast({
          title: "Ingen nye timeføringer",
          description: "Timeføringer fra forrige dag finnes allerede i dag."
        });
      }

      loadDayData();
    } catch (error: unknown) {
      toast({
        title: "Kopiering feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
    }
  };

  const getTotalHours = () => {
    return vakter.reduce((total, vakt) => {
      return total + vakt.vakt_timer.reduce((vaktTotal, timer) => vaktTotal + timer.timer, 0);
    }, 0);
  };

  const getOvertimeHours = () => {
    return vakter.reduce((total, vakt) => {
      return total + vakt.vakt_timer.reduce((vaktTotal, timer) => {
        return vaktTotal + (timer.is_overtime ? timer.timer : 0);
      }, 0);
    }, 0);
  };

  const getExpectedHours = () => {
    if (vakter.length === 0) return forventetTimer;
    
    // Check against kalender_dag table for holidays
    const dateStr = date.toISOString().split('T')[0];
    const calendarDay = calendarDays?.find(d => d.dato === dateStr);
    
    if (calendarDay?.is_holiday || calendarDay?.is_weekend) {
      // TODO: Get from admin settings - default_expected_hours_on_holidays
      return 0;
    }
    
    return vakter[0]?.person?.forventet_dagstimer || forventetTimer;
  };

  const getStatusChip = () => {
    const totalHours = getTotalHours();
    const expectedHours = getExpectedHours();
    const hasEntries = vakter.some(v => v.vakt_timer.length > 0);

    // Don't show "Mangler timer" for holidays/weekends with 0 expected hours
    if (expectedHours === 0) {
      if (!hasEntries) {
        return <Badge variant="outline" className="text-xs px-1.5 py-0.5">🌙 Hellig/helg</Badge>;
      }
    }

    if (!hasEntries && vakter.length > 0 && expectedHours > 0) {
      return <Badge variant="secondary" className="text-xs px-1.5 py-0.5">🟡 Mangler</Badge>;
    }

    if (totalHours < expectedHours) {
      return <Badge variant="secondary" className="text-xs px-1.5 py-0.5">🟡 Mangler</Badge>;
    }

    const allApproved = vakter.every(v => 
      v.vakt_timer.every(t => t.status === 'godkjent')
    );
    
    if (allApproved && hasEntries) {
      return <Badge className="bg-green-500 text-xs px-1.5 py-0.5">🟢 OK</Badge>;
    }

    const allSent = vakter.every(v => 
      v.vakt_timer.every(t => t.status === 'sendt')
    );

    if (allSent && hasEntries) {
      return <Badge className="bg-blue-500 text-xs px-1.5 py-0.5">🔵 Sendt</Badge>;
    }

    return <Badge variant="outline" className="text-xs px-1.5 py-0.5">📝 Utkast</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">Laster...</div>
        </CardContent>
      </Card>
    );
  }

  if (!personId) {
    return (
      <Card className="h-full">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">Ingen ansatt valgt</p>
            <p className="text-xs mt-1">Velg en ansatt for å se dagdata</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="text-xs sm:text-sm font-medium">
            {date.toLocaleDateString('no-NO', { weekday: 'short', day: '2-digit', month: '2-digit' })}
          </span>
          {getStatusChip()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Timer ført:</span>
            <span className="font-medium">
              {formatTimeValue(getTotalHours())}
              {getOvertimeHours() > 0 && (
                <span className="ml-1 text-yellow-600 font-bold" title={`${formatTimeValue(getOvertimeHours())} overtid`}>⚡</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Forventet:</span>
            <span className="font-medium">{formatTimeValue(getExpectedHours())}</span>
          </div>
        </div>

        {vakter.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs sm:text-sm font-medium">Dagens oppdrag:</h4>
            {vakter.map((vakt) => (
              <div key={vakt.id} className="space-y-1">
                <div className="text-xs flex items-center gap-1 sm:gap-2">
                  <span className="text-muted-foreground text-xs truncate">
                    {vakt.person && getPersonDisplayName(vakt.person.fornavn, vakt.person.etternavn)}
                  </span>
                </div>
                {vakt.ttx_project_cache ? (
                  <Button
                    variant="ghost"
                    className="w-full h-auto p-2 sm:p-3 justify-start text-left"
                    style={{ backgroundColor: getProjectColor(vakt.ttx_project_cache.tripletex_project_id) }}
                    onClick={() => setSelectedProject(vakt.ttx_project_cache)}
                  >
                    <div className="text-white w-full">
                      <div className="font-bold text-sm sm:text-lg">
                        {vakt.ttx_project_cache.project_number}
                      </div>
                      <div className="text-xs sm:text-sm opacity-90 truncate">
                        {vakt.ttx_project_cache.project_name}
                      </div>
                    </div>
                  </Button>
                ) : (
                <div className="text-muted-foreground p-2 sm:p-3 text-center border border-dashed rounded text-xs">
                    Ikke tilordnet
                  </div>
                )}
                <div className="space-y-1">
                  {vakt.vakt_timer.map((timer) => (
                    <button
                      key={timer.id}
                      type="button"
                      className="flex w-full items-center justify-between text-left text-xs bg-muted/50 p-1.5 sm:p-2 rounded hover:bg-muted"
                      onClick={() => {
                        setActiveVaktId(vakt.id);
                        setSelectedTimer(timer);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{formatTimeValue(timer.timer)} t - {timer.ttx_activity_cache?.navn || 'Ingen aktivitet'}</div>
                        <div className="text-muted-foreground text-xs">{timer.lonnstype}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {timer.notat && <MessageSquare className="h-3 w-3" />}
                        <Paperclip className="h-3 w-3" />
                      </div>
                    </button>
                  ))}
                </div>
                <Dialog
                  open={activeVaktId === vakt.id}
                  onOpenChange={(open) => {
                    if (!open) {
                      setActiveVaktId(null);
                      setSelectedTimer(null);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs sm:text-sm"
                      onClick={() => {
                        setActiveVaktId(vakt.id);
                        setSelectedTimer(null);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {vakt.vakt_timer.length > 0 ? 'Legg til / rediger' : 'Legg til timer'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="max-w-2xl h-[95vh] flex flex-col p-0"
                    style={{
                      maxHeight: '95vh !important',
                      height: '95vh !important',
                      display: 'flex !important',
                      flexDirection: 'column !important',
                      padding: '0 !important'
                    }}
                  >
                    <div
                      className="flex-1 overflow-y-auto p-6"
                      style={{ flex: '1 !important', overflowY: 'auto !important', padding: '1.5rem !important' }}
                    >
                      <DialogHeader className="pb-4">
                        <DialogTitle className="text-base sm:text-lg">
                          Timeføring - {vakt.ttx_project_cache?.project_name || 'Prosjekt'}
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                          Legg til eller rediger timer for denne arbeidsoppgaven.
                        </DialogDescription>
                      </DialogHeader>
                      <TimeEntry
                        key={selectedTimer?.id ?? 'new'}
                        vaktId={vakt.id}
                        orgId={orgId}
                        onSave={loadDayData}
                        defaultTimer={vakt.person?.forventet_dagstimer || 8.0}
                        existingEntry={selectedTimer || undefined}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
        )}

        {vakter.length === 0 && personId && (
          <div className="space-y-2">
            <div className="text-xs sm:text-sm text-muted-foreground text-center py-2 sm:py-4">
              Ingen arbeidsoppdrag planlagt
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setShowProjectDialog(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Finn prosjekt
            </Button>
            <ProjectSearchDialog
              open={showProjectDialog}
              onClose={() => setShowProjectDialog(false)}
              date={date.toISOString().split('T')[0]}
              orgId={orgId}
              personId={personId}
              onProjectAssigned={loadDayData}
            />
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs sm:text-sm"
          onClick={copyFromPreviousDay}
        >
          <Copy className="h-3 w-3 mr-1" />
          Kopier forrige dag
        </Button>

        {/* Project Detail Dialog */}
        {selectedProject && (
          <ProjectDetailDialog
            open={!!selectedProject}
            onClose={() => setSelectedProject(null)}
            project={selectedProject}
            orgId={orgId}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default DayCard;
