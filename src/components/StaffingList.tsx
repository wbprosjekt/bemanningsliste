import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useEmployees, useProjects, useUserProfile, useProjectColors, useStaffingData } from '@/hooks/useStaffingData';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Check, Send, Palette, X, RefreshCw, Trash2, HelpCircle } from 'lucide-react';
import { getPersonDisplayName, generateProjectColor, getContrastColor, formatTimeValue, getWeekNumber } from '@/lib/displayNames';
import ProjectSearchDialog from './ProjectSearchDialog';
import ColorPickerDialog from './ColorPickerDialog';
import TimeEntry from './TimeEntry';
import { startOfISOWeek, addWeeks, addDays, isValid as isValidDate } from 'date-fns';
import { toLocalDateString, toLocalDateTimeString } from '@/lib/utils';
import { 
  loadStaffingDataCached, 
  loadEmployeesCached, 
  loadFreeLinesOptimized, 
  loadCalendarDaysOptimized,
  batchUpdateTimeEntries,
  QueryCache
} from '@/lib/databaseOptimized';

interface StaffingEntry {
  id: string;
  date: string;
  person: {
    id: string;
    fornavn: string;
    etternavn: string;
    forventet_dagstimer: number | null;
    tripletex_employee_id?: number | null;
  };
  project: {
    id: string; // This is the UUID from ttx_project_cache.id
    tripletex_project_id: number;
    project_name: string;
    project_number: number;
    color?: string;
  } | null;
  activities: Array<{
    id: string;
    timer: number;
    status: string;
    activity_name: string;
    lonnstype: string;
    notat?: string;
    is_overtime?: boolean;
    approved_at?: string;
    approved_by?: string;
    tripletex_synced_at?: string;
    tripletex_entry_id?: number;
    sync_error?: string;
    aktivitet_id?: string; // UUID reference in our DB
    ttx_activity_id?: number; // Tripletex activity id
  }>;
  totalHours: number;
  status: 'missing' | 'draft' | 'ready' | 'approved' | 'sent';
}

interface WeekData {
  week: number;
  year: number;
  dates: Date[];
}

interface Profile {
  id: string;
  user_id: string;
  org_id: string;
  org?: {
    name: string;
  };
}

interface Project {
  id: string;
  tripletex_project_id: number;
  project_name: string;
  project_number: number;
  color?: string;
}

interface Employee {
  id: string;
  fornavn: string;
  etternavn: string;
  forventet_dagstimer: number | null;
  tripletex_employee_id?: number | null;
}

interface StaffingListProps {
  startWeek: number;
  startYear: number;
  weeksToShow?: number;
}

interface TimeEntry {
  id: string;
  timer: number;
  aktivitet_id?: string;
  notat?: string;
  status: string;
}

interface VaktTimer {
  id: string;
  timer: number;
  status: string;
  lonnstype: string;
  notat?: string;
  is_overtime?: boolean;
  approved_at?: string;
  approved_by?: string;
  tripletex_synced_at?: string;
  tripletex_entry_id?: number;
  sync_error?: string;
  aktivitet_id?: string;
  ttx_activity_id?: number;
}

interface CalendarDay {
  dato: string;
  is_weekend: boolean;
  is_holiday: boolean;
}

// Separate component to prevent re-rendering of entire StaffingList on input change
const EditLineNameForm = ({ initialName, onSave, onCancel }: {
  initialName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(initialName);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Navn</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Skriv linje-navn her..."
          autoFocus
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
        <Button onClick={() => onSave(name)}>
          Lagre
        </Button>
      </div>
    </div>
  );
};

const StaffingList = ({ startWeek, startYear, weeksToShow = 6 }: StaffingListProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // React Query hooks for data fetching
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id);
  const { data: employees = [], isLoading: employeesLoading } = useEmployees(profile?.org_id || '');
  const { data: projects = [], isLoading: projectsLoading } = useProjects(profile?.org_id || '');
  const { data: projectColors = {}, isLoading: projectColorsLoading } = useProjectColors(profile?.org_id || '');
  
  // Keep local state for UI-only data
  const [profileState, setProfileState] = useState<Profile | null>(null);
  const [staffingData, setStaffingData] = useState<StaffingEntry[]>([]);
  const [freeLines, setFreeLines] = useState<Array<{
    id: string;
    org_id: string;
    week_number: number;
    year: number;
    name?: string | null;
    display_order: number;
    frie_bobler?: Array<{
      id: string;
      date: string;
      text: string;
      color: string;
      display_order: number;
    }>;
  }>>([]);
  // MIGRATED TO REACT QUERY: const [employees, setEmployees] = useState<Employee[]>([]);
  // MIGRATED TO REACT QUERY: const [projectColors, setProjectColors] = useState<Record<number, string>>({});
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [showProjectSearch, setShowProjectSearch] = useState<{date: string, personId: string} | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<{
    projectName: string;
    projectNumber: number;
    tripletexProjectId: number;
    currentColor: string;
  } | null>(null);
  const [calendarDays, setCalendarDays] = useState<Record<string, { isWeekend: boolean; isHoliday: boolean }>>({});
  const [sendingToTripletex, setSendingToTripletex] = useState<Set<string>>(new Set());
  const [loadingOverlay, setLoadingOverlay] = useState<{
    isVisible: boolean;
    message: string;
    count?: number;
  }>({
    isVisible: false,
    message: '',
  });
  const [editDialog, setEditDialog] = useState<{ vaktId: string; existingEntry?: TimeEntry } | null>(null);
  const [freeBubbleEditDialog, setFreeBubbleEditDialog] = useState<{
    bubbleId: string;
    text: string;
    color: string;
    lineId: string;
  } | null>(null);
  const [deleteLineDialog, setDeleteLineDialog] = useState<{
    lineId: string;
    lineNumber: number;
  } | null>(null);

  const [editLineNameDialog, setEditLineNameDialog] = useState<{
    lineId: string;
    currentName: string;
  } | null>(null);
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);

  const toDateKey = useCallback((d: Date): string => {
    try {
      if (!isValidDate(d)) return '';
      return toLocalDateString(d);
    } catch (error) {
      console.error('Error formatting date:', error, d);
      return '';
    }
  }, []);
  
  // Helper to safely access week/year with fallbacks
  const coerceWeekRef = (item?: { week?: number; year?: number } | null): { week: number; year: number } => {
    if (item?.week && item?.year) {
      return { week: item.week, year: item.year };
    }
    // Fallback to current date's week/year
    const now = new Date();
    return {
      week: getWeekNumber(now),
      year: now.getFullYear()
    };
  };

  // Coerce incoming props to safe week/year
  const { week: safeStartWeek, year: safeStartYear } = coerceWeekRef({ week: startWeek, year: startYear });

  // Get multiple weeks of data with robust date handling
  const getMultipleWeeksData = useCallback((): WeekData[] => {
    const weeks: WeekData[] = [];
    let currentWeek = Math.max(1, Math.min(53, safeStartWeek)); // Clamp week to valid range
    let currentYear = Math.max(1970, Math.min(3000, safeStartYear)); // Clamp year to reasonable range
    
    for (let i = 0; i < weeksToShow; i++) {
      try {
        // ISO Week 1 Monday via date-fns
        const jan4 = new Date(currentYear, 0, 4);
        const week1Monday = startOfISOWeek(jan4);
        if (!isValidDate(week1Monday)) {
          console.error(`Invalid week1Monday for year ${currentYear}`);
          break;
        }

        const targetMonday = addWeeks(week1Monday, currentWeek - 1);
        if (!isValidDate(targetMonday)) {
          console.error(`Invalid targetMonday for week ${currentWeek}, year ${currentYear}`);
          break;
        }

        // Generate 7 days
        const dates: Date[] = [];
        for (let j = 0; j < 7; j++) {
          const date = addDays(targetMonday, j);
          if (isValidDate(date)) dates.push(date);
        }

        if (dates.length === 7) {
          weeks.push({ week: currentWeek, year: currentYear, dates });
        }

        // Next week with 53-week check
        currentWeek++;
        if (currentWeek > 53) {
          currentYear++;
          currentWeek = 1;
        } else if (currentWeek > 52) {
          const dec31 = new Date(currentYear, 11, 31);
          const lastWeek = getWeekNumber(dec31);
          if (currentWeek > lastWeek) {
            currentYear++;
            currentWeek = 1;
          }
        }
      } catch (error) {
        console.error(`Error generating week data for week ${currentWeek}, year ${currentYear}:`, error);
        break;
      }
    }
    
    return weeks;
  }, [safeStartWeek, safeStartYear, weeksToShow]);

  // Memoize multiWeekData to prevent infinite loops
  const multiWeekData = useMemo(() => getMultipleWeeksData(), [getMultipleWeeksData]);
  
  // Memoize allDates to prevent infinite loops
  const allDates = useMemo(() => {
    return multiWeekData.flatMap(w => w.dates).filter(d => d instanceof Date && !isNaN(d.getTime()));
  }, [multiWeekData]);

  // Calculate date range for staffing data (after allDates is defined)
  const dateRange = useMemo(() => {
    const dateStrings = allDates.map(toDateKey).filter(Boolean);
    if (dateStrings.length === 0) return null;
    return {
      start: dateStrings[0],
      end: dateStrings[dateStrings.length - 1]
    };
  }, [allDates, toDateKey]);
  
  const { data: rawStaffingData, isLoading: staffingDataLoading } = useStaffingData(
    profile?.org_id || '',
    dateRange || { start: '', end: '' }
  );

  // Convert rawStaffingData to StaffingEntry format and generate entries for all employees/dates
  useEffect(() => {
    if (!rawStaffingData || !employees || employees.length === 0 || allDates.length === 0) {
      return;
    }

    // Create a map of existing vakt data
    const vaktMap = new Map<string, unknown[]>();
    rawStaffingData.forEach((entry) => {
      const key = `${entry.date}-${entry.person.id}`;
      if (!vaktMap.has(key)) {
        vaktMap.set(key, []);
      }
      vaktMap.get(key)!.push(entry);
    });

    // Generate staffing entries for all employees and dates
    const entries: StaffingEntry[] = [];
    
    employees.forEach((employee) => {
      allDates.forEach((date) => {
        const dateKey = toDateKey(date);
        if (!dateKey) return;
        
        const vaktKey = `${dateKey}-${employee.id}`;
        const existingVakts = vaktMap.get(vaktKey) || [];
        
        if (existingVakts.length === 0) {
          // No existing vakt - create empty entry
          entries.push({
            id: `empty-${employee.id}-${dateKey}`,
            date: dateKey,
            person: {
              id: employee.id,
              fornavn: employee.fornavn,
              etternavn: employee.etternavn,
              forventet_dagstimer: employee.forventet_dagstimer,
              tripletex_employee_id: employee.tripletex_employee_id,
            },
            project: null,
            activities: [],
            totalHours: 0,
            status: 'missing'
          });
        } else {
          // Convert existing vakts to StaffingEntry format
          existingVakts.forEach((vakt) => {
            const vaktData = vakt as { 
              id: string; 
              date: string; 
              person: { 
                id: string; 
                fornavn: string; 
                etternavn: string; 
                forventet_dagstimer: number | null; 
                tripletex_employee_id?: number | null; 
              }; 
              project: { 
                id: string; 
                tripletex_project_id: number; 
                project_name: string; 
                project_number: number; 
              }; 
              activities?: unknown[] 
            };
            const activities = (vaktData.activities || []).map((activity: unknown) => {
              const act = activity as {
                id: string;
                timer: number;
                status: string;
                activity_name: string;
                lonnstype: string;
                notat?: string;
                is_overtime?: boolean;
                approved_at?: string;
                approved_by?: string;
                tripletex_synced_at?: string;
                tripletex_entry_id?: number;
                sync_error?: string;
                ttx_activity_id?: number;
              };
              return act;
            });
            
            // Calculate total hours from activities
            const totalHours = activities.reduce((sum: number, activity) => {
              return sum + (activity.timer || 0);
            }, 0);
            
            // Calculate status based on activities
            let status: 'missing' | 'draft' | 'ready' | 'approved' | 'sent' = 'missing';
            if (activities.length > 0) {
              if (activities.every((a) => a.status === 'godkjent' || a.tripletex_synced_at)) {
                status = 'approved';
              } else if (activities.some((a) => a.tripletex_synced_at)) {
                status = 'sent';
              } else if (activities.some((a) => a.status === 'sendt')) {
                status = 'ready';
              } else {
                status = 'draft';
              }
            }
            
            entries.push({
              id: vaktData.id,
              date: vaktData.date,
              person: vaktData.person,
              project: vaktData.project ? {
                id: vaktData.project.id,
                tripletex_project_id: vaktData.project.tripletex_project_id,
                project_name: vaktData.project.project_name || `Prosjekt ${vaktData.project.project_number}`,
                project_number: vaktData.project.project_number,
                color: projectColors[vaktData.project.tripletex_project_id] || '#6366f1'
              } : null,
              activities,
              totalHours,
              status
            });
          });
        }
      });
    });

    setStaffingData(entries);
  }, [rawStaffingData, employees, allDates, toDateKey, projectColors]);

  // Safe access to last week data with fallback
  const lastWeekData = multiWeekData.length > 0 ? multiWeekData[multiWeekData.length - 1] : null;
  const safeLastWeek = coerceWeekRef(lastWeekData);

  // MIGRATED TO REACT QUERY: loadUserProfile function removed
  // Now using: useUserProfile(user?.id) hook

  // MIGRATED TO REACT QUERY: loadStaffingData function removed
  // Now using: useStaffingData() hook + useEffect for data transformation

  const loadFreeLines = useCallback(async () => {
    if (!profile?.org_id) return;

    try {
      // Load free lines for all weeks being displayed
      const weekNumbers = multiWeekData.map(w => w.week);
      const years = multiWeekData.map(w => w.year);

      const { data, error } = await supabase
        .from('frie_linjer')
        .select(`
          *,
          frie_bobler (
            id,
            date,
            text,
            color,
            display_order
          )
        `)
        .eq('org_id', profile.org_id)
        .in('week_number', weekNumbers)
        .in('year', years)
        .order('display_order');

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFreeLines((data as any) || []);
    } catch (error) {
      console.error('Error loading free lines:', error);
    }
  }, [profile?.org_id, multiWeekData]);

  // MIGRATED TO REACT QUERY: loadProjectColors function removed
  // Now using: const { data: projectColors = {} } = useProjectColors(profile?.org_id || '');

  const loadCalendarDays = useCallback(async () => {
    if (!profile?.org_id) return;

    try {
      const dateStrings = allDates.map(toDateKey).filter(Boolean);
      if (dateStrings.length === 0) return;

      const { data, error } = await supabase
        .from('kalender_dag')
        .select('*')
        .in('dato', dateStrings);

      if (error) throw error;
      
      const calendarMap: Record<string, { isWeekend: boolean; isHoliday: boolean }> = {};
      data?.forEach((day: CalendarDay) => {
        calendarMap[day.dato] = {
          isWeekend: Boolean(day.is_weekend),
          isHoliday: Boolean(day.is_holiday)
        };
      });
      
      setCalendarDays(calendarMap);
    } catch (error) {
      console.error('Error loading calendar days:', error);
    }
  }, [profile?.org_id, allDates, toDateKey]);

  // MIGRATED TO REACT QUERY: useEmployees() hook now handles this
  // Old loadEmployees function removed - now using:
  // const { data: employees = [] } = useEmployees(profile?.org_id || '');

  // MIGRATED TO REACT QUERY: loadUserProfile useEffect removed
  // Now handled automatically by useUserProfile(user?.id) hook

  useEffect(() => {
    if (profile) {
      loadCalendarDays();
      loadFreeLines();
      // MIGRATED: loadEmployees() - now handled by useEmployees() hook
      // MIGRATED: loadProjectColors() - now handled by useProjectColors() hook
      // MIGRATED: loadStaffingData() - now handled by useStaffingData() hook + useEffect
      setInitialized(true);
    } else {
      setLoading(false);
      if (!initialized) {
        setInitialized(true);
      }
    }
  }, [profile, startWeek, startYear, weeksToShow, loadCalendarDays, loadFreeLines, initialized]);


  // Optimistic update helpers
  const updateStaffingDataOptimistically = (updateFn: (data: StaffingEntry[]) => StaffingEntry[]) => {
    setStaffingData(prev => updateFn(prev));
  };

  const revalidateInBackground = useCallback(() => {
    // Invalidate React Query cache to trigger refetch
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['staffing'] });
    }, 100);
  }, [queryClient]);

  const rollbackUpdate = (previousData: StaffingEntry[], errorMessage: string) => {
    setStaffingData(previousData);
    toast({
      title: "Operasjon feilet",
      description: errorMessage,
      variant: "destructive"
    });
  };

  const getProjectColor = (tripletexProjectId?: number) => {
    if (!tripletexProjectId) return '#94a3b8';
    return projectColors[tripletexProjectId] || generateProjectColor(tripletexProjectId);
  };

  const setProjectColor = async (tripletexProjectId: number, color: string) => {
    try {
      const { error } = await supabase
        .from('project_color')
        .upsert({
          org_id: profile?.org_id || '',
          tripletex_project_id: tripletexProjectId,
          hex: color
        }, {
          onConflict: 'org_id,tripletex_project_id'
        });

      if (error) throw error;
      
      // Invalidate project colors query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['projectColors', profile?.org_id] });
      
      // Count how many instances were updated
      const affectedEntries = staffingData.filter(entry => 
        entry.project?.tripletex_project_id === tripletexProjectId
      );
      
      toast({
        title: "Prosjektfarge oppdatert",
        description: `Fargen er endret på ${affectedEntries.length} forekomster av prosjektet`
      });

      // Revalidate in background
      revalidateInBackground();
    } catch (error) {
      console.error('Error updating project color:', error);
      toast({
        title: "Feil ved oppdatering",
        description: "Kunne ikke oppdatere prosjektfarge",
        variant: "destructive"
      });
    }
  };

  const handleProjectColorClick = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drag from starting
    setShowColorPicker({
      projectName: project.project_name,
      projectNumber: project.project_number,
      tripletexProjectId: project.tripletex_project_id,
      currentColor: getProjectColor(project.tripletex_project_id)
    });
  };

  const deleteEntry = async (entryId: string) => {
    const previousData = [...staffingData];
    
    try {
      const entry = staffingData.find(e => e.id === entryId);
      if (!entry) return;

      // Optimistically remove the entry
      updateStaffingDataOptimistically(data => data.filter(e => e.id !== entryId));

      // Delete all vakt_timer entries associated with this vakt
      const { error: timerError } = await supabase
        .from('vakt_timer')
        .delete()
        .eq('vakt_id', entryId);

      if (timerError) throw timerError;

      // Delete the vakt entry
      const { error: vaktError } = await supabase
        .from('vakt')
        .delete()
        .eq('id', entryId);

      if (vaktError) throw vaktError;

      toast({
        title: "Timeføring slettet",
        description: `Timeføring for ${entry.project?.project_name || 'prosjekt'} er slettet`
      });

      revalidateInBackground();
    } catch (error: unknown) {
      rollbackUpdate(previousData, error instanceof Error ? error.message : 'En ukjent feil oppstod');
    }
  };

  const moveEntryToEmployeeAndDate = async (entryId: string, targetPersonId: string, targetDate: string, shouldCopy: boolean = false) => {
    if (isProcessingUpdate) return;
    
    const previousData = [...staffingData];
    setIsProcessingUpdate(true);
    
    try {
      const sourceEntry = staffingData.find(e => e.id === entryId);
      if (!sourceEntry) return;

      const targetEmployee = employees.find(e => e.id === targetPersonId);

      if (shouldCopy) {
        // For copying, check if target person already has this project on target date
        const existingEntry = staffingData.find(e => 
          e.person.id === targetPersonId && 
          e.date === targetDate && 
          e.project?.id === sourceEntry.project?.id
        );

        if (existingEntry) {
          toast({
            title: "Prosjekt finnes allerede",
            description: `${targetEmployee ? getPersonDisplayName(targetEmployee.fornavn, targetEmployee.etternavn) : 'Ansatt'} har allerede ${sourceEntry.project?.project_name} på ${new Date(targetDate).toLocaleDateString('no-NO')}`,
            variant: "destructive"
          });
          setIsProcessingUpdate(false);
          return;
        }
        
        // Optimistically add copied entry to target
        const copiedEntry: StaffingEntry = {
          ...sourceEntry,
          id: `temp-${Date.now()}`,
          person: targetEmployee || sourceEntry.person,
          date: targetDate,
          activities: sourceEntry.activities.map(a => ({ 
            ...a, 
            id: `temp-${Date.now()}-${Math.random()}` 
          }))
        };
        
        updateStaffingDataOptimistically(data => [...data, copiedEntry]);

        // Create new vakt for target person/date
        const { error: vaktError } = await supabase
          .from('vakt')
          .insert({
            person_id: targetPersonId,
            project_id: sourceEntry.project?.id,
            dato: targetDate,
            org_id: profile?.org_id || ''
          })
          .select()
          .single();

        if (vaktError) throw vaktError;

        // No timer copying - both move and copy create empty project assignments

        toast({
          title: "Prosjekt kopiert",
          description: `${sourceEntry.project?.project_name} kopiert til ${targetEmployee ? getPersonDisplayName(targetEmployee.fornavn, targetEmployee.etternavn) : 'ukjent ansatt'} på ${new Date(targetDate).toLocaleDateString('no-NO')}`
        });

        revalidateInBackground();
        return;
      }

      // For moving, check if target person already has this project on target date
      // (but exclude the source entry itself if it's the same person)
      const existingEntry = staffingData.find(e => 
        e.person.id === targetPersonId && 
        e.date === targetDate && 
        e.project?.id === sourceEntry.project?.id &&
        e.id !== entryId // Exclude the source entry itself
      );

      if (existingEntry) {
        toast({
          title: "Prosjekt finnes allerede",
          description: `${targetEmployee ? getPersonDisplayName(targetEmployee.fornavn, targetEmployee.etternavn) : 'Ansatt'} har allerede ${sourceEntry.project?.project_name} på ${new Date(targetDate).toLocaleDateString('no-NO')}`,
          variant: "destructive"
        });
        setIsProcessingUpdate(false);
        return;
      }

      // Optimistically move the entry
      updateStaffingDataOptimistically(data => {
        return data.map(entry => 
          entry.id === entryId 
            ? { ...entry, person: targetEmployee || entry.person, date: targetDate }
            : entry
        );
      });

      // Create new vakt for target person/date
      const { error: vaktError } = await supabase
        .from('vakt')
        .insert({
          person_id: targetPersonId,
          project_id: sourceEntry.project?.id || null,
          dato: targetDate,
          org_id: profile?.org_id || ''
        })
        .select()
        .single();

      if (vaktError) throw vaktError;

      // No timer copying - both move and copy create empty project assignments

      // If moving (not copying), only remove original if it has no timer entries
      // This prevents losing existing time entries
      if (!shouldCopy && sourceEntry.id.indexOf('empty-') !== 0 && sourceEntry.activities.length === 0) {
        // Only delete original vakt if it has no timer entries
        await supabase
          .from('vakt')
          .delete()
          .eq('id', sourceEntry.id);
      }

      const action = shouldCopy ? "kopiert til" : "flyttet til";
      const timerNote = (!shouldCopy && sourceEntry.activities.length > 0) ? " (kopiert for å bevare timer)" : " (tom tilordning)";
      
      toast({
        title: `Prosjekt ${action}`,
        description: `${sourceEntry.project?.project_name} ${action} ${targetEmployee ? getPersonDisplayName(targetEmployee.fornavn, targetEmployee.etternavn) : 'ukjent ansatt'} på ${new Date(targetDate).toLocaleDateString('no-NO')}${timerNote}`
      });

      revalidateInBackground();
    } catch (error: unknown) {
      rollbackUpdate(previousData, error instanceof Error ? error.message : 'En ukjent feil oppstod');
    } finally {
      setIsProcessingUpdate(false);
    }
  };

  // Free lines CRUD functions
  const addFreeLine = useCallback(async (weekNumber?: number, year?: number) => {
    if (!profile?.org_id) return;

    try {
      // Use provided week/year or default to first week being displayed
      const targetWeek = weekNumber || multiWeekData[0]?.week || startWeek;
      const targetYear = year || multiWeekData[0]?.year || startYear;
      
      // Get the next display order for this specific week
      const weekFreeLines = freeLines.filter(line => 
        line.week_number === targetWeek && line.year === targetYear
      );
      const maxOrder = weekFreeLines.length > 0 ? Math.max(...weekFreeLines.map(line => line.display_order)) : 0;
      
      const { error } = await supabase
        .from('frie_linjer')
        .insert({
          org_id: profile.org_id,
          week_number: targetWeek,
          year: targetYear,
          display_order: maxOrder + 1
        });

      if (error) throw error;
      
      // Reload free lines
      await loadFreeLines();
      
      toast({
        title: "Frie linje lagt til",
        description: "En ny frie linje er opprettet.",
      });
    } catch (error) {
      console.error('Error adding free line:', error);
      toast({
        title: "Feil",
        description: "Kunne ikke legge til frie linje.",
        variant: "destructive"
      });
    }
  }, [profile?.org_id, multiWeekData, startWeek, startYear, freeLines, loadFreeLines, toast]);

  const addFreeBubble = useCallback(async (lineId: string, date: string) => {
    if (!profile?.org_id) return;

    try {
      // Get the next display order for this line
      const line = freeLines.find(l => l.id === lineId);
      const maxOrder = line?.frie_bobler?.length ? Math.max(...line.frie_bobler.map(bubble => bubble.display_order)) : 0;
      
      const { error } = await supabase
        .from('frie_bobler')
        .insert({
          frie_linje_id: lineId,
          date: date,
          text: 'Ny boble',
          color: '#94a3b8', // Default gray color
          display_order: maxOrder + 1
        });

      if (error) throw error;
      
      // Reload free lines
      await loadFreeLines();
      
      toast({
        title: "Boble lagt til",
        description: "En ny boble er opprettet.",
      });
    } catch (error) {
      console.error('Error adding free bubble:', error);
      toast({
        title: "Feil",
        description: "Kunne ikke legge til boble.",
        variant: "destructive"
      });
    }
  }, [profile?.org_id, freeLines, loadFreeLines, toast]);

  const editFreeBubble = useCallback(async (bubbleId: string, text: string, color: string) => {
    if (!profile?.org_id) return;

    try {
      // First, update the specific bubble
      const { error } = await supabase
        .from('frie_bobler')
        .update({
          text: text,
          color: color
        })
        .eq('id', bubbleId);

      if (error) throw error;

      // Then, update all other bubbles with the same text to have the same color
      const { error: updateSameTextError } = await supabase
        .from('frie_bobler')
        .update({
          color: color
        })
        .eq('text', text)
        .neq('id', bubbleId); // Don't update the bubble we just updated

      if (updateSameTextError) {
        console.error('Error updating same text bubbles:', updateSameTextError);
        // Don't throw error here, as the main update succeeded
      }
      
      // Reload free lines
      await loadFreeLines();
      
      toast({
        title: "Boble oppdatert",
        description: `Boblen er oppdatert. Alle bobler med navnet "${text}" har fått samme farge.`,
      });
    } catch (error) {
      console.error('Error updating free bubble:', error);
      toast({
        title: "Feil",
        description: "Kunne ikke oppdatere boble.",
        variant: "destructive"
      });
    }
  }, [profile?.org_id, loadFreeLines, toast]);

  const deleteFreeBubble = useCallback(async (bubbleId: string) => {
    if (!profile?.org_id) return;

    try {
      const { error } = await supabase
        .from('frie_bobler')
        .delete()
        .eq('id', bubbleId);

      if (error) throw error;
      
      // Reload free lines
      await loadFreeLines();
      
      toast({
        title: "Boble slettet",
        description: "Boblen er slettet.",
      });
    } catch (error) {
      console.error('Error deleting free bubble:', error);
      toast({
        title: "Feil",
        description: "Kunne ikke slette boble.",
        variant: "destructive"
      });
    }
  }, [profile?.org_id, loadFreeLines, toast]);

  const deleteFreeLine = useCallback(async (lineId: string) => {
    if (!profile?.org_id) return;

    try {
      // Delete all bubbles in this line first
      const { error: deleteBubblesError } = await supabase
        .from('frie_bobler')
        .delete()
        .eq('frie_linje_id', lineId);

      if (deleteBubblesError) throw deleteBubblesError;

      // Delete the line
      const { error: deleteLineError } = await supabase
        .from('frie_linjer')
        .delete()
        .eq('id', lineId);

      if (deleteLineError) throw deleteLineError;
      
      // Reload free lines
      await loadFreeLines();
      
      toast({
        title: "Linje slettet",
        description: "Hele linjen er slettet.",
      });
    } catch (error) {
      console.error('Error deleting free line:', error);
      toast({
        title: "Feil",
        description: "Kunne ikke slette linje.",
        variant: "destructive"
      });
    }
  }, [profile?.org_id, loadFreeLines, toast]);

  const copyFreeBubble = useCallback(async (bubbleId: string, targetDate: string, targetLineId: string) => {
    if (!profile?.org_id) return;

    try {
      // Get the original bubble
      const { data: originalBubble, error: fetchError } = await supabase
        .from('frie_bobler')
        .select('*')
        .eq('id', bubbleId)
        .single();

      if (fetchError) throw fetchError;

      // Find the specific target line directly
      const targetLine = freeLines.find(line => line.id === targetLineId);

      if (!targetLine) {
        throw new Error(`Target line with ID ${targetLineId} not found`);
      }

      // Create a copy
      const { error: insertError } = await supabase
        .from('frie_bobler')
        .insert({
          frie_linje_id: targetLine.id,
          date: targetDate,
          text: originalBubble.text,
          color: originalBubble.color,
          display_order: (targetLine.frie_bobler?.length || 0) + 1
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      // Reload free lines
      await loadFreeLines();
      
      toast({
        title: "Boble kopiert",
        description: "Boblen er kopiert til ny dato.",
      });
    } catch (error) {
      console.error('Error copying free bubble:', error);
      toast({
        title: "Feil",
        description: "Kunne ikke kopiere boble.",
        variant: "destructive"
      });
    }
  }, [profile?.org_id, freeLines, loadFreeLines, toast]);

  const moveFreeBubble = useCallback(async (bubbleId: string, sourceLineId: string, targetDate: string) => {
    if (!profile?.org_id) return;

    try {
      // Find the target line for the target date - if none exists, find any line for the same week
      let targetLine = freeLines.find(line => 
        line.frie_bobler?.some(bubble => bubble.date === targetDate)
      );

      // If no line exists for this date, find the first line for the same week
      if (!targetLine) {
        // Extract week and year from targetDate
        const targetDateObj = new Date(targetDate);
        const targetWeek = getWeekNumber(targetDateObj);
        const targetYear = targetDateObj.getFullYear();
        
        targetLine = freeLines.find(line => 
          line.week_number === targetWeek && line.year === targetYear
        );
      }

      // If still no line exists, create a new one for this week
      if (!targetLine) {
        const targetDateObj = new Date(targetDate);
        const targetWeek = getWeekNumber(targetDateObj);
        const targetYear = targetDateObj.getFullYear();
        
        const { data: newLine, error: lineError } = await supabase
          .from('frie_linjer')
          .insert({
            org_id: profile.org_id,
            week_number: targetWeek,
            year: targetYear,
            display_order: 1
          })
          .select()
          .single();

        if (lineError) throw lineError;
        targetLine = newLine;
      }

      // Update the bubble's date and line
      const { error } = await supabase
        .from('frie_bobler')
        .update({
          frie_linje_id: targetLine.id,
          date: targetDate,
          display_order: (targetLine.frie_bobler?.length || 0) + 1
        })
        .eq('id', bubbleId);

      if (error) throw error;
      
      // Reload free lines
      await loadFreeLines();
      
      toast({
        title: "Boble flyttet",
        description: "Boblen er flyttet til ny dato.",
      });
    } catch (error) {
      console.error('Error moving free bubble:', error);
      toast({
        title: "Feil",
        description: "Kunne ikke flytte boble.",
        variant: "destructive"
      });
    }
  }, [profile?.org_id, freeLines, loadFreeLines, toast]);

  const updateLineName = useCallback(async (lineId: string, newName: string) => {
    if (!profile?.org_id) return;

    try {
      const { error } = await supabase
        .from('frie_linjer')
        .update({
          name: newName
        })
        .eq('id', lineId);

      if (error) throw error;
      
      // Reload free lines
      await loadFreeLines();
      
      toast({
        title: "Linje-navn oppdatert",
        description: `Linjen er nå kalt "${newName}".`,
      });
    } catch (error) {
      console.error('Error updating line name:', error);
      toast({
        title: "Feil",
        description: "Kunne ikke oppdatere linje-navn.",
        variant: "destructive"
      });
    }
  }, [profile?.org_id, loadFreeLines, toast]);

  const sendToTripletex = async (entry: StaffingEntry) => {
    if (!entry.project?.tripletex_project_id) {
      toast({
        title: "Kan ikke sende til Tripletex",
        description: "Prosjektet mangler Tripletex ID",
        variant: "destructive"
      });
      return;
    }

    if (!entry.person.tripletex_employee_id) {
      toast({
        title: "Mangler Tripletex-ansatt",
        description: "Den ansatte er ikke koblet til Tripletex. Kjør ansattsynk først.",
        variant: "destructive"
      });
      return;
    }

    // Check if there are any activities to send
    if (entry.activities.length === 0) {
      toast({
        title: "Ingen timer å sende",
        description: "Det finnes ingen timer for dette prosjektet",
        variant: "destructive"
      });
      return;
    }

    // Check if all activities are approved
    const unapprovedActivities = entry.activities.filter(a => a.status !== 'godkjent');
    if (unapprovedActivities.length > 0) {
      toast({
        title: "Timer ikke godkjent",
        description: "Alle timer må være godkjent før sending til Tripletex",
        variant: "destructive"
      });
      return;
    }

    setSendingToTripletex(prev => new Set(prev).add(entry.id));

    try {
      // Send all activities for this entry in parallel (much faster!)
      const activityPromises = entry.activities.map(async (activity) => {
        const { data, error } = await supabase.functions.invoke('tripletex-api', {
          body: {
            action: 'send_timesheet_entry',
            vakt_timer_id: activity.id,
            employee_id: entry.person.tripletex_employee_id,
            project_id: entry.project?.tripletex_project_id,
            activity_id: activity.ttx_activity_id || null,
            hours: activity.timer,
            date: entry.date,
            is_overtime: !!activity.is_overtime,
            description: activity.notat || '',
            orgId: profile?.org_id || ''
          }
        });

        if (error) {
          console.error('Supabase function error:', error);
          throw new Error(error instanceof Error ? error.message : 'Failed to send to Tripletex');
        }

        if (!data?.success) {
          console.error('Tripletex API response:', { 
            success: data?.success, 
            error: data?.error, 
            details: data?.details,
            fullResponse: data 
          });
          throw new Error(data?.error || 'Failed to send to Tripletex');
        }

        return data;
      });

      // Wait for all activities to be sent
      await Promise.all(activityPromises);

      // Calculate total hours sent
      const totalHours = entry.activities.reduce((sum, activity) => sum + activity.timer, 0);
      
      toast({
        title: "Timer sendt til Tripletex",
        description: `${formatTimeValue(totalHours)} timer (${entry.activities.length} ${entry.activities.length === 1 ? 'aktivitet' : 'aktiviteter'}) sendt for ${entry.project.project_name}`
      });

      revalidateInBackground(); // Refresh to show updated sync status
    } catch (error: unknown) {
      console.error('Error sending to Tripletex:', error);
      
      let errorMessage = "Ukjent feil oppstod";
      let errorTitle = "Feil ved sending til Tripletex";
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('activity_not_on_project')) {
          errorTitle = "Aktivitet ikke tilgjengelig";
          errorMessage = "Aktiviteten finnes ikke på dette prosjektet i Tripletex. Kontakt administrator for å legge til aktiviteten.";
        } else if (message.includes('employee_not_participant')) {
          errorTitle = "Ansatt ikke deltaker";
          errorMessage = "Ansatt er ikke registrert som deltaker på dette prosjektet i Tripletex. Kontakt administrator.";
        } else if (message.includes('http 429') || message.includes('rate limit')) {
          errorTitle = "For mange forespørsler";
          errorMessage = "Tripletex API har rate limiting. Vent litt og prøv igjen.";
        } else if (message.includes('period is closed') || message.includes('låst')) {
          errorTitle = "Periode er låst";
          errorMessage = "Perioden er låst i Tripletex. Kontakt lønn for å åpne perioden.";
        } else if (message.includes('closed') || message.includes('avsluttet') || message.includes('project is closed') || message.includes('lukket')) {
          errorTitle = "Prosjekt avsluttet";
          errorMessage = "Prosjektet er avsluttet i Tripletex og kan ikke motta nye timer. Kontakt administrator hvis dette er feil.";
        } else if (message.includes('validering feilet') || message.includes('validation failed')) {
          errorTitle = "Validering feilet";
          errorMessage = "Tripletex validering feilet. Dette kan være fordi prosjektet er avsluttet, perioden er låst, eller andre restriksjoner. Kontakt administrator.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSendingToTripletex(prev => {
        const newSet = new Set(prev);
        newSet.delete(entry.id);
        return newSet;
      });
    }
  };

  const verifyTripletexStatus = async (entry: StaffingEntry) => {
    try {
      let verifiedActivities = 0;
      let notFoundActivities = 0;
      let verifiedHours = 0;
      let notFoundHours = 0;

      for (const activity of entry.activities) {
        if (activity.tripletex_entry_id) {
          const { data, error } = await supabase.functions.invoke('tripletex-api', {
            body: {
              action: 'verify-timesheet-entry',
              tripletexEntryId: activity.tripletex_entry_id,
              orgId: profile?.org_id
            }
          });

          if (error) {
            console.error('Error verifying timesheet entry:', error);
            continue;
          }

          if (data?.data?.exists) {
            verifiedActivities++;
            verifiedHours += activity.timer || 0;
          } else {
            notFoundActivities++;
            notFoundHours += activity.timer || 0;
          }
        }
      }

      if (verifiedActivities > 0 && notFoundActivities === 0) {
        toast({
          title: "Bekreftet i Tripletex",
          description: `${verifiedHours} timer (${verifiedActivities} aktiviteter) er synkronisert med Tripletex`
        });
      } else if (notFoundActivities > 0) {
        toast({
          title: "Timer ikke funnet i Tripletex",
          description: `${verifiedHours} timer bekreftet, ${notFoundHours} timer ikke funnet`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Ingen timer å sjekke",
          description: "Ingen timer er sendt til Tripletex ennå"
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Sjekk feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
    }
  };

  const recallFromTripletex = async (entry: StaffingEntry) => {
    try {
      // Recall all activities for this entry in parallel (much faster!)
      const activitiesToRecall = entry.activities.filter(activity => activity.tripletex_entry_id);
      
      if (activitiesToRecall.length === 0) {
        return; // Nothing to recall
      }

      const recallPromises = activitiesToRecall.map(async (activity) => {
        const { data, error } = await supabase.functions.invoke('tripletex-api', {
          body: {
            action: 'delete_timesheet_entry',
            tripletex_entry_id: activity.tripletex_entry_id,
            vakt_timer_id: activity.id,
            orgId: profile?.org_id || ''
          }
        });

        if (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to recall from Tripletex');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to recall from Tripletex');
        }

        return data;
      });

      // Wait for all activities to be recalled
      await Promise.all(recallPromises);

      // Optimistically update UI immediately
      updateStaffingDataOptimistically(prevData => {
        const mapped = prevData.map(e => 
          e.id === entry.id 
            ? {
                ...e,
                activities: e.activities.map(a => ({
                  ...a,
                  tripletex_synced_at: null,
                  tripletex_entry_id: null,
                  sync_error: null,
                  status: 'utkast'
                }))
              }
            : e
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return mapped as any;
      });

      // Calculate total hours recalled
      const totalHours = entry.activities.reduce((sum, activity) => sum + activity.timer, 0);
      
      toast({
        title: "Timer kalt tilbake fra Tripletex",
        description: `${formatTimeValue(totalHours)} timer (${entry.activities.length} ${entry.activities.length === 1 ? 'aktivitet' : 'aktiviteter'}) er nå tilbake til utkast-status og kan redigeres`
      });

      revalidateInBackground();
    } catch (error: unknown) {
      toast({
        title: "Tilbakekalling feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
    }
  };

  const unapproveSelectedEntries = async () => {
    try {
      const entryIds = Array.from(selectedEntries);
      const timerIds = staffingData
        .filter(e => entryIds.includes(e.id))
        .flatMap(e => e.activities.map(a => a.id));

      const { data, error } = await supabase.functions.invoke('tripletex-api', {
        body: {
          action: 'unapprove_timesheet_entries', 
          entry_ids: timerIds,
          orgId: profile?.org_id || ''
        }
      });

      if (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to unapprove entries');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to unapprove entries');
      }

      toast({
        title: "Godkjenning trukket tilbake",
        description: `${entryIds.length} oppføringer satt tilbake til utkast`
      });

      setSelectedEntries(new Set());
      revalidateInBackground();
    } catch (error: unknown) {
      toast({
        title: "Tilbaketrekking feilet", 
        description: error instanceof Error ? error.message : "Ukjent feil oppstod",
        variant: "destructive"
      });
    }
  };

  const approveSelectedEntries = async () => {
    try {
      const entryIds = Array.from(selectedEntries);
      const timerIds = staffingData
        .filter(e => entryIds.includes(e.id))
        .flatMap(e => e.activities.map(a => a.id));

      if (timerIds.length === 0) {
        toast({
          title: "Ingen timer å godkjenne",
          description: `Velg timer som skal godkjennes. Valgte oppføringer: ${entryIds.length}, Timer funnet: ${timerIds.length}`,
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('vakt_timer')
        .update({ 
          status: 'godkjent',
          approved_at: toLocalDateTimeString(new Date()),
          approved_by: user?.id
        })
        .in('id', timerIds);

      if (error) throw error;

      toast({
        title: "Timer godkjent",
        description: `${entryIds.length} oppføringer godkjent og klar for sending til Tripletex`
      });

      setSelectedEntries(new Set());
      revalidateInBackground();
    } catch (error: unknown) {
      toast({
        title: "Godkjenning feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
    }
  };

  const approveAllEntriesForWeek = async (weekNumber: number, year: number) => {
    try {
      // Get dates for the specific week
      const weekData = multiWeekData.find(w => w.week === weekNumber && w.year === year);
      if (!weekData?.dates) {
        toast({
          title: "Uke ikke funnet",
          description: `Kunne ikke finne data for uke ${weekNumber}, ${year}`,
          variant: "destructive"
        });
        return;
      }

      const weekDateKeys = weekData.dates.map(toDateKey).filter(Boolean);
      
      // Debug: Log all entries for this week
      const weekEntries = staffingData.filter(entry => weekDateKeys.includes(entry.date));
      console.log(`Week ${weekNumber} entries:`, weekEntries.map(e => ({
        id: e.id,
        date: e.date,
        person: e.person?.fornavn + ' ' + e.person?.etternavn,
        activities: e.activities.map(a => ({ id: a.id, status: a.status, timer: a.timer }))
      })));
      
      // Debug: Show specific statuses for entries with activities
      const entriesWithActivities = weekEntries.filter(e => e.activities.length > 0);
      console.log(`Entries with activities:`, entriesWithActivities.map(e => ({
        person: e.person?.fornavn + ' ' + e.person?.etternavn,
        activities: e.activities.map(a => ({ status: a.status, timer: a.timer }))
      })));
      
      // Debug: Show detailed status analysis
      entriesWithActivities.forEach(entry => {
        entry.activities.forEach(activity => {
          console.log(`${entry.person?.fornavn}: status="${activity.status}", timer=${activity.timer}, willApprove=${activity.status !== 'godkjent' && activity.status !== 'sendt'}`);
        });
      });
      
      // Find all entries that need approval for this specific week
      // TEMPORARY: Include ALL entries with activities, regardless of status
      const entriesToApprove = staffingData.filter(entry => 
        weekDateKeys.includes(entry.date) &&
        entry.activities.length > 0
      );
      
      console.log(`Entries to approve for week ${weekNumber}:`, entriesToApprove.map(e => ({
        id: e.id,
        date: e.date,
        person: e.person?.fornavn + ' ' + e.person?.etternavn,
        activities: e.activities.map(a => ({ id: a.id, status: a.status, timer: a.timer }))
      })));
      
      // Debug: Show exactly what gets filtered
      console.log(`Filter logic debug:`);
      console.log(`Week date keys:`, weekDateKeys);
      console.log(`Total staffing data entries:`, staffingData.length);
      console.log(`Entries in week:`, weekEntries.length);
      console.log(`Entries with activities:`, entriesWithActivities.length);
      console.log(`Final entries to approve:`, entriesToApprove.length);

      if (entriesToApprove.length === 0) {
        // Debug: Show what entries exist but weren't selected for approval
        const allWeekEntries = staffingData.filter(entry => weekDateKeys.includes(entry.date));
        const debugInfo = allWeekEntries.map(e => `${e.person?.fornavn} ${e.person?.etternavn}: ${e.activities.map(a => a.status).join(', ')}`).join('; ');
        
        toast({
          title: "Ingen timer å godkjenne",
          description: `Alle timer for uke ${weekNumber} er allerede godkjent eller sendt. Debug: ${debugInfo}`,
        });
        return;
      }

      // TEMPORARY: Include ALL timer IDs from all activities
      const timerIds = entriesToApprove.flatMap(entry => 
        entry.activities.map(activity => activity.id)
      );

      const { error } = await supabase
        .from('vakt_timer')
        .update({ 
          status: 'godkjent',
          approved_at: toLocalDateTimeString(new Date()),
          approved_by: user?.id
        })
        .in('id', timerIds);

      if (error) throw error;

      toast({
        title: "Alle timer godkjent",
        description: `${entriesToApprove.length} oppføringer for uke ${weekNumber} godkjent og klar for sending til Tripletex`
      });

      setSelectedEntries(new Set());
      revalidateInBackground();
    } catch (error: unknown) {
      toast({
        title: "Godkjenning feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
    }
  };

  const unapproveAllEntriesForWeek = async (weekNumber: number, year: number) => {
    try {
      // Get dates for the specific week
      const weekData = multiWeekData.find(w => w.week === weekNumber && w.year === year);
      if (!weekData?.dates) {
        toast({
          title: "Uke ikke funnet",
          description: `Kunne ikke finne data for uke ${weekNumber}, ${year}`,
          variant: "destructive"
        });
        return;
      }

      const weekDateKeys = weekData.dates.map(toDateKey).filter(Boolean);
      
      // Find all approved entries for this specific week
      const approvedEntries = staffingData.filter(entry => 
        weekDateKeys.includes(entry.date) &&
        entry.activities.some(activity => activity.status === 'godkjent')
      );

      if (approvedEntries.length === 0) {
        toast({
          title: "Ingen godkjenninger å trekke tilbake",
          description: `Alle timer for uke ${weekNumber} er allerede i utkast-status eller sendt`,
        });
        return;
      }

      const timerIds = approvedEntries.flatMap(entry => 
        entry.activities
          .filter(activity => activity.status === 'godkjent')
          .map(activity => activity.id)
      );

      const { data, error } = await supabase.functions.invoke('tripletex-api', {
        body: {
          action: 'unapprove_timesheet_entries', 
          entry_ids: timerIds,
          orgId: profile?.org_id
        }
      });

      if (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to unapprove entries');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to unapprove entries');
      }

      toast({
        title: "Alle godkjenninger trukket tilbake",
        description: `${approvedEntries.length} oppføringer for uke ${weekNumber} satt tilbake til utkast`
      });

      setSelectedEntries(new Set());
      revalidateInBackground();
    } catch (error: unknown) {
      toast({
        title: "Tilbaketrekking feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
    }
  };

  const sendAllToTripletexForWeek = async (weekNumber: number, year: number) => {
    try {
      // Get dates for the specific week
      const weekData = multiWeekData.find(w => w.week === weekNumber && w.year === year);
      if (!weekData?.dates) {
        toast({
          title: "Uke ikke funnet",
          description: `Kunne ikke finne data for uke ${weekNumber}, ${year}`,
          variant: "destructive"
        });
        return;
      }

      const weekDateKeys = weekData.dates.map(toDateKey).filter(Boolean);
      
      // Find all approved entries that haven't been sent yet
      const entriesToSend = staffingData.filter(entry => 
        weekDateKeys.includes(entry.date) &&
        entry.activities.length > 0 &&
        entry.activities.every(a => a.status === 'godkjent') &&
        !entry.activities.some(a => a.tripletex_synced_at)
      );

      if (entriesToSend.length === 0) {
        toast({
          title: "Ingen timer å sende",
          description: `Alle godkjente timer for uke ${weekNumber} er allerede sendt til Tripletex`,
        });
        return;
      }

      // Show loading overlay
      setLoadingOverlay({
        isVisible: true,
        message: 'Sender timer til Tripletex...',
        count: entriesToSend.length
      });

      // Send entries in smaller batches with delays to avoid rate limiting
      const batchSize = 3; // Reduced from parallel to avoid rate limits
      const delayBetweenBatches = 2000; // 2 seconds between batches
      const results = [];

      for (let i = 0; i < entriesToSend.length; i += batchSize) {
        const batch = entriesToSend.slice(i, i + batchSize);
        
        // Update loading message with progress
        setLoadingOverlay({
          isVisible: true,
          message: `Sender timer til Tripletex... (${i + 1}-${Math.min(i + batchSize, entriesToSend.length)} av ${entriesToSend.length})`,
          count: entriesToSend.length
        });

        const batchPromises = batch.map(async (entry) => {
          try {
            await sendToTripletex(entry);
            return { success: true, hours: entry.activities.reduce((sum, a) => sum + a.timer, 0) };
          } catch (error) {
            console.error(`Failed to send entry ${entry.id}:`, error);
            return { success: false, hours: 0, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches (except for the last batch)
        if (i + batchSize < entriesToSend.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      const totalHours = results.reduce((sum, r) => sum + r.hours, 0);

      if (successCount > 0) {
        toast({
          title: "Timer sendt til Tripletex",
          description: `${formatTimeValue(totalHours)} timer fra ${successCount} prosjekt${successCount === 1 ? '' : 'er'} sendt til Tripletex${failCount > 0 ? ` (${failCount} feilet)` : ''}`
        });
      }

      if (failCount > 0 && successCount === 0) {
        // Get error details from failed results
        const failedResults = results.filter(r => !r.success && r.error);
        const errorTypes = [...new Set(failedResults.map(r => {
          const error = r.error?.toLowerCase() || '';
          if (error.includes('activity_not_on_project')) return 'Aktivitet ikke på prosjekt';
          if (error.includes('employee_not_participant')) return 'Ansatt ikke deltaker';
          if (error.includes('http 429') || error.includes('rate limit')) return 'Rate limiting';
          if (error.includes('period is closed') || error.includes('låst')) return 'Periode låst';
          if (error.includes('closed') || error.includes('avsluttet') || error.includes('project is closed') || error.includes('lukket')) return 'Prosjekt avsluttet';
          if (error.includes('validering feilet') || error.includes('validation failed')) return 'Validering feilet';
          return 'Ukjent feil';
        }))];
        
        toast({
          title: "Sending feilet",
          description: `Kunne ikke sende timer for uke ${weekNumber}. Vanligste feil: ${errorTypes.slice(0, 2).join(', ')}`,
          variant: "destructive"
        });
      }

      // Hide loading overlay
      setLoadingOverlay({ isVisible: false, message: '' });
      revalidateInBackground();
    } catch (error: unknown) {
      // Hide loading overlay on error
      setLoadingOverlay({ isVisible: false, message: '' });
      toast({
        title: "Sending feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
    }
  };

  const recallAllFromTripletexForWeek = async (weekNumber: number, year: number) => {
    try {
      // Get dates for the specific week
      const weekData = multiWeekData.find(w => w.week === weekNumber && w.year === year);
      if (!weekData?.dates) {
        toast({
          title: "Uke ikke funnet",
          description: `Kunne ikke finne data for uke ${weekNumber}, ${year}`,
          variant: "destructive"
        });
        return;
      }

      const weekDateKeys = weekData.dates.map(toDateKey).filter(Boolean);
      
      // Find all entries that have been sent to Tripletex
      const entriesToRecall = staffingData.filter(entry => 
        weekDateKeys.includes(entry.date) &&
        entry.activities.some(a => a.tripletex_synced_at)
      );

      if (entriesToRecall.length === 0) {
        toast({
          title: "Ingen timer å tilbakekalle",
          description: `Ingen timer for uke ${weekNumber} er sendt til Tripletex`,
        });
        return;
      }

      // Show loading overlay
      setLoadingOverlay({
        isVisible: true,
        message: 'Tilbakekaller timer fra Tripletex...',
        count: entriesToRecall.length
      });

      // Recall all entries from Tripletex in parallel (much faster!)
      const recallPromises = entriesToRecall.map(async (entry) => {
        try {
          await recallFromTripletex(entry);
          return { success: true, hours: entry.activities.reduce((sum, a) => sum + a.timer, 0) };
        } catch (error) {
          console.error(`Failed to recall entry ${entry.id}:`, error);
          return { success: false, hours: 0 };
        }
      });

      const results = await Promise.all(recallPromises);
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      const totalHours = results.reduce((sum, r) => sum + r.hours, 0);

      if (successCount > 0) {
        toast({
          title: "Timer tilbakekalt fra Tripletex",
          description: `${formatTimeValue(totalHours)} timer fra ${successCount} prosjekt${successCount === 1 ? '' : 'er'} tilbakekalt${failCount > 0 ? ` (${failCount} feilet)` : ''}`
        });
      }

      if (failCount > 0 && successCount === 0) {
        toast({
          title: "Tilbakekalling feilet",
          description: `Kunne ikke tilbakekalle timer for uke ${weekNumber}`,
          variant: "destructive"
        });
      }

      // Hide loading overlay
      setLoadingOverlay({ isVisible: false, message: '' });
      revalidateInBackground();
    } catch (error: unknown) {
      // Hide loading overlay on error
      setLoadingOverlay({ isVisible: false, message: '' });
      toast({
        title: "Tilbakekalling feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
    }
  };

  // Show loading if any critical data is still loading
  const isLoadingCriticalData = profileLoading || employeesLoading || projectsLoading || projectColorsLoading || staffingDataLoading;
  
  if (isLoadingCriticalData) {
    return (
      <div className="p-6">
        <div className="text-center">Laster bemanningsdata...</div>
      </div>
    );
  }

  if (!profile && initialized) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Profil mangler</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Du må opprette en organisasjon og profil før du kan bruke bemanningslisten.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Loading Overlay */}
      {loadingOverlay.isVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl text-center max-w-sm mx-4">
            <div className="mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {loadingOverlay.message}
            </h3>
            {loadingOverlay.count && (
              <p className="text-sm text-gray-600">
                Behandler {loadingOverlay.count} prosjekt{loadingOverlay.count === 1 ? '' : 'er'}...
              </p>
            )}
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bemanningsliste</h1>
          <p className="text-muted-foreground">
            {profile?.org?.name} - Uker {safeStartWeek}-{safeLastWeek.week}, {safeStartYear}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Hjelp og tips</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Drag & Drop:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Dra prosjekter mellom ansatte</li>
                    <li>• Prosjekter med timer kopieres (bevarer original)</li>
                    <li>• Tomme prosjekter flyttes</li>
                    <li>• Hold Shift/Option for å alltid kopiere</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Prosjektstyring:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Prosjekter sorteres etter nummer</li>
                    <li>• Klikk på prosjekt for å endre farge</li>
                    <li>• Klikk på prosjekt for å redigere timer</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Godkjenning:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Velg timer og klikk &quot;Godkjenn&quot;</li>
                    <li>• Godkjente timer kan sendes til Tripletex</li>
                    <li>• Bruk &quot;Hent tilbake&quot; for å redigere</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Status-ikoner:</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>✓ Godkjent (grønn)</li>
                    <li>→ Send til Tripletex (blå)</li>
                    <li>🔄 Kall tilbake fra Tripletex (oransje)</li>
                    <li>! Klar for godkjenning (oransje)</li>
                    <li>✎ Utkast (grå)</li>
                    <li>⚠ Feil ved synkronisering (rød)</li>
                    <li>⚡ Overtid (gul)</li>
                    <li>🗑️ Sletting blokkert for godkjente/sendte prosjekter</li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
       
        </div>
        
      </div>

      {/* Multi-week Excel-like table */}
      <div className="space-y-8">
        {multiWeekData.length > 0 ? multiWeekData.map(weekData => {
          const safeWeek = coerceWeekRef(weekData);
          return (
            <div key={`${safeWeek.year}-${safeWeek.week}`} className="border rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-gray-300 p-2 text-left font-bold w-40 bg-slate-200">
                        <div className="flex flex-col gap-2">
                          <div>UKE {safeWeek.week}</div>
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="default" 
                                className="bg-green-600 hover:bg-green-700 text-xs px-1.5 py-0.5 h-5"
                                onClick={() => approveAllEntriesForWeek(safeWeek.week, safeWeek.year)}
                                title="Godkjenn alle timer for uken"
                              >
                                <Check className="h-3 w-3 mr-0.5" />
                                Godkjenn
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="border-orange-500 text-orange-600 hover:bg-orange-50 text-xs px-1.5 py-0.5 h-5"
                                onClick={() => unapproveAllEntriesForWeek(safeWeek.week, safeWeek.year)}
                                title="Avgodkjenn alle timer for uken"
                              >
                                <X className="h-3 w-3 mr-0.5" />
                                Avgodkjenn
                              </Button>
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="default" 
                                className="bg-blue-600 hover:bg-blue-700 text-xs px-1.5 py-0.5 h-5"
                                onClick={() => sendAllToTripletexForWeek(safeWeek.week, safeWeek.year)}
                                title="Send alle godkjente timer til Tripletex"
                              >
                                <Send className="h-3 w-3 mr-0.5" />
                                Tripletex
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="border-purple-500 text-purple-600 hover:bg-purple-50 text-xs px-1.5 py-0.5 h-5"
                                onClick={() => recallAllFromTripletexForWeek(safeWeek.week, safeWeek.year)}
                                title="Tilbakekall alle sendte timer fra Tripletex"
                              >
                                <RefreshCw className="h-3 w-3 mr-0.5" />
                                Tilbakekall
                              </Button>
                            </div>
                          </div>
                        </div>
                      </th>
                      {weekData.dates?.map((date, idx) => (
                        <th key={toDateKey(date) || `${safeWeek.year}-${safeWeek.week}-${idx}`} className="border border-gray-300 p-2 text-center min-w-[140px] font-bold">
                         <div className="space-y-1">
                           <div className="text-xs uppercase font-semibold">
                             {isNaN(date.getTime()) ? '' : date.toLocaleDateString('no-NO', { weekday: 'long' })}
                           </div>
                           <div className="text-sm">
                             {isNaN(date.getTime()) ? '' : date.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                           </div>
                         </div>
                       </th>
                     ))}
                  </tr>
                </thead>
                <tbody>
                    {employees.map((employee, employeeIndex) => {
                       const employeeEntries = staffingData.filter(e => 
                         e.person.id === employee.id && 
                         weekData.dates?.some(d => toDateKey(d) === e.date)
                       );
                       
                       // Calculate max projects per day for this employee to ensure consistent row height
                       const maxProjectsPerDay = Math.max(1, ...weekData.dates?.map(date => {
                         const dateStr = toDateKey(date);
                         return employeeEntries.filter(e => e.date === dateStr && e.project).length;
                       }) || [1]);
                       
                       const isEvenRow = employeeIndex % 2 === 0;
                       
                       return (
                         <tr key={employee.id} className={`hover:bg-gray-50 ${isEvenRow ? 'bg-white' : 'bg-gray-25'}`}>
                          <td className={`border border-gray-300 p-3 font-medium sticky left-0 ${isEvenRow ? 'bg-slate-50' : 'bg-slate-75'}`}>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={employeeEntries.every(e => selectedEntries.has(e.id))}
                                onCheckedChange={(checked) => {
                                  const newSelection = new Set(selectedEntries);
                                  employeeEntries.forEach(e => {
                                    if (checked) {
                                      newSelection.add(e.id);
                                    } else {
                                      newSelection.delete(e.id);
                                    }
                                  });
                                  setSelectedEntries(newSelection);
                                }}
                              />
                              <span>
                                {getPersonDisplayName(employee.fornavn, employee.etternavn)}
                                {(() => {
                                  // Calculate total hours for this employee this week
                                  const weekDateKeys = weekData.dates?.map(toDateKey).filter(Boolean) || [];
                                  const weekEntries = employeeEntries.filter(e => weekDateKeys.includes(e.date));
                                  
                                  let totalRegularHours = 0;
                                  let totalOvertimeHours = 0;
                                  
                                  weekEntries.forEach(entry => {
                                    entry.activities.forEach(activity => {
                                      if (activity.is_overtime) {
                                        totalOvertimeHours += activity.timer || 0;
                                      } else {
                                        totalRegularHours += activity.timer || 0;
                                      }
                                    });
                                  });
                                  
                                  const hasHours = totalRegularHours > 0 || totalOvertimeHours > 0;
                                  
                                  if (!hasHours) return null;
                                  
                                  return (
                                    <span className="text-xs text-gray-500 ml-2">
                                      {totalRegularHours > 0 && `${formatTimeValue(totalRegularHours)}t`}
                                      {totalRegularHours > 0 && totalOvertimeHours > 0 && ' '}
                                      {totalOvertimeHours > 0 && `+${formatTimeValue(totalOvertimeHours)}o`}
                                    </span>
                                  );
                                })()}
                              </span>
                            </div>
                          </td>
                          {weekData.dates?.map((date, idx) => {
                            const dateStr = toDateKey(date);
                            const dayEntries = employeeEntries.filter(e => e.date === dateStr && e.project);
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6; // Sunday = 0, Saturday = 6
                            const isHoliday = calendarDays[dateStr]?.isHoliday || false;
                            const isFreeDay = isWeekend || isHoliday;
                            
                            return (
                               <td 
                                 key={dateStr || `${employee.id}-${safeWeek.week}-${idx}`}
                               className={`border border-gray-300 p-1 min-w-[140px] relative group ${isEvenRow ? 'bg-white' : 'bg-gray-25'}`}
                               style={{
                                 minHeight: `${Math.max(120, maxProjectsPerDay * 70 + 40)}px`,
                                 verticalAlign: 'top'
                               }}
                              data-employee-id={employee.id}
                              data-date={dateStr}
                              onDragOver={(e) => {
                                e.preventDefault();
                                // Indicate copy vs move while dragging
                                try {
                                  const copyMod = e.shiftKey || e.altKey || e.metaKey || e.ctrlKey;
                                  e.dataTransfer.dropEffect = copyMod ? 'copy' : 'move';
                                } catch (error) {
                                  // Ignore dataTransfer errors in some browsers
                                  console.debug('DataTransfer error:', error);
                                }
                                e.currentTarget.classList.add('bg-blue-50', 'border-blue-300');
                              }}
                              onDragLeave={(e) => {
                                e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300');
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300');
                                
                                const draggedEntryId = e.dataTransfer.getData('text/plain');
                                const sourcePersonId = e.dataTransfer.getData('application/x-source-person-id');
                                const sourceDate = e.dataTransfer.getData('application/x-source-date');
                                
                                if (draggedEntryId) {
                                  const intendsCopy = e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.dataTransfer.dropEffect === 'copy';
                                  const isSamePerson = sourcePersonId === employee.id;
                                  const isSameDate = sourceDate === dateStr;
                                  
                                  if (isSamePerson && isSameDate) {
                                    // Same cell - do nothing
                                    return;
                                  }
                                  
                                  // Prevent multiple simultaneous operations
                                  if (isProcessingUpdate) return;
                                  
                                  // Move or copy based on modifier key
                                  moveEntryToEmployeeAndDate(draggedEntryId, employee.id, dateStr, intendsCopy);
                                }
                              }}
                            >
                              {isFreeDay && (
                                <div className="absolute inset-0 bg-red-500/10 pointer-events-none rounded-sm" />
                              )}
                              <div className="flex flex-col gap-1 items-start h-full">
                                {dayEntries
                                  .sort((a, b) => {
                                    const aNum = a.project?.project_number || 999999;
                                    const bNum = b.project?.project_number || 999999;
                                    return aNum - bNum;
                                  })
                                  .map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="w-full h-14 p-2 text-xs font-medium text-white cursor-move rounded shadow-sm relative hover:shadow-lg transition-shadow group/project truncate"
                                    style={{ 
                                      backgroundColor: getProjectColor(entry.project?.tripletex_project_id),
                                      color: getContrastColor(getProjectColor(entry.project?.tripletex_project_id))
                                    }}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/plain', entry.id);
                                      e.dataTransfer.setData('application/x-source-person-id', employee.id);
                                      e.dataTransfer.setData('application/x-source-date', dateStr);
                                      e.dataTransfer.effectAllowed = 'copyMove';
                                      
                                      // Add visual feedback to the dragged element
                                      e.currentTarget.style.opacity = '0.5';
                                    }}
                                     onDragEnd={(e) => {
                                       // Reset visual feedback
                                       e.currentTarget.style.opacity = '1';
                                     }}
                                     onClick={(e) => {
                                        e.stopPropagation();
                                        const firstActivity = entry.activities[0];
                                        // Allow editing even if no activities exist yet - administrators can fill in time entries
                                        setEditDialog({ 
                                          vaktId: entry.id, 
                                          existingEntry: firstActivity || null 
                                        });
                                      }}
                                     title={`#${entry.project?.tripletex_project_id} - ${entry.project?.project_name}\n${formatTimeValue(entry.totalHours)} timer\nKlikk for å redigere timer\nDra for å flytte/kopiere prosjekt\nHold Shift/Option for å alltid kopiere`}
                                  >
                                    {/* Action icons overlay */}
                                    <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover/project:opacity-100 transition-opacity">
                                      {/* Only show delete button if not approved or actually sent to Tripletex */}
                                      {!entry.activities.some(a => a.status === 'godkjent' || a.tripletex_synced_at) && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteEntry(entry.id);
                                          }}
                                          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md border border-white/20"
                                          title="Slett prosjekt"
                                        >
                                          <X className="h-2 w-2" />
                                        </button>
                                      )}
                                      {/* Show approval indicator if there are activities and all are approved */}
                                      {entry.activities.length > 0 && entry.activities.every(a => a.status === 'godkjent') && (
                                        <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                                          <Check className="h-2 w-2" />
                                        </div>
                                      )}
                                      {/* Only show send button if there are activities, all are approved, and not already sent */}
                                      {entry.activities.length > 0 && entry.activities.every(a => a.status === 'godkjent') && !entry.activities.some(a => a.tripletex_synced_at) && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            sendToTripletex(entry);
                                          }}
                                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1 shadow-md border border-white/20"
                                          title="Send til Tripletex"
                                          disabled={sendingToTripletex.has(entry.id)}
                                        >
                                          <Send className="h-2 w-2" />
                                        </button>
                                      )}
                                    </div>
                                    
                                    {/* Tripletex action buttons - positioned at bottom center, show on hover */}
                                    {entry.activities.some(a => a.tripletex_synced_at) && (
                                      <>
                                        {/* Recall button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            recallFromTripletex(entry);
                                          }}
                                          className="bg-orange-500 hover:bg-orange-600 text-white rounded-full p-1 shadow-md border border-white/20 opacity-0 group-hover/project:opacity-100 transition-opacity absolute bottom-1 left-1/2 transform -translate-x-1/2"
                                          title="Kall tilbake fra Tripletex"
                                        >
                                          <RefreshCw className="h-2 w-2" />
                                        </button>
                                        {/* Verify button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            verifyTripletexStatus(entry);
                                          }}
                                          className="bg-purple-500 hover:bg-purple-600 text-white rounded-full p-1 shadow-md border border-white/20 opacity-0 group-hover/project:opacity-100 transition-opacity absolute bottom-1 left-1/2 transform translate-x-4"
                                          title="Sjekk Tripletex-status"
                                        >
                                          <Check className="h-2 w-2" />
                                        </button>
                                      </>
                                    )}
                                    
                                    {/* Color palette button - positioned at bottom right */}
                                    {entry.project && (
                                      <button
                                        onClick={(e) => handleProjectColorClick(entry.project!, e)}
                                        className="absolute bottom-1 right-1 bg-white rounded-full p-1 shadow-md border opacity-0 group-hover/project:opacity-100 transition-opacity"
                                        title="Endre farge"
                                      >
                                        <Palette className="h-2 w-2 text-gray-600" />
                                      </button>
                                    )}
                                     <div className="space-y-1">
                                       {/* Project name */}
                                       <div className="text-sm font-semibold leading-tight">
                                         <span className="block max-w-[200px] truncate">
                                           {entry.project?.project_name}
                                         </span>
                                       </div>
                                       
                                       {/* Status indicator overlay */}
                                       {entry.activities.some(a => a.status === 'godkjent') && !entry.activities.some(a => a.tripletex_synced_at) && (
                                         <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                                           ✓
                                         </div>
                                       )}
                                       {entry.activities.some(a => a.tripletex_synced_at) && (
                                         <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                                           →
                                         </div>
                                       )}
                                       
                                       {/* Hours only */}
                                       {entry.totalHours > 0 && (
                                         <div className="text-sm font-medium">
                                           {formatTimeValue(entry.totalHours)} t
                                           {entry.activities.some(a => a.is_overtime) && (
                                             <span className="ml-1 text-yellow-200 font-bold" title="Inneholder overtid">⚡</span>
                                           )}
                                         </div>
                                       )}
                                     </div>
                                    
                                  </div>
                                ))}
                                
                                {/* Add project button */}
                                <div 
                                  className="w-full h-8 border-2 border-dashed border-gray-200 rounded opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer hover:border-blue-300"
                                  onClick={() => setShowProjectSearch({ date: dateStr, personId: employee.id })}
                                >
                                  <Plus className="h-4 w-4 text-gray-400" />
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  
                  {/* Free Lines for this week */}
                  {(() => {
                    const weekFreeLines = freeLines.filter(line => 
                      line.week_number === safeWeek.week && line.year === safeWeek.year
                    );
                    
                    return weekFreeLines.length > 0 ? (
                      <>
                        {/* Separator line */}
                        <tr>
                          <td colSpan={weekData.dates?.length ? weekData.dates.length + 2 : 3} className="border-t-2 border-gray-400 bg-gray-100 p-2">
                            <div className="text-xs font-medium text-gray-600 text-center">Frie linjer</div>
                          </td>
                        </tr>
                      
                      {weekFreeLines.map((line, lineIndex) => {
                        return (
                        <tr key={line.id} className="h-10 bg-gray-50">
              {/* Line label */}
              <td className="border border-gray-300 p-1 text-xs text-muted-foreground text-center w-40 bg-slate-200">
                <button
                  onClick={() => {
                    setEditLineNameDialog({
                      lineId: line.id,
                      currentName: line.name || `Linje ${lineIndex + 1}`
                    });
                  }}
                  className="hover:bg-gray-300 rounded px-2 py-1 transition-colors cursor-pointer w-full"
                  title="Klikk for å redigere navn"
                >
                  {line.name || `Linje ${lineIndex + 1}`}
                </button>
              </td>
                          
                          {/* Bubbles for each date */}
                          {weekData.dates?.map((date, idx) => {
                            const dateKey = toDateKey(date);
                            const bubble = line.frie_bobler?.find(bubble => bubble.date === dateKey);
                            
                            return (
                              <td key={`${line.id}-${dateKey}-${idx}`} className="border border-gray-300 p-1 min-w-[140px] h-10">
                                {bubble ? (
                                  <div
                                    className="h-10 rounded p-1 text-xs text-white flex items-center justify-center cursor-pointer hover:opacity-80 relative group"
                                    style={{ backgroundColor: bubble.color }}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/plain', bubble.id);
                                      e.dataTransfer.setData('application/x-free-bubble', 'true');
                                      e.dataTransfer.setData('application/x-source-date', bubble.date);
                                      e.dataTransfer.setData('application/x-source-line', line.id);
                                      e.dataTransfer.effectAllowed = 'copyMove';
                                      e.currentTarget.style.opacity = '0.5';
                                    }}
                                    onDragEnd={(e) => {
                                      e.currentTarget.style.opacity = '1';
                                    }}
                                    onClick={() => {
                                      setFreeBubbleEditDialog({
                                        bubbleId: bubble.id,
                                        text: bubble.text,
                                        color: bubble.color,
                                        lineId: line.id
                                      });
                                    }}
                                    title={`${bubble.text}\nKlikk for å redigere\nDra for å flytte\nHold Shift/Option for å kopiere`}
                                  >
                                    {bubble.text}
                                    {/* Delete bubble button */}
                                    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteFreeBubble(bubble.id);
                                        }}
                                        className="h-4 w-4 p-0 bg-red-500/80 hover:bg-red-600 text-white"
                                        title="Slett denne boblen"
                                      >
                                        <X className="h-2 w-2" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div 
                                    className="h-10 border border-dashed border-muted-foreground/30 rounded flex items-center justify-center"
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      try {
                                        const copyMod = e.shiftKey || e.altKey || e.metaKey || e.ctrlKey;
                                        e.dataTransfer.dropEffect = copyMod ? 'copy' : 'move';
                                      } catch (error) {
                                        console.debug('DataTransfer error:', error);
                                      }
                                      e.currentTarget.classList.add('bg-blue-50', 'border-blue-300');
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300');
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300');
                                      
                                      const bubbleId = e.dataTransfer.getData('text/plain');
                                      const isFreeBubble = e.dataTransfer.getData('application/x-free-bubble') === 'true';
                                      const sourceDate = e.dataTransfer.getData('application/x-source-date');
                                      const sourceLineId = e.dataTransfer.getData('application/x-source-line');
                                      
                                      if (isFreeBubble && bubbleId && (sourceDate !== dateKey || sourceLineId !== line.id)) {
                                        const intendsCopy = e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.dataTransfer.dropEffect === 'copy';
                                        
                                        if (intendsCopy) {
                                          copyFreeBubble(bubbleId, dateKey, line.id);
                                        } else {
                                          moveFreeBubble(bubbleId, sourceLineId, dateKey);
                                        }
                                      }
                                    }}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        addFreeBubble(line.id, dateKey);
                                      }}
                                      className="h-6 w-6 p-0 text-muted-foreground"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          
                          {/* Delete line button */}
                          <td className="border border-gray-300 p-1 w-10">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setDeleteLineDialog({
                                  lineId: line.id,
                                  lineNumber: lineIndex + 1
                                });
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                        );
                      })}
                      
                      {/* Add new line button */}
                      <tr className="h-10 bg-gray-50">
                        <td className="border border-gray-300 p-1 w-40 bg-slate-200"></td>
                        {weekData.dates?.map((date, idx) => (
                          <td key={idx} className="border border-gray-300 p-1 min-w-[140px] h-10"></td>
                        ))}
                        <td className="border border-gray-300 p-1 w-10">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              addFreeLine(safeWeek.week, safeWeek.year);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan={weekData.dates?.length ? weekData.dates.length + 2 : 3} className="border-t-2 border-gray-400 bg-gray-100 p-2">
                        <div className="flex justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              addFreeLine(safeWeek.week, safeWeek.year);
                            }}
                            className="h-8 px-3"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Legg til frie linje
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
                </tbody>
              </table>
            </div>
          </div>
        );
        }) : (
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              <p>Ingen bemanningsdata tilgjengelig for valgte periode.</p>
              <p className="text-sm mt-2">Kontroller at uke og år er gyldige, eller prøv en annen periode.</p>
            </div>
          </div>
        )}
      </div>
      {/* Color Picker Dialog */}
      {showColorPicker && (
        <ColorPickerDialog
          open={!!showColorPicker}
          onClose={() => setShowColorPicker(null)}
          projectName={showColorPicker.projectName}
          projectNumber={showColorPicker.projectNumber}
          currentColor={showColorPicker.currentColor}
          onColorChange={(color) => setProjectColor(showColorPicker.tripletexProjectId, color)}
        />
      )}

      {/* Project Search Dialog */}
      <ProjectSearchDialog
        open={!!showProjectSearch}
        onClose={() => setShowProjectSearch(null)}
        date={showProjectSearch?.date || ''}
        personId={showProjectSearch?.personId || ''}
        orgId={profile?.org_id || ''}
        onProjectAssigned={() => revalidateInBackground()}
      />

      {/* Time Entry Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
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
          <div className="flex-1 overflow-y-auto p-6" style={{ flex: 1, overflowY: 'auto' as const, padding: '1.5rem' }}>
            <DialogHeader className="pb-4">
              <DialogTitle>Rediger timeføring</DialogTitle>
              <DialogDescription>
                Rediger timer, aktivitet og andre detaljer for denne arbeidsoppgaven.
              </DialogDescription>
            </DialogHeader>
            {editDialog && (
              <TimeEntry
                vaktId={editDialog.vaktId}
                orgId={profile?.org_id || ''}
                onSave={() => {
                  revalidateInBackground();
                  setEditDialog(null);
                }}
                defaultTimer={8.0}
                existingEntry={editDialog.existingEntry ? {
                  id: editDialog.existingEntry.id,
                  timer: editDialog.existingEntry.timer,
                  aktivitet_id: editDialog.existingEntry.aktivitet_id || '',
                  notat: editDialog.existingEntry.notat || '',
                  status: editDialog.existingEntry.status
                } : undefined}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Free Bubble Edit Dialog */}
      <Dialog open={!!freeBubbleEditDialog} onOpenChange={() => setFreeBubbleEditDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rediger boble</DialogTitle>
            <DialogDescription>
              Rediger tekst og farge for denne boblen.
            </DialogDescription>
          </DialogHeader>
          {freeBubbleEditDialog && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tekst</label>
                <Input
                  defaultValue={freeBubbleEditDialog.text}
                  onChange={(e) => {
                    // Use local state for immediate UI update without causing lag
                    const newText = e.target.value;
                    setFreeBubbleEditDialog(prev => prev ? { ...prev, text: newText } : null);
                  }}
                  placeholder="Skriv tekst her..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Farge</label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[
                    '#ef4444', // Red
                    '#f97316', // Orange
                    '#eab308', // Yellow
                    '#22c55e', // Green
                    '#06b6d4', // Cyan
                    '#3b82f6', // Blue
                    '#8b5cf6', // Purple
                    '#ec4899', // Pink
                    '#94a3b8', // Gray
                    '#f59e0b', // Amber
                    '#10b981', // Emerald
                    '#14b8a6', // Teal
                    '#0ea5e9', // Sky
                    '#6366f1', // Indigo
                    '#a855f7', // Violet
                    '#f43f5e', // Rose
                    '#6b7280', // Gray-500
                    '#374151', // Gray-700
                    '#1f2937', // Gray-800
                    '#111827'  // Gray-900
                  ].map(color => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded border-2 ${
                        freeBubbleEditDialog.color === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        setFreeBubbleEditDialog(prev => prev ? { ...prev, color: color } : null);
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteFreeBubble(freeBubbleEditDialog.bubbleId);
                    setFreeBubbleEditDialog(null);
                  }}
                >
                  Slett
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setFreeBubbleEditDialog(null)}
                  >
                    Avbryt
                  </Button>
                  <Button
                    onClick={() => {
                      editFreeBubble(
                        freeBubbleEditDialog.bubbleId,
                        freeBubbleEditDialog.text,
                        freeBubbleEditDialog.color
                      );
                      setFreeBubbleEditDialog(null);
                    }}
                  >
                    Lagre
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
    {/* Delete Line Confirmation Dialog */}
    <Dialog open={!!deleteLineDialog} onOpenChange={() => setDeleteLineDialog(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Slett frie linje</DialogTitle>
          <DialogDescription>
            Er du sikker på at du vil slette hele linjen? Alle bobler i linjen vil også bli slettet.
          </DialogDescription>
        </DialogHeader>
        {deleteLineDialog && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteLineDialog(null)}
            >
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteFreeLine(deleteLineDialog.lineId);
                setDeleteLineDialog(null);
              }}
            >
              Slett linje
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Edit Line Name Dialog */}
    <Dialog open={!!editLineNameDialog} onOpenChange={() => setEditLineNameDialog(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rediger linje-navn</DialogTitle>
          <DialogDescription>
            Endre navnet på denne linjen.
          </DialogDescription>
        </DialogHeader>
        {editLineNameDialog && (
          <EditLineNameForm
            initialName={editLineNameDialog.currentName}
            onSave={(newName) => {
              updateLineName(editLineNameDialog.lineId, newName);
              setEditLineNameDialog(null);
            }}
            onCancel={() => setEditLineNameDialog(null)}
          />
        )}
      </DialogContent>
    </Dialog>
      </div>
    </>
  );
};

export default StaffingList;
