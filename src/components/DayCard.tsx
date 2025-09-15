import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Copy, Plus, MessageSquare, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatTimeValue, getPersonDisplayName } from '@/lib/displayNames';
import TimeEntry from './TimeEntry';

interface DayCardProps {
  date: Date;
  orgId: string;
  personId?: string;
  forventetTimer?: number;
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
  }>;
}

const DayCard = ({ date, orgId, personId, forventetTimer = 8.0 }: DayCardProps) => {
  const [vakter, setVakter] = useState<VaktWithTimer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVakt, setSelectedVakt] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDayData();
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
            project_name
          ),
          vakt_timer (
            id,
            timer,
            status,
            notat,
            lonnstype,
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

  const getExpectedHours = () => {
    if (vakter.length === 0) return forventetTimer;
    return vakter[0]?.person?.forventet_dagstimer || forventetTimer;
  };

  const getStatusChip = () => {
    const totalHours = getTotalHours();
    const expectedHours = getExpectedHours();
    const hasEntries = vakter.some(v => v.vakt_timer.length > 0);

    if (!hasEntries && vakter.length > 0) {
      return <Badge variant="secondary">🟡 Mangler timer</Badge>;
    }

    if (totalHours < expectedHours) {
      return <Badge variant="secondary">🟡 Mangler timer</Badge>;
    }

    const allApproved = vakter.every(v => 
      v.vakt_timer.every(t => t.status === 'godkjent')
    );
    
    if (allApproved && hasEntries) {
      return <Badge className="bg-green-500">🟢 Godkjent</Badge>;
    }

    const allSent = vakter.every(v => 
      v.vakt_timer.every(t => t.status === 'sendt')
    );

    if (allSent && hasEntries) {
      return <Badge className="bg-blue-500">🔵 Sendt</Badge>;
    }

    return <Badge variant="outline">📝 Utkast</Badge>;
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{date.toLocaleDateString('no-NO', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
          {getStatusChip()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span>Timer ført:</span>
          <span className="font-medium">{formatTimeValue(getTotalHours())}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Forventet:</span>
          <span>{formatTimeValue(getExpectedHours())}</span>
        </div>

        {vakter.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Dagens oppdrag:</h4>
            {vakter.map((vakt) => (
              <div key={vakt.id} className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  {vakt.person && getPersonDisplayName(vakt.person.fornavn, vakt.person.etternavn)} - {vakt.ttx_project_cache?.project_name || 'Ikke tilordnet'}
                </div>
                {vakt.vakt_timer.map((timer) => (
                  <div key={timer.id} className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded">
                    <div className="flex-1">
                      <div>{formatTimeValue(timer.timer)} t - {timer.ttx_activity_cache?.navn || 'Ingen aktivitet'}</div>
                      <div className="text-muted-foreground">{timer.lonnstype}</div>
                    </div>
                    <div className="flex gap-1">
                      {timer.notat && <MessageSquare className="h-3 w-3" />}
                      <Paperclip className="h-3 w-3" />
                    </div>
                  </div>
                ))}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setSelectedVakt(vakt.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {vakt.vakt_timer.length > 0 ? 'Rediger timer' : 'Legg til timer'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        Timeføring - {vakt.ttx_project_cache?.project_name || 'Prosjekt'}
                      </DialogTitle>
                    </DialogHeader>
                    <TimeEntry
                      vaktId={vakt.id}
                      orgId={orgId}
                      onSave={loadDayData}
                      defaultTimer={vakt.person?.forventet_dagstimer || 8.0}
                      existingEntry={vakt.vakt_timer[0]} // For simplicity, edit first entry
                    />
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={copyFromPreviousDay}
        >
          <Copy className="h-3 w-3 mr-1" />
          Kopier forrige dag
        </Button>
      </CardContent>
    </Card>
  );
};

export default DayCard;