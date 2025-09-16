import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  X
} from 'lucide-react';
import { getPersonDisplayName, generateProjectColor, getContrastColor, formatTimeValue, getWeekNumber } from '@/lib/displayNames';
import ProjectSearchDialog from './ProjectSearchDialog';
import ColorPickerDialog from './ColorPickerDialog';
import { startOfISOWeek, addWeeks, addDays, isValid as isValidDate, format as formatDate } from 'date-fns';

interface StaffingEntry {
  id: string;
  date: string;
  person: {
    id: string;
    fornavn: string;
    etternavn: string;
    forventet_dagstimer: number;
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
  }>;
  totalHours: number;
  status: 'missing' | 'draft' | 'ready' | 'approved' | 'sent';
}

interface WeekData {
  week: number;
  year: number;
  dates: Date[];
}

interface StaffingListProps {
  startWeek: number;
  startYear: number;
  weeksToShow?: number;
}

const StaffingList = ({ startWeek, startYear, weeksToShow = 6 }: StaffingListProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<any>(null);
  const [staffingData, setStaffingData] = useState<StaffingEntry[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [projectColors, setProjectColors] = useState<Record<number, string>>({});
  const [employees, setEmployees] = useState<any[]>([]);
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

  const toDateKey = (d: Date): string => {
    try {
      if (!isValidDate(d)) return '';
      return formatDate(d, 'yyyy-MM-dd');
    } catch (error) {
      console.error('Error formatting date:', error, d);
      return '';
    }
  };
  // Get multiple weeks of data with robust date handling
  const getMultipleWeeksData = (): WeekData[] => {
    const weeks: WeekData[] = [];
    let currentWeek = Math.max(1, Math.min(53, startWeek)); // Clamp week to valid range
    let currentYear = Math.max(1970, Math.min(3000, startYear)); // Clamp year to reasonable range
    
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

  const multiWeekData = getMultipleWeeksData();
  const allDates = multiWeekData.flatMap(w => w.dates).filter(d => d instanceof Date && !isNaN(d.getTime()));

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      loadStaffingData();
      loadProjects();
      loadActivities();
      loadEmployees();
      loadProjectColors();
      loadCalendarDays();
    }
  }, [profile, startWeek, startYear, weeksToShow]);

  const loadUserProfile = async () => {
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
  };

  const loadStaffingData = async () => {
    if (!profile?.org_id) return;

    setLoading(true);
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
            forventet_dagstimer
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
            ttx_activity_cache:aktivitet_id (
              navn
            )
          )
        `)
        .eq('org_id', profile.org_id)
        .in('dato', dateStrings);

      if (error) throw error;

      // Create entries for ALL employees for ALL days (Excel-style)
      const transformedData: StaffingEntry[] = [];
      
      allEmployees?.forEach(employee => {
        allDates.forEach(date => {
          const dateStr = toDateKey(date);
          if (!dateStr) return;
          
          // Find all vakter for this employee/date
          const matchingVakts = (vaktData || []).filter(v => 
            v.person_id === employee.id && v.dato === dateStr
          );

          if (matchingVakts.length > 0) {
            matchingVakts.forEach(existingVakt => {
              // Use existing data
              const totalHours = existingVakt.vakt_timer.reduce((sum: number, timer: any) => sum + timer.timer, 0);
              
              let status: StaffingEntry['status'] = 'missing';
              if (existingVakt.vakt_timer.length > 0) {
                const allApproved = existingVakt.vakt_timer.every((t: any) => t.status === 'godkjent');
                const allSent = existingVakt.vakt_timer.every((t: any) => t.status === 'sendt');
                
                if (allSent) status = 'sent';
                else if (allApproved) status = 'approved';
                else if (existingVakt.vakt_timer.some((t: any) => t.status === 'klar')) status = 'ready';
                else status = 'draft';
              }

              transformedData.push({
                id: existingVakt.id,
                date: dateStr,
                person: {
                  id: employee.id,
                  fornavn: employee.fornavn,
                  etternavn: employee.etternavn,
                  forventet_dagstimer: employee.forventet_dagstimer || 8
                },
                project: existingVakt.ttx_project_cache ? {
                  id: existingVakt.ttx_project_cache.id,
                  tripletex_project_id: existingVakt.ttx_project_cache.tripletex_project_id,
                  project_name: existingVakt.ttx_project_cache.project_name,
                  project_number: existingVakt.ttx_project_cache.project_number,
                  color: projectColors[existingVakt.ttx_project_cache.tripletex_project_id]
                } : null,
                activities: existingVakt.vakt_timer.map((timer: any) => ({
                  id: timer.id,
                  timer: timer.timer,
                  status: timer.status,
                  activity_name: timer.ttx_activity_cache?.navn || 'Ingen aktivitet',
                  lonnstype: timer.lonnstype,
                  notat: timer.notat
                })),
                totalHours,
                status
              });
            });
          } else {
            // Create empty entry for employee/date combination
            transformedData.push({
              id: `empty-${employee.id}-${dateStr}`,
              date: dateStr,
              person: {
                id: employee.id,
                fornavn: employee.fornavn,
                etternavn: employee.etternavn,
                forventet_dagstimer: employee.forventet_dagstimer || 8
              },
              project: null,
              activities: [],
              totalHours: 0,
              status: 'missing'
            });
          }
        });
      });

      setStaffingData(transformedData);
    } catch (error) {
      console.error('Error loading staffing data:', error);
      toast({
        title: "Feil ved lasting",
        description: "Kunne ikke laste bemanningsdata",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    if (!profile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('ttx_project_cache')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .order('project_name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadActivities = async () => {
    if (!profile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('ttx_activity_cache')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('aktiv', true)
        .order('navn');

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const loadEmployees = async () => {
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
  };

  const loadProjectColors = async () => {
    if (!profile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('project_color')
        .select('*')
        .eq('org_id', profile.org_id);

      if (error) throw error;
      
      const colorMap: Record<number, string> = {};
      data?.forEach(color => {
        colorMap[color.tripletex_project_id] = color.hex;
      });
      setProjectColors(colorMap);
    } catch (error) {
      console.error('Error loading project colors:', error);
    }
  };

  const loadCalendarDays = async () => {
    try {
      const dateStrings = allDates.map(toDateKey).filter(Boolean);
      if (dateStrings.length === 0) {
        console.warn('No valid dates generated for calendar query');
        setCalendarDays({});
        return;
      }
      const { data, error } = await supabase
        .from('kalender_dag')
        .select('dato, is_weekend, is_holiday')
        .in('dato', dateStrings);

      if (error) throw error;

      const map: Record<string, { isWeekend: boolean; isHoliday: boolean }> = {};
      data?.forEach((d: any) => {
        map[d.dato] = { isWeekend: d.is_weekend, isHoliday: d.is_holiday };
      });
      setCalendarDays(map);
    } catch (error) {
      console.error('Error loading calendar days:', error);
    }
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
      
      toast({
        title: "Prosjektfarge oppdatert",
        description: `Fargen er endret på ${affectedEntries.length} forekomster av prosjektet`
      });

      // Reload data to reflect color changes
      loadStaffingData();
    } catch (error) {
      toast({
        title: "Feil ved oppdatering",
        description: "Kunne ikke oppdatere prosjektfarge",
        variant: "destructive"
      });
    }
  };

  const handleProjectColorClick = (project: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drag from starting
    setShowColorPicker({
      projectName: project.project_name,
      projectNumber: project.project_number,
      tripletexProjectId: project.tripletex_project_id,
      currentColor: getProjectColor(project.tripletex_project_id)
    });
  };

  const deleteEntry = async (entryId: string) => {
    try {
      const entry = staffingData.find(e => e.id === entryId);
      if (!entry) return;

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

      loadStaffingData();
    } catch (error: any) {
      toast({
        title: "Sletting feilet",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const copyEntryToDate = async (entryId: string, targetDate: string) => {
    try {
      const sourceEntry = staffingData.find(e => e.id === entryId);
      if (!sourceEntry) return;

      // Create new vakt for target date
      const { data: newVakt, error: vaktError } = await supabase
        .from('vakt')
        .insert({
          person_id: sourceEntry.person.id,
          project_id: sourceEntry.project?.id || null,
          dato: targetDate,
          org_id: profile.org_id
        })
        .select()
        .single();

      if (vaktError) throw vaktError;

      // Copy activities
      for (const activity of sourceEntry.activities) {
        await supabase
          .from('vakt_timer')
          .insert({
            vakt_id: newVakt.id,
            org_id: profile.org_id,
            timer: activity.timer,
            aktivitet_id: activities.find(a => a.navn === activity.activity_name)?.id,
            lonnstype: activity.lonnstype,
            notat: activity.notat,
            status: 'utkast'
          });
      }

      toast({
        title: "Kopiert til ny dag",
        description: `Timeføring kopiert til ${new Date(targetDate).toLocaleDateString('no-NO')}`
      });

      loadStaffingData();
    } catch (error: any) {
      toast({
        title: "Kopiering feilet",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const moveEntryToEmployeeAndDate = async (entryId: string, targetPersonId: string, targetDate: string, shouldCopy: boolean = false) => {
    try {
      const sourceEntry = staffingData.find(e => e.id === entryId);
      if (!sourceEntry) return;

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

      // Copy activities
      for (const activity of sourceEntry.activities) {
        await supabase
          .from('vakt_timer')
          .insert({
            vakt_id: newVakt.id,
            org_id: profile.org_id,
            timer: activity.timer,
            aktivitet_id: activities.find(a => a.navn === activity.activity_name)?.id,
            lonnstype: activity.lonnstype,
            notat: activity.notat,
            status: 'utkast'
          });
      }

      // If moving (not copying), remove the original entry
      if (!shouldCopy && sourceEntry.id.indexOf('empty-') !== 0) {
        // Delete original activities
        if (sourceEntry.activities.length > 0) {
          const activityIds = sourceEntry.activities.map(a => a.id);
          await supabase
            .from('vakt_timer')
            .delete()
            .in('id', activityIds);
        }

        // Delete original vakt
        await supabase
          .from('vakt')
          .delete()
          .eq('id', sourceEntry.id);
      }

      const targetEmployee = employees.find(e => e.id === targetPersonId);
      const action = shouldCopy ? "kopiert til" : "flyttet til";
      
      toast({
        title: `Prosjekt ${action}`,
        description: `${sourceEntry.project?.project_name} ${action} ${targetEmployee ? getPersonDisplayName(targetEmployee.fornavn, targetEmployee.etternavn) : 'ukjent ansatt'} på ${new Date(targetDate).toLocaleDateString('no-NO')}`
      });

      loadStaffingData();
    } catch (error: any) {
      toast({
        title: "Operasjon feilet",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const assignProjectToPerson = async (projectId: string, personId: string, date: string) => {
    try {
      // Check if vakt already exists
      let vaktId = staffingData.find(e => e.person.id === personId && e.date === date)?.id;
      
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

      loadStaffingData();
      setShowProjectSearch(null);
    } catch (error: any) {
      toast({
        title: "Tilordning feilet",
        description: error.message,
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

      const { error } = await supabase
        .from('vakt_timer')
        .update({ status: 'godkjent' })
        .in('id', timerIds);

      if (error) throw error;

      toast({
        title: "Timer godkjent",
        description: `${entryIds.length} oppføringer godkjent`
      });

      setSelectedEntries(new Set());
      loadStaffingData();
    } catch (error: any) {
      toast({
        title: "Godkjenning feilet",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: StaffingEntry['status']) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500 text-xs p-1 h-5 w-5 rounded-full flex items-center justify-center">✓</Badge>;
      case 'sent':
        return <Badge className="bg-blue-500 text-xs p-1 h-5 w-5 rounded-full flex items-center justify-center">→</Badge>;
      case 'ready':
        return <Badge className="bg-orange-500 text-xs p-1 h-5 w-5 rounded-full flex items-center justify-center">!</Badge>;
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
            {profile?.org?.name} - Uker {startWeek}-{multiWeekData[multiWeekData.length - 1].week}, {startYear}
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
            💡 Tips: Dra prosjekter mellom ansatte. Hold Shift for å kopiere. Klikk på prosjekt for å endre farge.
          </div>
          <Button onClick={approveSelectedEntries} disabled={selectedEntries.size === 0}>
            <Check className="h-4 w-4 mr-1" />
            Godkjenn ({selectedEntries.size})
          </Button>
        </div>
      </div>

      {/* Multi-week Excel-like table */}
      <div className="space-y-8">
        {multiWeekData.map(weekData => (
          <div key={`${weekData.year}-${weekData.week}`} className="border rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-gray-300 p-2 text-left font-bold w-40 bg-slate-200">
                      UKE {weekData.week}
                    </th>
                     {weekData.dates.map((date, idx) => (
                       <th key={toDateKey(date) || `${weekData.year}-${weekData.week}-${idx}`} className="border border-gray-300 p-2 text-center min-w-[140px] font-bold">
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
                  {employees.map(employee => {
                    const employeeEntries = staffingData.filter(e => 
                      e.person.id === employee.id && 
                      weekData.dates.some(d => toDateKey(d) === e.date)
                    );
                    
                    return (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3 font-medium bg-slate-50 sticky left-0">
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
                        {weekData.dates.map((date, idx) => {
                          const dateStr = toDateKey(date);
                          const dayEntries = employeeEntries.filter(e => e.date === dateStr && e.project);
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6; // Sunday = 0, Saturday = 6
                          const isHoliday = calendarDays[dateStr]?.isHoliday || false;
                          const isFreeDay = isWeekend || isHoliday;
                          
                          return (
                            <td 
                              key={dateStr || `${employee.id}-${weekData.week}-${idx}`} 
                              className="border border-gray-300 p-1 min-h-[80px] min-w-[140px] relative group"
                              data-employee-id={employee.id}
                              data-date={dateStr}
                              onDragOver={(e) => {
                                e.preventDefault();
                                // Indicate copy vs move while dragging
                                try {
                                  e.dataTransfer.dropEffect = e.shiftKey ? 'copy' : 'move';
                                } catch {}
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
                                  
                                  if (isSamePerson) {
                                    // Same person, different date - copy to new date
                                    copyEntryToDate(draggedEntryId, dateStr);
                                  } else {
                                    // Different person - move or copy
                                    moveEntryToEmployeeAndDate(draggedEntryId, employee.id, dateStr, intendsCopy);
                                  }
                                }
                              }}
                            >
                              {isFreeDay && (
                                <div className="absolute inset-0 bg-red-500/10 pointer-events-none rounded-sm" />
                              )}
                              <div className="flex flex-col gap-1">
                                {dayEntries.map((entry) => (
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
                                    onClick={(e) => handleProjectColorClick(entry.project, e)}
                                    title={`${entry.project?.project_name}\n${formatTimeValue(entry.totalHours)} timer\nKlikk for å endre farge\nHold Shift og dra for å kopiere`}
                                  >
                                    {/* Action icons overlay */}
                                    <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover/project:opacity-100 transition-opacity">
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
                                      <button
                                        onClick={(e) => handleProjectColorClick(entry.project, e)}
                                        className="bg-white rounded-full p-1 shadow-md border"
                                        title="Endre farge"
                                      >
                                        <Palette className="h-2 w-2 text-gray-600" />
                                      </button>
                                    </div>
                                    <div className="font-semibold truncate">
                                      {entry.project?.project_name}
                                    </div>
                                    {entry.totalHours > 0 && (
                                      <div className="text-xs opacity-90">
                                        {formatTimeValue(entry.totalHours)} t
                                      </div>
                                    )}
                                    {entry.activities.length > 0 && (
                                      <div className="text-xs opacity-75 truncate">
                                        {entry.activities[0].activity_name}
                                      </div>
                                    )}
                                    
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
        ))}
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
        onProjectAssigned={loadStaffingData}
      />
    </div>
  );
};

export default StaffingList;