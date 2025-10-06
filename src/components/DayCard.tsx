import { useState, useEffect, useCallback, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Plus, MessageSquare, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatTimeValue, getPersonDisplayName, generateProjectColor } from '@/lib/displayNames';
import { toLocalDateString } from '@/lib/utils';
import { useDeepMemo, usePerformanceMonitor } from '@/lib/reactOptimizations';
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
    forventet_dagstimer: number | null;
  };
  ttx_project_cache: {
    project_name: string | null;
    project_number: number | null;
    tripletex_project_id: number | null;
  } | null;
  vakt_timer: Array<{
    id: string;
    timer: number;
    status: string | null;
    aktivitet_id?: string | null;
    tripletex_synced_at?: string | null;
    tripletex_entry_id?: number | null;
    ttx_activity_cache: {
      navn: string;
    } | null;
    notat: string | null;
    lonnstype: string | null;
    is_overtime: boolean | null;
  }>;
}

interface ProjectColor {
  tripletex_project_id: number;
  hex: string;
}

const DayCard = ({ date, orgId, personId, forventetTimer = 8.0, calendarDays }: DayCardProps) => {
  const [vakter, setVakter] = useState<VaktWithTimer[]>([]);
  const [projectColors, setProjectColors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeVaktId, setActiveVaktId] = useState<string | null>(null);
  const [selectedTimer, setSelectedTimer] = useState<VaktWithTimer['vakt_timer'][number] | null>(null);
  const [selectedProject, setSelectedProject] = useState<{
    project_name: string | null;
    project_number: number | null;
    tripletex_project_id: number | null;
  } | null>(null);
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
            tripletex_synced_at,
            tripletex_entry_id,
            ttx_activity_cache!aktivitet_id (
              navn
            )
          )
        `)
        .eq('org_id', orgId)
        .eq('dato', toLocalDateString(date))
        .eq('person_id', personId);

      const { data, error } = await query;

      if (error) throw error;
      setVakter(data || []);
    } catch (error) {
      console.error('Error loading day data:', error);
      // Toast will be handled by the component that calls this function
    } finally {
      setLoading(false);
    }
  }, [date, orgId, personId]);

  const loadProjectColors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('project_color')
        .select('tripletex_project_id, hex')
        .eq('org_id', orgId);

      if (error) throw error;
      
      const colorMap: Record<number, string> = {};
      data?.forEach((color: ProjectColor) => {
        colorMap[color.tripletex_project_id] = color.hex;
      });
      
      setProjectColors(colorMap);
    } catch (error) {
      console.error('Error loading project colors:', error);
    }
  }, [orgId]);

  useEffect(() => {
    loadDayData();
    loadProjectColors();
  }, [loadDayData, loadProjectColors]);

  const getProjectColor = (tripletexProjectId?: number) => {
    if (!tripletexProjectId) return '#94a3b8';
    return projectColors[tripletexProjectId] || generateProjectColor(tripletexProjectId);
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

      const previousDateStr = toLocalDateString(previousDay);
      const todayDateStr = toLocalDateString(date);

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
    const dateStr = toLocalDateString(date);
      const calendarDay = calendarDays?.find(d => d.dato === dateStr);
    
    if (calendarDay?.is_holiday || calendarDay?.is_weekend) {
      // TODO: Get from admin settings - default_expected_hours_on_holidays
      return 0;
    }
    
    return vakter[0]?.person?.forventet_dagstimer || forventetTimer;
  };

  const getStatusChip = () => {
    // Don't show status chips - employees can see actual hours per day
    return null;
  };

  const isToday = () => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
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
    <Card 
      className={`h-full ${isToday() ? 'ring-2 ring-primary bg-blue-50/50' : ''}`}
      id={`day-${date.toISOString().split('T')[0]}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="text-base font-medium capitalize">
            {date.toLocaleDateString('no-NO', { weekday: 'long', day: '2-digit', month: '2-digit' }).replace(/\.$/, '')}
            {isToday() && (
              <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                I dag
              </span>
            )}
          </span>
          {getStatusChip()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="text-center text-xs">
          <div className="flex justify-center items-center gap-2">
            <span className="text-muted-foreground">Timer ført:</span>
            <span className="font-medium text-lg">
              {formatTimeValue(getTotalHours())}
              {getOvertimeHours() > 0 && (
                <span className="ml-1 text-yellow-600 font-bold" title={`${formatTimeValue(getOvertimeHours())} overtid`}>⚡</span>
              )}
            </span>
          </div>
        </div>

        {vakter.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium">Dagens oppdrag:</h4>
            {vakter.map((vakt) => (
              <div key={vakt.id} className="space-y-1">
                <div className="text-xs flex items-center gap-1">
                  <span className="text-muted-foreground text-xs truncate">
                    {vakt.person && getPersonDisplayName(vakt.person.fornavn, vakt.person.etternavn)}
                  </span>
                </div>
                {vakt.ttx_project_cache ? (
                  <Button
                    variant="ghost"
                    className="w-full h-auto p-3 justify-start text-left relative"
                    style={{ backgroundColor: getProjectColor(vakt.ttx_project_cache.tripletex_project_id || 0) }}
                    onClick={() => setSelectedProject(vakt.ttx_project_cache)}
                  >
                    <div className="text-white w-full pr-6">
                      {/* Main project info - smart project number handling with truncation and tooltip */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="font-semibold text-base leading-tight truncate cursor-help">
                              {(() => {
                                const projectNumber = vakt.ttx_project_cache.project_number;
                                const projectName = vakt.ttx_project_cache.project_name || `Prosjekt ${projectNumber}`;
                                
                                // Check if project name already starts with the project number
                                if (projectName.startsWith(`${projectNumber} `)) {
                                  // Project name already includes the number, just show the name
                                  return projectName;
                                } else {
                                  // Project name doesn't include the number, add it
                                  return `${projectNumber} ${projectName}`;
                                }
                              })()}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              {(() => {
                                const projectNumber = vakt.ttx_project_cache.project_number;
                                const projectName = vakt.ttx_project_cache.project_name || `Prosjekt ${projectNumber}`;
                                
                                // Check if project name already starts with the project number
                                if (projectName.startsWith(`${projectNumber} `)) {
                                  return projectName;
                                } else {
                                  return `${projectNumber} ${projectName}`;
                                }
                              })()}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {/* Compact time summary with status */}
                      <div className="text-sm text-white opacity-95 mt-0.5 flex items-center justify-between">
                        <span className="font-semibold">
                          {(() => {
                            // Smart time formatting function
                            const formatTimeSmart = (hours: number): string => {
                              if (hours === 0) return '0t';
                              
                              // Check if it's a whole number
                              if (hours % 1 === 0) {
                                return `${hours}t`;
                              }
                              
                              // Check if it's .5 (half hour)
                              if (hours % 1 === 0.5) {
                                return `${Math.floor(hours)},5t`;
                              }
                              
                              // For other decimals, show 2 decimal places but remove trailing zeros
                              return `${hours.toFixed(2).replace(/\.?0+$/, '')}t`;
                            };

                            const regularHours = vakt.vakt_timer
                              .filter(timer => !timer.is_overtime)
                              .reduce((sum, timer) => sum + (timer.timer || 0), 0);
                            const overtime100 = vakt.vakt_timer
                              .filter(timer => timer.is_overtime && (timer.lonnstype === 'overtid_100' || timer.lonnstype === '100%'))
                              .reduce((sum, timer) => sum + (timer.timer || 0), 0);
                            const overtime50 = vakt.vakt_timer
                              .filter(timer => timer.is_overtime && (timer.lonnstype === 'overtid_50' || timer.lonnstype === '50%'))
                              .reduce((sum, timer) => sum + (timer.timer || 0), 0);

                            // Build compact format with parentheses for overtime
                            if (overtime100 === 0 && overtime50 === 0) {
                              // Only regular hours
                              return <span className="font-bold">{formatTimeSmart(regularHours)}</span>;
                            } else {
                              // Regular hours + overtime in parentheses
                              const overtimeParts = [];
                              if (overtime100 > 0) {
                                overtimeParts.push(`${formatTimeSmart(overtime100)} 100%`);
                              }
                              if (overtime50 > 0) {
                                overtimeParts.push(`${formatTimeSmart(overtime50)} 50%`);
                              }
                              return <span><span className="font-bold">{formatTimeSmart(regularHours)}</span> ({overtimeParts.join(', ')})</span>;
                            }
                          })()}
                        </span>
                        {/* Status indicator */}
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          vakt.vakt_timer.length > 0 && vakt.vakt_timer.every(timer => 
                            timer.status === 'godkjent' || timer.tripletex_synced_at
                          ) ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'
                        }`}>
                          {vakt.vakt_timer.length > 0 && vakt.vakt_timer.every(timer => 
                            timer.status === 'godkjent' || timer.tripletex_synced_at
                          ) ? '✅' : '🔄'}
                        </span>
                      </div>
                    </div>
                  </Button>
                ) : (
                <div className="text-muted-foreground p-2 sm:p-3 text-center border border-dashed rounded text-xs">
                    Ikke tilordnet
                  </div>
                )}
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
                      className="w-full text-xs"
                      onClick={() => {
                        setActiveVaktId(vakt.id);
                        setSelectedTimer(null);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {vakt.vakt_timer.length > 0 ? 'Legg til / Rediger timer' : 'Legg til timer'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="max-w-2xl h-[95vh] flex flex-col p-0"
                    style={{
                      maxHeight: '95vh !important',
                      height: '95vh !important',
                      display: 'flex !important',
                      flexDirection: 'column' as const,
                      padding: '0 !important'
                    }}
                  >
                    <div
                      className="flex-1 overflow-y-auto p-6"
                      style={{ flex: 1, overflowY: 'auto' as const, padding: '1.5rem' }}
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
                        onSave={() => {
                          loadDayData();
                          setActiveVaktId(null);
                          setSelectedTimer(null);
                        }}
                        onClose={() => {
                          setActiveVaktId(null);
                          setSelectedTimer(null);
                        }}
                        defaultTimer={vakt.person?.forventet_dagstimer || 8.0}
                        existingEntry={selectedTimer ? {
                          id: selectedTimer.id,
                          timer: selectedTimer.timer,
                          aktivitet_id: selectedTimer.aktivitet_id || '',
                          notat: selectedTimer.notat || '',
                          status: selectedTimer.status || 'pending',
                          tripletex_synced_at: selectedTimer.tripletex_synced_at
                        } : undefined}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
        )}

        {personId && (
          <div className="space-y-2">
            {vakter.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">
                Ingen arbeidsoppdrag planlagt
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-xs"
              onClick={() => setShowProjectDialog(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              {vakter.length === 0 ? 'Finn prosjekt' : 'Legg til prosjekt'}
            </Button>
            <ProjectSearchDialog
              open={showProjectDialog}
              onClose={() => setShowProjectDialog(false)}
              date={toLocalDateString(date)}
              orgId={orgId}
              personId={personId}
              onProjectAssigned={loadDayData}
            />
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full text-[10px]"
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

