import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Users, 
  Plus,
  Download,
  Settings
} from 'lucide-react';
import { 
  getDateFromWeek, 
  getWeekNumber, 
  getPersonDisplayName, 
  generateProjectColor,
  getContrastColor 
} from '@/lib/displayNames';

interface CalendarDay {
  dato: string;
  iso_uke: number;
  iso_ar: number;
  is_weekend: boolean;
  is_holiday: boolean;
  holiday_name: string | null;
}

interface WeekEntry {
  id: string;
  person: {
    fornavn: string;
    etternavn: string;
  };
  ttx_project_cache: {
    project_name: string;
    tripletex_project_id: number;
  } | null;
  vakt_timer: Array<{
    timer: number;
    status: string;
    ttx_activity_cache: {
      navn: string;
    } | null;
  }>;
}

const Uke = () => {
  const { year, week } = useParams<{ year: string; week: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<any>(null);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [weekEntries, setWeekEntries] = useState<WeekEntry[]>([]);
  const [projectColors, setProjectColors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [fillWeekSettings, setFillWeekSettings] = useState({
    includeHolidays: false
  });

  const currentYear = parseInt(year || new Date().getFullYear().toString());
  const currentWeek = parseInt(week || getWeekNumber(new Date()).toString());

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user, loadUserProfile]);

  useEffect(() => {
    if (profile) {
      loadWeekData();
    }
  }, [profile, currentYear, currentWeek, loadWeekData]);

  const loadUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, org:org_id (id, name)')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [user]);

  const loadWeekData = useCallback(async () => {
    if (!profile?.org_id) return;

    setLoading(true);
    try {
      // Load calendar days for the week
      const startDate = getDateFromWeek(currentYear, currentWeek);
      const weekDates = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        weekDates.push(date.toISOString().split('T')[0]);
      }

      // Ensure calendar data exists
      await supabase.functions.invoke('calendar-sync', {
        body: { monthsAhead: 3 }
      });

      const { data: calendarData } = await supabase
        .from('kalender_dag')
        .select('*')
        .in('dato', weekDates)
        .order('dato');

      setCalendarDays(calendarData || []);

      // Load week entries 
      const { data: entriesData } = await supabase
        .from('vakt')
        .select(`
          id,
          person:person_id (
            fornavn,
            etternavn
          ),
          ttx_project_cache:project_id (
            project_name,
            tripletex_project_id
          ),
          vakt_timer (
            timer,
            status,
            ttx_activity_cache:aktivitet_id (
              navn
            )
          )
        `)
        .eq('org_id', profile.org_id)
        .in('dato', weekDates);

      setWeekEntries(entriesData || []);

      // Load project colors
      const { data: colorData } = await supabase
        .from('project_color')
        .select('tripletex_project_id, hex')
        .eq('org_id', profile.org_id);

      const colorMap: Record<number, string> = {};
      colorData?.forEach(color => {
        colorMap[color.tripletex_project_id] = color.hex;
      });
      setProjectColors(colorMap);

    } catch (error) {
      console.error('Error loading week data:', error);
      toast({
        title: "Feil ved lasting",
        description: "Kunne ikke laste ukedata",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id, currentYear, currentWeek, toast]);

  const navigateWeek = (delta: number) => {
    let newYear = currentYear;
    let newWeek = currentWeek + delta;

    // Handle year transitions properly for ISO weeks
    if (newWeek > 52) {
      // Check if year actually has 53 weeks
      const lastWeekOfYear = getWeekNumber(new Date(currentYear, 11, 31));
      if (newWeek > lastWeekOfYear) {
        newYear++;
        newWeek = 1;
      }
    } else if (newWeek < 1) {
      newYear--;
      newWeek = 52; // This might be 53 for some years
    }

    navigate(`/uke/${newYear}/${newWeek.toString().padStart(2, '0')}`);
  };

  const getProjectColor = (projectId?: number) => {
    if (!projectId) return generateProjectColor(0);
    return projectColors[projectId] || generateProjectColor(projectId);
  };

  const getDayHeaderClass = (day: CalendarDay) => {
    let className = "text-center p-2 font-medium ";
    
    if (day.is_weekend) {
      className += "bg-muted/50 ";
    }
    
    if (day.is_holiday) {
      className += "bg-red-50 border-l-4 border-red-500 ";
    }
    
    return className;
  };

  const exportWeekCSV = async () => {
    try {
      const csvData = weekEntries.map(entry => ({
        Ansatt: entry.person ? getPersonDisplayName(entry.person.fornavn, entry.person.etternavn) : 'Ukjent',
        Prosjekt: entry.ttx_project_cache?.project_name || 'Ikke tilordnet',
        ProsjektNr: entry.ttx_project_cache?.tripletex_project_id || '',
        Timer: entry.vakt_timer.reduce((sum, t) => sum + t.timer, 0),
        Status: entry.vakt_timer.map(t => t.status).join(', '),
        Aktiviteter: entry.vakt_timer.map(t => t.ttx_activity_cache?.navn || 'Ingen').join(', '),
        Farge: getProjectColor(entry.ttx_project_cache?.tripletex_project_id)
      }));

      const csvContent = [
        Object.keys(csvData[0] || {}).join(';'),
        ...csvData.map(row => Object.values(row).join(';'))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `uke-${currentWeek}-${currentYear}.csv`;
      link.click();

      toast({
        title: "Eksport fullført",
        description: "CSV-fil er lastet ned"
      });
    } catch (error) {
      toast({
        title: "Eksport feilet",
        description: "Kunne ikke eksportere data",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">Laster ukedata...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Ukeplan</h1>
            <p className="text-muted-foreground mt-1">
              {profile?.org?.name} - Uke {currentWeek}, {currentYear}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={exportWeekCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Fyll uke
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Fyll uke med timer</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="include-holidays"
                      checked={fillWeekSettings.includeHolidays}
                      onCheckedChange={(checked) => 
                        setFillWeekSettings(prev => ({ ...prev, includeHolidays: checked }))
                      }
                    />
                    <label htmlFor="include-holidays" className="text-sm">
                      Inkluder helligdager (default AV)
                    </label>
                  </div>
                  <Button className="w-full" disabled>
                    Fyll valgte dager (ikke implementert)
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
            Forrige uke
          </Button>
          <div className="text-lg font-medium">
            Uke {currentWeek}, {currentYear}
          </div>
          <Button variant="outline" onClick={() => navigateWeek(1)}>
            Neste uke
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar Header */}
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b">
              {calendarDays.map((day) => {
                const date = new Date(day.dato);
                return (
                  <div key={day.dato} className={getDayHeaderClass(day)}>
                    <div className="text-sm">
                      {date.toLocaleDateString('no-NO', { weekday: 'short' })}
                    </div>
                    <div className="text-lg font-semibold">
                      {date.getDate()}
                    </div>
                    {day.is_holiday && (
                      <Badge variant="destructive" className="text-xs mt-1">
                        {day.holiday_name}
                      </Badge>
                    )}
                    {day.is_weekend && !day.is_holiday && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        Helg
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Week Entries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Timeoppføringer ({weekEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weekEntries.map((entry) => {
                const projectColor = getProjectColor(entry.ttx_project_cache?.tripletex_project_id);
                const textColor = getContrastColor(projectColor);
                const totalHours = entry.vakt_timer.reduce((sum, t) => sum + t.timer, 0);
                
                return (
                  <div
                    key={entry.id}
                    className="p-4 rounded-lg border"
                    style={{ 
                      backgroundColor: `${projectColor}20`,
                      borderColor: projectColor 
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {entry.person ? 
                            getPersonDisplayName(entry.person.fornavn, entry.person.etternavn) :
                            'Ukjent person'
                          }
                        </div>
                        <div 
                          className="text-sm px-2 py-1 rounded inline-block mt-1"
                          style={{ 
                            backgroundColor: projectColor, 
                            color: textColor 
                          }}
                        >
                          {entry.ttx_project_cache?.project_name || 'Ikke tilordnet'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {totalHours.toFixed(2)} t
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {entry.vakt_timer.length} oppføringer
                        </div>
                      </div>
                    </div>
                    
                    {entry.vakt_timer.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {entry.vakt_timer.map((timer, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{timer.ttx_activity_cache?.navn || 'Ingen aktivitet'}</span>
                            <span>{timer.timer.toFixed(2)} t ({timer.status})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {weekEntries.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen timeoppføringer funnet for denne uken
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Week Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {weekEntries.reduce((sum, e) => 
                      sum + e.vakt_timer.reduce((s, t) => s + t.timer, 0), 0
                    ).toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total timer
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {new Set(weekEntries.map(e => e.person?.fornavn + e.person?.etternavn)).size}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Aktive ansatte
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {weekEntries.filter(e => 
                      e.vakt_timer.some(t => t.status === 'godkjent')
                    ).length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Godkjente
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Uke;