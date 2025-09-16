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
import { getPersonDisplayName, generateProjectColor, getContrastColor, formatTimeValue } from '@/lib/displayNames';

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

interface StaffingListProps {
  week: number;
  year: number;
}

const StaffingList = ({ week, year }: StaffingListProps) => {
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
  
  // Get week dates
  const getWeekDates = () => {
    const startDate = new Date(year, 0, 1 + (week - 1) * 7);
    const firstMonday = new Date(startDate);
    const dayOffset = startDate.getDay() - 1;
    firstMonday.setDate(startDate.getDate() - dayOffset);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(firstMonday);
      date.setDate(firstMonday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

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
  }, [profile, week, year]);

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
      const dateStrings = weekDates.map(d => d.toISOString().split('T')[0]);
      
      const { data: vaktData, error } = await supabase
        .from('vakt')
        .select(`
          id,
          dato,
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

      // Transform data into Excel-like structure
      const transformedData: StaffingEntry[] = [];
      
      vaktData?.forEach(vakt => {
        const totalHours = vakt.vakt_timer.reduce((sum: number, timer: any) => sum + timer.timer, 0);
        
        // Determine status
        let status: StaffingEntry['status'] = 'missing';
        if (vakt.vakt_timer.length > 0) {
          const allApproved = vakt.vakt_timer.every((t: any) => t.status === 'godkjent');
          const allSent = vakt.vakt_timer.every((t: any) => t.status === 'sendt');
          
          if (allSent) status = 'sent';
          else if (allApproved) status = 'approved';
          else if (vakt.vakt_timer.some((t: any) => t.status === 'klar')) status = 'ready';
          else status = 'draft';
        }

        transformedData.push({
          id: vakt.id,
          date: vakt.dato,
          person: vakt.person,
          project: vakt.ttx_project_cache ? {
            id: vakt.ttx_project_cache.id,
            tripletex_project_id: vakt.ttx_project_cache.tripletex_project_id,
            project_name: vakt.ttx_project_cache.project_name,
            project_number: vakt.ttx_project_cache.project_number,
            color: projectColors[vakt.ttx_project_cache.tripletex_project_id]
          } : null,
          activities: vakt.vakt_timer.map((timer: any) => ({
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
            {profile?.org?.name} - Uke {week}, {year}
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

      {/* Excel-like table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left w-12">
                    <Checkbox
                      checked={selectedEntries.size === staffingData.length}
                      onCheckedChange={() => {
                        if (selectedEntries.size === staffingData.length) {
                          setSelectedEntries(new Set());
                        } else {
                          setSelectedEntries(new Set(staffingData.map(e => e.id)));
                        }
                      }}
                    />
                  </th>
                  <th className="p-3 text-left min-w-[200px]">Ansatt</th>
                  {weekDates.map(date => (
                    <th key={date.toISOString()} className="p-3 text-center min-w-[180px]">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {date.toLocaleDateString('no-NO', { weekday: 'short' })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {date.getDate()}.{date.getMonth() + 1}
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 text-center">Total</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(employee => {
                  const employeeEntries = staffingData.filter(e => e.person.id === employee.id);
                  const totalWeekHours = employeeEntries.reduce((sum, e) => sum + e.totalHours, 0);
                  
                  return (
                    <tr key={employee.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
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
                      </td>
                      <td className="p-3 font-medium">
                        {getPersonDisplayName(employee.fornavn, employee.etternavn)}
                      </td>
                      {weekDates.map(date => {
                        const dateStr = date.toISOString().split('T')[0];
                        const entry = employeeEntries.find(e => e.date === dateStr);
                        
                        return (
                          <td key={dateStr} className="p-2">
                            {entry ? (
                              <div className="space-y-1">
                                {entry.project && (
                                  <div
                                    className="text-xs px-2 py-1 rounded text-white font-medium cursor-move"
                                    style={{ backgroundColor: getProjectColor(entry.project.tripletex_project_id) }}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/plain', entry.id);
                                    }}
                                  >
                                    {entry.project.project_name}
                                  </div>
                                )}
                                <div className="text-sm font-medium">
                                  {formatTimeValue(entry.totalHours)} t
                                </div>
                                {entry.activities.map(activity => (
                                  <div key={activity.id} className="text-xs text-muted-foreground">
                                    {activity.activity_name} ({formatTimeValue(activity.timer)}t)
                                  </div>
                                ))}
                                {getStatusBadge(entry.status)}
                              </div>
                            ) : (
                              <div 
                                className="space-y-1 min-h-[60px] border-2 border-dashed border-muted-foreground/20 rounded p-2 flex items-center justify-center"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const entryId = e.dataTransfer.getData('text/plain');
                                  copyEntryToDate(entryId, dateStr);
                                }}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full h-8 text-xs"
                                  onClick={() => setShowProjectSearch({ date: dateStr, personId: employee.id })}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-center font-bold">
                        {formatTimeValue(totalWeekHours)} t
                      </td>
                      <td className="p-3 text-center">
                        {employeeEntries.length > 0 ? (
                          employeeEntries.every(e => e.status === 'approved') ? (
                            <Badge className="bg-green-500">✓ OK</Badge>
                          ) : employeeEntries.some(e => e.status === 'missing') ? (
                            <Badge variant="secondary">⚠ Mangler</Badge>
                          ) : (
                            <Badge variant="outline">✎ Pågår</Badge>
                          )
                        ) : (
                          <Badge variant="secondary">⚠ Mangler</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Project Search Dialog */}
      {showProjectSearch && (
        <Dialog open={!!showProjectSearch} onOpenChange={() => setShowProjectSearch(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Velg prosjekt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Søk prosjekter..."
                className="w-full"
              />
              <div className="max-h-64 overflow-y-auto space-y-2">
                {projects.map(project => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-muted/50"
                    onClick={() => assignProjectToPerson(
                      project.id, // Use the UUID, not tripletex_project_id
                      showProjectSearch.personId, 
                      showProjectSearch.date
                    )}
                  >
                    <div>
                      <div className="font-medium">{project.project_name}</div>
                      <div className="text-sm text-muted-foreground">#{project.project_number}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: getProjectColor(project.tripletex_project_id) }}
                      />
                      <input
                        type="color"
                        value={getProjectColor(project.tripletex_project_id)}
                        onChange={(e) => setProjectColor(project.tripletex_project_id, e.target.value)}
                        className="w-6 h-6 rounded border-none cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default StaffingList;