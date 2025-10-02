'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getWeekDates } from '@/lib/utils';
import DayCard from './DayCard';

interface WeekCalendarProps {
  year: number;
  week: number;
  personId: string;
  orgId: string;
  onDayClick: (date: string) => void;
}

interface DayData {
  date: string;
  dayName: string;
  dayNumber: number;
  totalHours: number;
  entries: Array<{
    id: string;
    hours: number;
    project: string;
    projectNumber?: number;
    activity: string;
    status: string;
    color: string;
  }>;
}

const DAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
const DAY_NAMES = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

export default function WeekCalendar({ year, week, personId, orgId, onDayClick }: WeekCalendarProps) {
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate] = useState(new Date());

  useEffect(() => {
    loadWeekData();
  }, [year, week, personId, orgId]);

  const loadWeekData = async () => {
    setLoading(true);
    const dates = getWeekDates(year, week);
    
    try {
      // Fetch project colors first
      const { data: colorData } = await supabase
        .from('project_color')
        .select('tripletex_project_id, hex')
        .eq('org_id', orgId);
      
      const colorMap = new Map<number, string>();
      (colorData || []).forEach((color: any) => {
        colorMap.set(color.tripletex_project_id, color.hex);
      });

      // Fetch all vakt entries for the week
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
        .gte('dato', dates[0])
        .lte('dato', dates[6]);

      if (error) throw error;

      // Get all unique activity IDs
      const activityIds = new Set<string>();
      (vaktData || []).forEach(vakt => {
        (vakt.vakt_timer || []).forEach((timer: any) => {
          if (timer.aktivitet_id) {
            activityIds.add(timer.aktivitet_id);
          }
        });
      });

      // Fetch activity names in a separate query
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

      // Process data for each day
      const processedData = dates.map((date, index) => {
        const dayEntries = (vaktData || []).filter(v => v.dato === date);
        
        const entries = dayEntries.flatMap(vakt => {
          const project = vakt.project as any;
          const projectColor = project?.tripletex_project_id 
            ? colorMap.get(project.tripletex_project_id) 
            : undefined;
          
          // Format project display name (same logic as DayCard.tsx lines 412-424)
          const projectNumber = project?.project_number;
          const projectName = project?.project_name || (projectNumber ? `Prosjekt ${projectNumber}` : 'Ukjent');
          
          let projectDisplayName: string;
          if (projectName.startsWith(`${projectNumber} `)) {
            // Project name already includes the number
            projectDisplayName = projectName;
          } else {
            // Add project number to the name
            projectDisplayName = projectNumber ? `${projectNumber} ${projectName}` : projectName;
          }
          
          return (vakt.vakt_timer || [])
            .filter((timer: any) => timer.status === 'godkjent')
            .map((timer: any) => ({
              id: timer.id,
              hours: timer.timer || 0,
              project: projectDisplayName,
              projectNumber: projectNumber,
              activity: activityMap.get(timer.aktivitet_id) || 'Ukjent aktivitet',
              status: timer.status || 'utkast',
              color: projectColor || '#9333ea' // Default purple
            }));
        });

        const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
        const dateObj = new Date(date);

        return {
          date,
          dayName: DAY_NAMES[index],
          dayNumber: dateObj.getDate(),
          totalHours,
          entries
        };
      });

      setWeekData(processedData);
    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isToday = (date: string) => {
    const today = currentDate.toISOString().split('T')[0];
    return date === today;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-400">Laster...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Week Header with Days */}
      <div className="grid grid-cols-7 gap-2 text-center">
        {weekData.map((day, index) => (
          <div key={day.date} className="space-y-2">
            {/* Day Letter */}
            <div className="text-sm font-medium text-gray-500">
              {DAYS[index]}
            </div>
            
            {/* Day Number with Highlight */}
            <button
              onClick={() => onDayClick(day.date)}
              className={`
                w-12 h-12 mx-auto rounded-full flex items-center justify-center font-semibold text-lg
                ${isToday(day.date) 
                  ? 'bg-blue-600 text-white' 
                  : day.totalHours > 0 
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-400'
                }
              `}
            >
              {day.dayNumber}
            </button>

            {/* Hour Indicators (dots) */}
            <div className="flex justify-center items-center gap-0.5 h-4">
              {day.totalHours > 0 && (
                <>
                  {day.totalHours >= 7.5 && (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                    </>
                  )}
                  {day.totalHours >= 2.5 && day.totalHours < 7.5 && (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                    </>
                  )}
                  {day.totalHours > 0 && day.totalHours < 2.5 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
                  )}
                </>
              )}
            </div>

            {/* Total Hours Text */}
            {day.totalHours > 0 && (
              <div className="text-xs text-gray-600 font-medium">
                {day.totalHours}t
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Month/Week Label */}
      <div className="text-left">
        <div className="text-sm text-gray-500">
          {weekData[0] && new Date(weekData[0].date).toLocaleDateString('nb-NO', { month: 'short' })}.
        </div>
        <div className="text-2xl font-bold text-gray-900">
          Uke {week}
        </div>
      </div>

      {/* Day Cards in Columns */}
      <div className="grid grid-cols-7 gap-2">
        {weekData.map((day) => (
          <DayCard
            key={day.date}
            date={day.date}
            entries={day.entries}
            onCardClick={() => onDayClick(day.date)}
          />
        ))}
      </div>
    </div>
  );
}

