'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getWeekDates } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface DayViewProps {
  year: number;
  week: number;
  personId: string;
  orgId: string;
  onAddEntry: (date: string) => void;
}

interface DayEntry {
  id: string;
  date: string;
  project: string;
  projectNumber?: number;
  activity: string;
  hours: number;
  color: string;
}

export default function DayView({ year, week, personId, orgId, onAddEntry }: DayViewProps) {
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    // Set initial date to first day of week (Monday)
    const dates = getWeekDates(year, week);
    setSelectedDate(dates[0]);
  }, [year, week]);

  useEffect(() => {
    if (selectedDate) {
      loadDayEntries();
    }
  }, [selectedDate, personId, orgId]);

  const loadDayEntries = async () => {
    setLoading(true);
    try {
      // Fetch project colors
      const { data: colorData } = await supabase
        .from('project_color')
        .select('tripletex_project_id, hex')
        .eq('org_id', orgId);
      
      const colorMap = new Map<number, string>();
      (colorData || []).forEach((color: any) => {
        colorMap.set(color.tripletex_project_id, color.hex);
      });

      // Fetch vakt entries for the selected date
      const { data: vaktData, error } = await supabase
        .from('vakt')
        .select(`
          id,
          dato,
          vakt_timer (
            id,
            timer,
            status,
            aktivitet_id
          ),
          project:ttx_project_cache!vakt_project_id_fkey (
            project_name,
            project_number,
            tripletex_project_id
          )
        `)
        .eq('person_id', personId)
        .eq('org_id', orgId)
        .eq('dato', selectedDate);

      if (error) throw error;

      // Get activity IDs
      const activityIds = new Set<string>();
      (vaktData || []).forEach(vakt => {
        (vakt.vakt_timer || []).forEach((timer: any) => {
          if (timer.aktivitet_id) {
            activityIds.add(timer.aktivitet_id);
          }
        });
      });

      // Fetch activity names
      const activityMap = new Map<string, string>();
      if (activityIds.size > 0) {
        const { data: activities } = await supabase
          .from('ttx_activity_cache')
          .select('id, navn')
          .in('id', Array.from(activityIds));
        
        (activities || []).forEach((activity: any) => {
          activityMap.set(activity.id, activity.navn);
        });
      }

      // Process entries
      const processedEntries = (vaktData || []).flatMap(vakt => {
        const project = vakt.project as any;
        const projectColor = project?.tripletex_project_id 
          ? colorMap.get(project.tripletex_project_id) 
          : undefined;
        
        // Format project display name
        const projectNumber = project?.project_number;
        const projectName = project?.project_name || (projectNumber ? `Prosjekt ${projectNumber}` : 'Ukjent');
        
        let projectDisplayName: string;
        if (projectName.startsWith(`${projectNumber} `)) {
          projectDisplayName = projectName;
        } else {
          projectDisplayName = projectNumber ? `${projectNumber} ${projectName}` : projectName;
        }
        
        return (vakt.vakt_timer || [])
          .filter((timer: any) => timer.status === 'godkjent')
          .map((timer: any) => ({
            id: timer.id,
            date: vakt.dato,
            project: projectDisplayName,
            projectNumber: projectNumber,
            activity: activityMap.get(timer.aktivitet_id) || 'Ukjent aktivitet',
            hours: timer.timer || 0,
            color: projectColor || '#9333ea'
          }));
      });

      setEntries(processedEntries);
    } catch (error) {
      console.error('Error loading day entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const dates = getWeekDates(year, week);
  const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

  return (
    <div className="space-y-4">
      {/* Date Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Dag: {totalHours}t
        </h2>
      </div>

      {/* Day tabs */}
      <div className="grid grid-cols-7 gap-2">
        {dates.map((date, index) => {
          const dateObj = new Date(date);
          const isSelected = date === selectedDate;
          
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`
                flex flex-col items-center p-3 rounded-lg border-2 transition-all
                ${isSelected 
                  ? 'border-blue-600 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
                }
              `}
            >
              <span className="text-xs text-gray-500">{dayNames[index]}</span>
              <span className={`text-lg font-semibold ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                {dateObj.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Entries List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Laster...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Ingen registreringer for denne dagen
          </div>
        ) : (
          entries.map((entry) => (
            <button
              key={entry.id}
              className="w-full p-4 rounded-xl text-left flex items-center gap-4 hover:opacity-90 transition-all"
              style={{ backgroundColor: entry.color }}
            >
              {/* Hours badge */}
              <div className="bg-white bg-opacity-30 rounded-full w-12 h-12 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{entry.hours}</span>
              </div>
              
              {/* Project and Activity info */}
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold truncate">
                  {entry.project}
                </div>
                <div className="text-white text-sm opacity-90 truncate">
                  {entry.activity}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Add Entry Button */}
      <button
        onClick={() => onAddEntry(selectedDate)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}

