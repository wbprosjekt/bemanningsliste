'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Calendar } from 'lucide-react';
import { getDateFromWeek, formatTimeValue } from '@/lib/displayNames';
import { toLocalDateString } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TimeEntry from '@/components/TimeEntry';

interface WeekEntry {
  id: string;
  date: string;
  dayIndex: number;
  hours: number;
  projectNumber: number;
  projectId: string;
  projectColor: string;
  vaktId: string;
  vaktTimerId: string;
  hasOvertime?: boolean;
}

export default function UkeoversiktPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [person, setPerson] = useState<any>(null);
  const [weekEntries, setWeekEntries] = useState<WeekEntry[]>([]);
  const [weekTotal, setWeekTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<{ vaktId: string; date: string } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = parseInt(params.year as string);
  const week = parseInt(params.week as string);

  const navigateWeek = (delta: number) => {
    const newWeek = week + delta;
    
    // Handle year boundary
    if (newWeek < 1) {
      router.push(`/min/uke/${year - 1}/52/oversikt`);
    } else if (newWeek > 52) {
      router.push(`/min/uke/${year + 1}/1/oversikt`);
    } else {
      router.push(`/min/uke/${year}/${newWeek}/oversikt`);
    }
  };

  const getWeekDays = useCallback(() => {
    const startDate = getDateFromWeek(year, week);
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    
    return days;
  }, [year, week]);

  // Load profile and person
  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profileData) return;
      setProfile(profileData);

      const { data: personData } = await supabase
        .from('person')
        .select('*')
        .eq('epost', user.email || '')
        .eq('org_id', profileData.org_id)
        .single();

      if (personData) {
        setPerson(personData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Load week data
  useEffect(() => {
    if (person && profile) {
      loadWeekData();
    }
  }, [person, profile, year, week]);

  const loadWeekData = async () => {
    if (!person || !profile) return;

    setLoading(true);
    try {
      const weekDays = getWeekDays();
      const startDate = toLocalDateString(weekDays[0]);
      const endDate = toLocalDateString(weekDays[6]);

      // Fetch project colors
      const { data: colorData } = await supabase
        .from('project_color')
        .select('tripletex_project_id, hex')
        .eq('org_id', profile.org_id);

      const colorMap = new Map<number, string>();
      (colorData || []).forEach((color: any) => {
        colorMap.set(color.tripletex_project_id, color.hex);
      });

      // Fetch vakt data for the week (including empty vakt entries)
      const { data: vaktData, error } = await supabase
        .from('vakt')
        .select(`
          id,
          dato,
          project_id,
          vakt_timer (
            id,
            timer,
            status,
            is_overtime,
            lonnstype
          ),
          project:ttx_project_cache!vakt_project_id_fkey (
            project_number,
            tripletex_project_id
          )
        `)
        .eq('person_id', person.id)
        .eq('org_id', profile.org_id)
        .gte('dato', startDate)
        .lte('dato', endDate);

      if (error) throw error;

      // Process entries - GROUP by vakt (combine all timer types)
      const entries: WeekEntry[] = [];
      let total = 0;

      (vaktData || []).forEach(vakt => {
        const dayIndex = weekDays.findIndex(d => toLocalDateString(d) === vakt.dato);
        const project = vakt.project as any;
        const projectColor = project?.tripletex_project_id 
          ? colorMap.get(project.tripletex_project_id) 
          : undefined;

        // Sum ALL approved timer entries for this vakt (normal + overtime)
        const approvedTimers = (vakt.vakt_timer || []).filter((timer: any) => timer.status === 'godkjent');
        const totalHours = approvedTimers.reduce((sum: number, timer: any) => sum + (timer.timer || 0), 0);
        const hasOvertime = approvedTimers.some((timer: any) => timer.is_overtime);

        total += totalHours;

        // Create ONE entry per vakt (regardless of how many timer entries)
        entries.push({
          id: vakt.id,
          date: vakt.dato,
          dayIndex,
          hours: totalHours,
          projectNumber: project?.project_number || 0,
          projectId: vakt.project_id || '',
          projectColor: projectColor || '#9333ea',
          vaktId: vakt.id,
          vaktTimerId: '', // Not used for grouped view
          hasOvertime
        } as any);
      });

      setWeekEntries(entries);
      setWeekTotal(total);
    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBubbleClick = (entry: WeekEntry) => {
    setSelectedEntry({ vaktId: entry.vaktId, date: entry.date });
  };

  const handleAddClick = (date: string) => {
    setSelectedDay(date);
    // Will open dialog for adding new entry
  };

  const handleCloseDialog = () => {
    setSelectedEntry(null);
    setSelectedDay(null);
    loadWeekData(); // Refresh data
  };

  if (!user || !profile || !person) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Laster...</div>
      </div>
    );
  }

  const weekDays = getWeekDays();
  const today = toLocalDateString(new Date());
  const dayNames = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

  // Calculate total hours per day
  const dayTotals = weekDays.map(day => {
    const dayString = toLocalDateString(day);
    return weekEntries
      .filter(e => e.date === dayString)
      .reduce((sum, e) => sum + e.hours, 0);
  });

  // Get max rows needed (longest day column)
  const maxRows = Math.max(...weekDays.map((_, dayIndex) => 
    weekEntries.filter(e => e.dayIndex === dayIndex).length
  ), 1);

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Fixed */}
      <div className="sticky top-0 bg-white border-b shadow-sm z-30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Top row - Close and title */}
          <div className="flex items-center gap-4 mb-3">
            <button
              onClick={() => router.push(`/min/uke/${year}/${week}`)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Lukk</span>
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-lg font-semibold">Ukeoversikt</h1>
            </div>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>

          {/* Week Navigation - Large buttons */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className="h-14 w-16 flex items-center justify-center border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-colors bg-white"
            >
              <span className="text-2xl text-gray-700">&lt;</span>
            </button>
            <div className="flex-1 text-center">
              <div className="text-lg font-semibold">
                Uke {week}: {formatTimeValue(weekTotal)}t
              </div>
              <div className="text-xs text-muted-foreground">
                {year}
              </div>
            </div>
            <button
              onClick={() => navigateWeek(1)}
              className="h-14 w-16 flex items-center justify-center border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-colors bg-white"
            >
              <span className="text-2xl text-gray-700">&gt;</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Header - Fixed */}
      <div className="sticky top-[130px] bg-white border-b z-20">
        <div className="max-w-7xl mx-auto px-2 py-3">
          {/* Month and Week */}
          <div className="flex items-center gap-2 mb-2 px-2">
            <span className="text-sm text-muted-foreground">
              {weekDays[0].toLocaleDateString('nb-NO', { month: 'short' })}.
            </span>
            <span className="text-sm text-muted-foreground">Uke {week}</span>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map((name, i) => (
              <div key={i} className="text-center text-xs font-medium text-gray-600">
                {name}
              </div>
            ))}
          </div>

          {/* Day Numbers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDays.map((day, i) => {
              const isToday = toLocalDateString(day) === today;
              return (
                <div
                  key={i}
                  className={`text-center text-sm font-bold py-1 rounded ${
                    isToday ? 'bg-blue-50 border-2 border-blue-600 text-blue-900' : 'text-gray-900'
                  }`}
                >
                  {day.getDate()}
                </div>
              );
            })}
          </div>

          {/* Day Totals */}
          <div className="grid grid-cols-7 gap-1">
            {dayTotals.map((total, i) => (
              <div
                key={i}
                className={`text-center text-xs font-medium ${
                  toLocalDateString(weekDays[i]) === today ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                {total > 0 ? `${formatTimeValue(total)}t` : '0'}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bubble Grid - Scrollable */}
      <div className="max-w-7xl mx-auto px-2 py-4">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day, dayIndex) => {
            const dayString = toLocalDateString(day);
            const dayEntries = weekEntries.filter(e => e.dayIndex === dayIndex);

            return (
              <div key={dayIndex} className="space-y-2">
                {dayEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleBubbleClick(entry)}
                    className={`w-full rounded-lg p-2 text-center transition-all hover:opacity-90 min-h-[60px] ${
                      entry.hours === 0
                        ? 'bg-white border-2 hover:border-opacity-100'
                        : 'text-white'
                    }`}
                    style={entry.hours === 0 
                      ? { borderColor: entry.projectColor, color: entry.projectColor }
                      : { backgroundColor: entry.projectColor }
                    }
                  >
                    <div className="text-base sm:text-lg font-bold">
                      {formatTimeValue(entry.hours)}t
                      {entry.hasOvertime && entry.hours > 0 && (
                        <span className="ml-1">⚡</span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm opacity-90">P: {entry.projectNumber}</div>
                  </button>
                ))}

                {/* Add button */}
                <button
                  onClick={() => handleAddClick(dayString)}
                  className="w-full rounded-lg p-2 border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                >
                  <div className="text-xl">+</div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      {selectedEntry && (
        <Dialog open={true} onOpenChange={handleCloseDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Rediger timer</DialogTitle>
            </DialogHeader>
            <TimeEntry
              vaktId={selectedEntry.vaktId}
              orgId={profile.org_id}
              onSave={handleCloseDialog}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add New Entry Dialog - TODO: Implement similar to edit */}
      {selectedDay && (
        <Dialog open={true} onOpenChange={handleCloseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Legg til timer for {selectedDay}</DialogTitle>
            </DialogHeader>
            <div className="p-4 text-center text-muted-foreground">
              Funksjonalitet for å legge til timer kommer snart
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

