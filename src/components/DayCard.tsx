import { useState, useEffect } from 'react';
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
import ProjectRequestDialog from './ProjectRequestDialog';
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
  const [selectedVakt, setSelectedVakt] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<{
    project_name: string;
    project_number: number;
    tripletex_project_id: number;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDayData();
    loadProjectColors();
  }, [date, orgId, personId]);

  const loadDayData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('vakt')
        .select(`
          id,
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
            ttx_activity_cache:aktivitet_id (
              navn
            )
          )
        `)
        .eq('org_id', orgId)
        .eq('dato', date.toISOString().split('T')[0]);

      if (personId) {
        query = query.eq('person_id', personId);
      }

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
  };

  const loadProjectColors = async () => {
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
  };

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
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);

    try {
      // Find previous day's entries for the same person and projects
      const { data: prevEntries, error } = await supabase
        .from('vakt_timer')
        .select(`
          timer,
          aktivitet_id,
          lonnstype,
          vakt:vakt_id (
            person_id,
            project_id
          )
        `)
        .eq('vakt.dato', previousDay.toISOString().split('T')[0])
        .eq('vakt.org_id', orgId);

      if (error) throw error;

      if (prevEntries && prevEntries.length > 0) {
        // Copy entries to today's corresponding vakter
        for (const entry of prevEntries) {
          // Find matching vakt for today
          const matchingVakt = vakter.find(v => 
            v.person && entry.vakt &&
            // We would need to check person_id and project_id but the query structure makes this complex
            // For now, copy to the first available vakt
            v.vakt_timer.length === 0
          );

          if (matchingVakt) {
            await supabase
              .from('vakt_timer')
              .insert({
                vakt_id: matchingVakt.id,
                org_id: orgId,
                timer: entry.timer,
                aktivitet_id: entry.aktivitet_id,
                lonnstype: entry.lonnstype,
                status: 'utkast'
              });
          }
        }

        toast({
          title: "Kopiert fra forrige dag",
          description: "Timer og aktiviteter er kopiert fra forrige dag."
        });

        loadDayData();
      } else {
        toast({
          title: "Ingen data å kopiere",
          description: "Fant ingen timeføringer å kopiere fra forrige dag."
        });
      }
    } catch (error: any) {
      toast({
        title: "Kopiering feilet",
        description: error.message,
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
                    <div key={timer.id} className="flex items-center justify-between text-xs bg-muted/50 p-1.5 sm:p-2 rounded">
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{formatTimeValue(timer.timer)} t - {timer.ttx_activity_cache?.navn || 'Ingen aktivitet'}</div>
                        <div className="text-muted-foreground text-xs">{timer.lonnstype}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {timer.notat && <MessageSquare className="h-3 w-3" />}
                        <Paperclip className="h-3 w-3" />
                      </div>
                    </div>
                  ))}
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs sm:text-sm"
                      onClick={() => setSelectedVakt(vakt.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {vakt.vakt_timer.length > 0 ? 'Rediger timer' : 'Legg til timer'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[95vh]">
                    <ScrollArea className="h-[85vh]">
                      <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">
                          Timeføring - {vakt.ttx_project_cache?.project_name || 'Prosjekt'}
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                          Legg til eller rediger timer for denne arbeidsoppgaven.
                        </DialogDescription>
                      </DialogHeader>
                      <TimeEntry
                        vaktId={vakt.id}
                        orgId={orgId}
                        onSave={loadDayData}
                        defaultTimer={vakt.person?.forventet_dagstimer || 8.0}
                        existingEntry={vakt.vakt_timer[0]} // For simplicity, edit first entry
                      />
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
        )}

        {vakter.length === 0 && (
          <div className="space-y-2">
            <div className="text-xs sm:text-sm text-muted-foreground text-center py-2 sm:py-4">
              Ingen arbeidsoppdrag planlagt
            </div>
            <ProjectRequestDialog
              date={date}
              orgId={orgId}
              personId={personId || ''}
              onRequestSent={loadDayData}
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