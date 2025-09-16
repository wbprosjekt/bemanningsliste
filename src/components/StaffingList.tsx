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
  Download
} from 'lucide-react';
import { getPersonDisplayName, generateProjectColor, getContrastColor, formatTimeValue, getWeekNumber } from '@/lib/displayNames';
import ProjectSearchDialog from './ProjectSearchDialog';

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
  
  // Get multiple weeks of data
  const getMultipleWeeksData = (): WeekData[] => {
    const weeks: WeekData[] = [];
    let currentWeek = startWeek;
    let currentYear = startYear;
    
    for (let i = 0; i < weeksToShow; i++) {
      // Calculate week dates
      const startDate = new Date(currentYear, 0, 1 + (currentWeek - 1) * 7);
      const firstMonday = new Date(startDate);
      const dayOffset = startDate.getDay() - 1;
      firstMonday.setDate(startDate.getDate() - dayOffset);
      
      const dates = [];
      for (let j = 0; j < 7; j++) {
        const date = new Date(firstMonday);
        date.setDate(firstMonday.getDate() + j);
        dates.push(date);
      }
      
      weeks.push({
        week: currentWeek,
        year: currentYear,
        dates
      });
      
      // Move to next week
      currentWeek++;
      if (currentWeek > 52) {
        // Check if year actually has 53 weeks
        const lastWeekOfYear = getWeekNumber(new Date(currentYear, 11, 31));
        if (currentWeek > lastWeekOfYear) {
          currentYear++;
          currentWeek = 1;
        }
      }
    }
    
    return weeks;
  };

  const multiWeekData = getMultipleWeeksData();
  const allDates = multiWeekData.flatMap(w => w.dates);

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
      const dateStrings = allDates.map(d => d.toISOString().split('T')[0]);
      
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
          const dateStr = date.toISOString().split('T')[0];
          
          // Find existing vakt for this employee/date
          const existingVakt = vaktData?.find(v => 
            v.person_id === employee.id && v.dato === dateStr
          );

          if (existingVakt) {
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
      toast({
        title: "Farge oppdatert",
        description: "Prosjektfargen er oppdatert"
      });
    } catch (error) {
      toast({
        title: "Feil ved oppdatering",
        description: "Kunne ikke oppdatere prosjektfarge",
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
        return <Badge className="bg-green-500">✓ Godkjent</Badge>;
      case 'sent':
        return <Badge className="bg-blue-500">→ Sendt</Badge>;
      case 'ready':
        return <Badge className="bg-orange-500">! Klar</Badge>;
      case 'draft':
        return <Badge variant="outline">✎ Utkast</Badge>;
      default:
        return <Badge variant="secondary">⚠ Mangler</Badge>;
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
                    {weekData.dates.map(date => (
                      <th key={date.toISOString()} className="border border-gray-300 p-2 text-center min-w-[140px] font-bold">
                        <div className="space-y-1">
                          <div className="text-xs uppercase font-semibold">
                            {date.toLocaleDateString('no-NO', { weekday: 'long' })}
                          </div>
                          <div className="text-sm">
                            {date.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
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
                      weekData.dates.some(d => d.toISOString().split('T')[0] === e.date)
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
                        {weekData.dates.map(date => {
                          const dateStr = date.toISOString().split('T')[0];
                          const entry = employeeEntries.find(e => e.date === dateStr);
                          
                          return (
                            <td 
                              key={dateStr} 
                              className="border border-gray-300 p-1 h-16 min-w-[140px] relative group"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const draggedEntryId = e.dataTransfer.getData('text/plain');
                                if (draggedEntryId && draggedEntryId !== entry?.id) {
                                  copyEntryToDate(draggedEntryId, dateStr);
                                }
                              }}
                            >
                              {entry?.project ? (
                                <div
                                  className="w-full h-full p-2 text-xs font-medium text-white cursor-move rounded shadow-sm relative"
                                  style={{ 
                                    backgroundColor: getProjectColor(entry.project.tripletex_project_id),
                                    color: getContrastColor(getProjectColor(entry.project.tripletex_project_id))
                                  }}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', entry.id);
                                  }}
                                  onClick={() => {
                                    // TODO: Open project details/edit dialog
                                  }}
                                >
                                  <div className="font-semibold truncate">
                                    {entry.project.project_name}
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
                                </div>
                              ) : (
                                <div 
                                  className="w-full h-full border-2 border-dashed border-gray-200 rounded opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer hover:border-blue-300"
                                  onClick={() => setShowProjectSearch({ date: dateStr, personId: employee.id })}
                                >
                                  <Plus className="h-4 w-4 text-gray-400" />
                                </div>
                              )}
                              
                              {/* Status indicator */}
                              {entry && (
                                <div className="absolute -top-1 -right-1">
                                  {getStatusBadge(entry.status)}
                                </div>
                              )}
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