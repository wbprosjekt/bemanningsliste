import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Plus, 
  Copy, 
  Check, 
  Send, 
  Edit,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Download,
  Palette,
  X,
  RefreshCw
} from 'lucide-react';
import { getPersonDisplayName, generateProjectColor, getContrastColor, formatTimeValue, getWeekNumber } from '@/lib/displayNames';
import ProjectSearchDialog from './ProjectSearchDialog';
import ColorPickerDialog from './ColorPickerDialog';
import TimeEntry from './TimeEntry';
import { startOfISOWeek, addWeeks, addDays, isValid as isValidDate, format as formatDate } from 'date-fns';

interface StaffingEntry {
  id: string;
  date: string;
  person: {
    id: string;
    fornavn: string;
    etternavn: string;
    forventet_dagstimer: number;
    tripletex_employee_id?: number;
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

interface Activity {
  id: string;
  navn: string;
}

interface Employee {
  id: string;
  fornavn: string;
  etternavn: string;
  forventet_dagstimer: number;
  tripletex_employee_id?: number;
}

interface StaffingListProps {
  startWeek: number;
  startYear: number;
  weeksToShow?: number;
}

interface TimeEntry {
  id: string;
  timer: number;
  aktivitet_id: string;
  notat: string;
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

const StaffingList = ({ startWeek, startYear, weeksToShow = 6 }: StaffingListProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [staffingData, setStaffingData] = useState<StaffingEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [projectColors, setProjectColors] = useState<Record<number, string>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProjectSearch, setShowProjectSearch] = useState<{date: string, personId: string} | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<{
    projectName: string;
    projectNumber: number;
    tripletexProjectId: number;
    currentColor: string;
  } | null>(null);
  const [calendarDays, setCalendarDays] = useState<Record<string, { isWeekend: boolean; isHoliday: boolean }>>({});
  const [sendingToTripletex, setSendingToTripletex] = useState<Set<string>>(new Set());
  const [editDialog, setEditDialog] = useState<{ vaktId: string; existingEntry?: TimeEntry } | null>(null);
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);

  const toDateKey = useCallback((d: Date): string => {
    try {
      if (!isValidDate(d)) return '';
      return formatDate(d, 'yyyy-MM-dd');
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
  const getMultipleWeeksData = (): WeekData[] => {
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
  };

  // Memoize multiWeekData to prevent infinite loops
  const multiWeekData = useMemo(() => getMultipleWeeksData(), [safeStartWeek, safeStartYear, weeksToShow]);
  
  // Memoize allDates to prevent infinite loops
  const allDates = useMemo(() => {
    return multiWeekData.flatMap(w => w.dates).filter(d => d instanceof Date && !isNaN(d.getTime()));
  }, [multiWeekData]);

  // Safe access to last week data with fallback
  const lastWeekData = multiWeekData.length > 0 ? multiWeekData[multiWeekData.length - 1] : null;
  const safeLastWeek = coerceWeekRef(lastWeekData);

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

  const loadStaffingData = useCallback(async (silent: boolean = false) => {
    if (!profile?.org_id) return;

    if (!silent) setLoading(true);
    try {
      const dateStrings = allDates.map(toDateKey).filter(Boolean);
      if (dateStrings.length === 0) {
        console.warn('No valid dates generated for staffing query');
        setStaffingData([]);
        return;
      }
      
      // Get all employees first 
      const { data: allEmployees, error: employeeError } = await supabase
        .from('person')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('aktiv', true)
        .order('fornavn');

      if (employeeError) throw employeeError;

      // Get existing vakt data
      const { data: vaktData, error } = await supabase
        .from('vakt')
        .select(`
          id,
          dato,
          person_id,
          person:person_id (
            id,
            fornavn,
            etternavn,
            forventet_dagstimer,
            tripletex_employee_id
          ),
          ttx_project_cache:project_id (
            id,
            tripletex_project_id,
            project_name,
            project_number
          ),
          vakt_timer (
            id,
            timer,
            status,
            lonnstype,
            notat,
            is_overtime,
            aktivitet_id,
            ttx_activity_cache:aktivitet_id (
              id,
              navn
            )
          )
        `)
        .in('dato', dateStrings)
        .eq('org_id', profile.org_id);

      if (error) throw error;

      // Create a map of existing vakt data
      const vaktMap = new Map<string, any>();
      vaktData?.forEach((vakt: any) => {
        const key = `${vakt.dato}-${vakt.person_id}`;
        vaktMap.set(key, vakt);
      });

      // Generate staffing entries for all employees and dates
      const entries: StaffingEntry[] = [];
      
      allEmployees?.forEach((employee: any) => {
        allDates.forEach((date) => {
          const dateKey = toDateKey(date);
          if (!dateKey) return;
          
          const vaktKey = `${dateKey}-${employee.id}`;
          const existingVakt = vaktMap.get(vaktKey);
          
          if (existingVakt) {
            // Use existing vakt data and transform vaktTimer to activities
            const activities = (existingVakt.vakt_timer || []).map((timer: VaktTimer) => ({
              id: timer.id,
              timer: timer.timer ?? 0,
              status: timer.status,
              activity_name: timer.ttx_activity_cache?.navn || 'Ukjent aktivitet',
              lonnstype: timer.lonnstype,
              notat: timer.notat,
              is_overtime: timer.is_overtime,
              approved_at: timer.approved_at,
              approved_by: timer.approved_by,
              tripletex_synced_at: timer.tripletex_synced_at,
              tripletex_entry_id: timer.tripletex_entry_id,
              sync_error: timer.sync_error,
              aktivitet_id: timer.aktivitet_id,
              ttx_activity_id: timer.ttx_activity_cache?.id
            }));
            
            // Calculate total hours from activities
            const totalHours = activities.reduce((sum, activity) => sum + (activity.timer ?? 0), 0);
            
            entries.push({
              id: existingVakt.id,
              date: dateKey,
              person: existingVakt.person,
              project: existingVakt.ttx_project_cache,
              activities: activities,
              totalHours: totalHours,
              status: activities.length > 0 ? 
                (activities.every(a => a.status === 'godkjent') ? 'approved' : 'draft') : 
                'missing'
            });
          } else {
            // Create new entry
            entries.push({
              id: `new-${employee.id}-${dateKey}`,
              date: dateKey,
              person: employee,
              project: null,
              activities: [],
              totalHours: 0,
              status: 'missing'
            });
          }
        });
      });

      setStaffingData(entries);
    } catch (error) {
      console.error('Error loading staffing data:', error);
      toast({
        title: "Feil ved lasting av bemanningsdata",
        description: "Kunne ikke laste bemanningsliste.",
        variant: "destructive"
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [profile?.org_id, allDates, toDateKey, toast]);

  const loadProjects = useCallback(async () => {
    if (!profile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('ttx_project_cache')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('project_name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }, [profile?.org_id]);

  const loadActivities = useCallback(async () => {
    if (!profile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('ttx_activity_cache')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('navn');

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  }, [profile?.org_id]);

  const loadEmployees = useCallback(async () => {
    if (!profile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('person')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('aktiv', true)
        .order('fornavn');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  }, [profile?.org_id]);

  const loadProjectColors = useCallback(async () => {
    if (!profile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('project_color')
        .select('*')
        .eq('org_id', profile.org_id);

      if (error) throw error;
      
      const colorMap: Record<number, string> = {};
      data?.forEach((color: any) => {
        colorMap[color.tripletex_project_id] = color.hex;
      });
      
      setProjectColors(colorMap);
    } catch (error) {
      console.error('Error loading project colors:', error);
    }
  }, [profile?.org_id]);

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
      
      const calendarMap: Record<string, CalendarDay> = {};
      data?.forEach((day: any) => {
        calendarMap[day.dato] = day;
      });
      
      setCalendarDays(calendarMap);
    } catch (error) {
      console.error('Error loading calendar days:', error);
    }
  }, [profile?.org_id, allDates, toDateKey]);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user, loadUserProfile]);

  useEffect(() => {
    if (profile) {
      loadStaffingData();
      loadProjects();
      loadActivities();
      loadEmployees();
      loadProjectColors();
      loadCalendarDays();
    }
  }, [profile, startWeek, startYear, weeksToShow, loadStaffingData, loadProjects, loadActivities, loadEmployees, loadProjectColors, loadCalendarDays]);


  // Optimistic update helpers
  const updateStaffingDataOptimistically = (updateFn: (data: StaffingEntry[]) => StaffingEntry[]) => {
    setStaffingData(prev => updateFn(prev));
  };

  const revalidateInBackground = () => {
    setTimeout(() => loadStaffingData(true), 1000);
  };

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
          org_id: profile.org_id,
          tripletex_project_id: tripletexProjectId,
          hex: color
        }, {
          onConflict: 'org_id,tripletex_project_id'
        });

      if (error) throw error;
      
      setProjectColors(prev => ({ ...prev, [tripletexProjectId]: color }));
      
      // Count how many instances were updated
      const affectedEntries = staffingData.filter(entry => 
        entry.project?.tripletex_project_id === tripletexProjectId
      );
      
      // Optimistically update project colors  
      setProjectColors(prev => ({ ...prev, [tripletexProjectId]: color }));
      
      toast({
        title: "Prosjektfarge oppdatert",
        description: `Fargen er endret på ${affectedEntries.length} forekomster av prosjektet`
      });

      // Revalidate in background
      revalidateInBackground();
    } catch (error) {
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
          person: targetEmployee,
          date: targetDate,
          activities: sourceEntry.activities.map(a => ({ 
            ...a, 
            id: `temp-${Date.now()}-${Math.random()}` 
          }))
        };
        
        updateStaffingDataOptimistically(data => [...data, copiedEntry]);

        // Create new vakt for target person/date
        const { data: newVakt, error: vaktError } = await supabase
          .from('vakt')
          .insert({
            person_id: targetPersonId,
            project_id: sourceEntry.project?.id,
            dato: targetDate,
            org_id: profile.org_id
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
            ? { ...entry, person: targetEmployee, date: targetDate }
            : entry
        );
      });

      // Check if target already has a project for this date
      const existingTargetEntry = staffingData.find(e => 
        e.person.id === targetPersonId && 
        e.date === targetDate && 
        e.project
      );

      // Allow multiple projects per day - no restriction needed
      // if (existingTargetEntry && !shouldCopy) {
      //   toast({
      //     title: "Ansatt har allerede prosjekt", 
      //     description: "Denne ansatte har allerede et prosjekt på denne datoen. Prosjektet vil bli kopiert i stedet.",
      //     variant: "destructive"
      //   });
      //   return;
      // }

      // Create new vakt for target person/date
      const { data: newVakt, error: vaktError } = await supabase
        .from('vakt')
        .insert({
          person_id: targetPersonId,
          project_id: sourceEntry.project?.id || null,
          dato: targetDate,
          org_id: profile.org_id
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

  const assignProjectToPerson = async (projectId: string, personId: string, date: string) => {
    const previousData = [...staffingData];
    
    try {
      const person = employees.find(e => e.id === personId);
      const project = projects.find(p => p.id === projectId);
      
      // Check if person already has this project on this date
      const existingEntry = staffingData.find(e => 
        e.person.id === personId && 
        e.date === date && 
        e.project?.id === projectId
      );

      if (existingEntry) {
        toast({
          title: "Prosjekt finnes allerede",
          description: `${person ? getPersonDisplayName(person.fornavn, person.etternavn) : 'Ansatt'} har allerede ${project?.project_name} på ${new Date(date).toLocaleDateString('no-NO')}`,
          variant: "destructive"
        });
        return;
      }
      
      // Optimistically add/update the entry
      updateStaffingDataOptimistically(data => {
        const existingVakt = data.find(e => e.person.id === personId && e.date === date);
        
        if (existingVakt && !existingVakt.project) {
          // Update existing vakt that has no project
          return data.map(entry =>
            entry.id === existingVakt.id
              ? { ...entry, project }
              : entry
          );
        } else {
          // Add new entry
          const newEntry: StaffingEntry = {
            id: `temp-${Date.now()}`,
            date,
            person,
            project,
            activities: [],
            totalHours: 0,
            status: 'draft' as const
          };
          return [...data, newEntry];
        }
      });
      
      // Check if vakt already exists
      let vaktId = previousData.find(e => e.person.id === personId && e.date === date)?.id;
      
      if (!vaktId) {
        // Create new vakt
        const { data: newVakt, error } = await supabase
          .from('vakt')
          .insert({
            person_id: personId,
            project_id: projectId,
            dato: date,
            org_id: profile.org_id
          })
          .select()
          .single();

        if (error) throw error;
        vaktId = newVakt.id;
      } else {
        // Update existing vakt
        await supabase
          .from('vakt')
          .update({ project_id: projectId })
          .eq('id', vaktId);
      }

      toast({
        title: "Prosjekt tilordnet",
        description: "Prosjekt er tilordnet ansatt"
      });

      revalidateInBackground();
      setShowProjectSearch(null);
    } catch (error: unknown) {
      rollbackUpdate(previousData, error instanceof Error ? error.message : 'En ukjent feil oppstod');
    }
  };

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
      for (const activity of entry.activities) {
        const { data, error } = await supabase.functions.invoke('tripletex-api', {
          body: {
            action: 'send_timesheet_entry',
            vakt_timer_id: activity.id,
            employee_id: entry.person.tripletex_employee_id,
            project_id: entry.project.tripletex_project_id,
            activity_id: activity.ttx_activity_id || null,
            hours: activity.timer,
            date: entry.date,
            is_overtime: !!activity.is_overtime,
            description: activity.notat || '',
            orgId: profile.org_id
          }
        });

        if (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to send to Tripletex');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to send to Tripletex');
        }
      }

      toast({
        title: "Timer sendt til Tripletex",
        description: `${entry.activities.length} timer sendt for ${entry.project.project_name}`
      });

      revalidateInBackground(); // Refresh to show updated sync status
    } catch (error: unknown) {
      console.error('Error sending to Tripletex:', error);
      toast({
        title: "Feil ved sending til Tripletex",
        description: error instanceof Error ? error.message : "Ukjent feil oppstod",
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

  const recallFromTripletex = async (entry: StaffingEntry) => {
    try {
      for (const activity of entry.activities) {
        if (activity.tripletex_entry_id) {
          const { data, error } = await supabase.functions.invoke('tripletex-api', {
            body: {
              action: 'delete_timesheet_entry',
              tripletex_entry_id: activity.tripletex_entry_id,
              vakt_timer_id: activity.id,
              orgId: profile.org_id
            }
          });

          if (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to recall from Tripletex');
          }

          if (!data?.success) {
            throw new Error(data?.error || 'Failed to recall from Tripletex');
          }
        }
      }

      toast({
        title: "Timer kalt tilbake fra Tripletex",
        description: `${entry.activities.length} timer er nå tilbake til utkast-status og kan redigeres`
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
          orgId: profile.org_id
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
          description: "Velg timer som skal godkjennes",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('vakt_timer')
        .update({ 
          status: 'godkjent',
          approved_at: new Date().toISOString(),
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

  const getStatusBadge = (status: StaffingEntry['status']) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600 text-white text-xs p-1 h-5 w-5 rounded-full flex items-center justify-center font-bold">✓</Badge>;
      case 'sent':
        return <Badge className="bg-blue-600 text-white text-xs p-1 h-5 w-5 rounded-full flex items-center justify-center font-bold">→</Badge>;
      case 'ready':
        return <Badge className="bg-orange-500 text-white text-xs p-1 h-5 w-5 rounded-full flex items-center justify-center font-bold">!</Badge>;
      case 'draft':
        return <Badge variant="outline" className="text-xs p-1 h-5 w-5 rounded-full flex items-center justify-center">✎</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs p-1 h-5 w-5 rounded-full flex items-center justify-center">⚠</Badge>;
    }
  };

  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => 
    searchTerm === '' || 
    `${emp.fornavn} ${emp.etternavn}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Laster bemanningsdata...</div>
      </div>
    );
  }

  return (
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
          <Input
            placeholder="Søk ansatte..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
       <div className="text-sm text-muted-foreground px-3 py-2 bg-muted rounded">
         💡 Tips: Dra prosjekter mellom ansatte. Prosjekter med timer kopieres (bevarer original), tomme prosjekter flyttes. Hold Shift/Option for å alltid kopiere. Prosjekter sorteres etter nummer. Klikk på prosjekt for å endre farge.
       </div>
       
          <Button onClick={approveSelectedEntries} disabled={selectedEntries.size === 0}>
            <Check className="h-4 w-4 mr-1" />
            Godkjenn ({selectedEntries.size})
          </Button>
          <Button onClick={unapproveSelectedEntries} disabled={selectedEntries.size === 0} variant="outline">
            Trekk tilbake godkjenning ({selectedEntries.size})
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground px-3 py-2 bg-blue-50 rounded border border-blue-200">
          📋 Status-ikoner: ✓ Godkjent (grønn) | → Send til Tripletex (blå) | 🔄 Kall tilbake fra Tripletex (oransje) | ! Klar for godkjenning (oransje) | ✎ Utkast (grå) | ⚠ Feil ved synkronisering (rød) | ⚡ Overtid (gul) | 🗑️ Sletting blokkert for godkjente/sendte prosjekter
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
                        UKE {safeWeek.week}
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
                              <span>{getPersonDisplayName(employee.fornavn, employee.etternavn)}</span>
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
                               className={`border border-gray-300 p-1 min-h-[80px] min-w-[140px] relative group ${isEvenRow ? 'bg-white' : 'bg-gray-25'}`}
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
                              <div className="flex flex-col gap-1">
                                {dayEntries
                                  .sort((a, b) => {
                                    const aNum = a.project?.project_number || 999999;
                                    const bNum = b.project?.project_number || 999999;
                                    return aNum - bNum;
                                  })
                                  .map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="w-full p-2 text-xs font-medium text-white cursor-move rounded shadow-sm relative hover:shadow-lg transition-shadow group/project"
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
                                      {/* Only show delete button if not approved or sent to Tripletex */}
                                      {!entry.activities.some(a => a.status === 'godkjent' || a.status === 'sendt' || a.tripletex_synced_at) && (
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
                                      {/* Only show send button if approved and not already sent */}
                                      {entry.status === 'approved' && !entry.activities.some(a => a.tripletex_synced_at) && (
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
                                      {/* Show recall button if sent to Tripletex */}
                                      {entry.activities.some(a => a.tripletex_synced_at) && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            recallFromTripletex(entry);
                                          }}
                                          className="bg-orange-500 hover:bg-orange-600 text-white rounded-full p-1 shadow-md border border-white/20"
                                          title="Kall tilbake fra Tripletex"
                                        >
                                          <RefreshCw className="h-2 w-2" />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => handleProjectColorClick(entry.project, e)}
                                        className="bg-white rounded-full p-1 shadow-md border"
                                        title="Endre farge"
                                      >
                                        <Palette className="h-2 w-2 text-gray-600" />
                                      </button>
                                    </div>
                                     <div className="space-y-1">
                                       {/* Project name */}
                                       <div className="text-sm font-semibold leading-tight overflow-hidden" 
                                            style={{ 
                                              display: '-webkit-box',
                                              WebkitLineClamp: 2,
                                              WebkitBoxOrient: 'vertical',
                                              maxHeight: '2.5rem'
                                            }}>
                                         {entry.project?.project_name}
                                         {entry.activities.some(a => a.tripletex_synced_at) && (
                                           <span className="ml-1 text-xs">✓</span>
                                         )}
                                         {entry.activities.some(a => a.sync_error) && (
                                           <span className="ml-1 text-xs text-red-300" title={entry.activities.find(a => a.sync_error)?.sync_error}>⚠</span>
                                         )}
                                       </div>
                                       
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
                                    
                                    {/* Status indicator */}
                                    <div className="absolute -top-1 -left-1">
                                      {getStatusBadge(entry.status)}
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
            flexDirection: 'column !important', 
            padding: '0 !important'
          }}
        >
          <div className="flex-1 overflow-y-auto p-6" style={{ flex: '1 !important', overflowY: 'auto !important', padding: '1.5rem !important' }}>
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
                existingEntry={editDialog.existingEntry}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffingList;