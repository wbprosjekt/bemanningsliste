import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle, 
  Send, 
  Search, 
  Filter,
  Calendar,
  User,
  MessageSquare,
  Paperclip,
  RefreshCw
} from 'lucide-react';
import { getPersonDisplayName, formatTimeValue } from '@/lib/displayNames';

interface TimerEntry {
  id: string;
  timer: number;
  notat: string | null;
  status: string;
  lonnstype: string;
  kilde: string;
  tripletex_entry_id: number | null;
  created_at: string;
  vakt: {
    dato: string;
    person: {
      fornavn: string;
      etternavn: string;
    };
    ttx_project_cache: {
      project_name: string;
      project_number: number;
    } | null;
  };
  ttx_activity_cache: {
    navn: string;
  } | null;
}

const AdminTimer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [timerEntries, setTimerEntries] = useState<TimerEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      loadTimerEntries();
    }
  }, [profile, filters]);

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

  const loadTimerEntries = async () => {
    if (!profile?.org_id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('vakt_timer')
        .select(`
          id,
          timer,
          notat,
          status,
          lonnstype,
          kilde,
          tripletex_entry_id,
          created_at,
          vakt:vakt_id (
            dato,
            person:person_id (
              fornavn,
              etternavn
            ),
            ttx_project_cache:project_id (
              project_name,
              project_number
            )
          ),
          ttx_activity_cache:aktivitet_id (
            navn
          )
        `)
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.dateFrom) {
        query = query.gte('vakt.dato', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('vakt.dato', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Apply search filter on client side for complex text matching
      let filteredData = data || [];
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredData = filteredData.filter(entry =>
          entry.vakt?.person?.fornavn?.toLowerCase().includes(searchTerm) ||
          entry.vakt?.person?.etternavn?.toLowerCase().includes(searchTerm) ||
          entry.vakt?.ttx_project_cache?.project_name?.toLowerCase().includes(searchTerm) ||
          entry.ttx_activity_cache?.navn?.toLowerCase().includes(searchTerm) ||
          entry.notat?.toLowerCase().includes(searchTerm)
        );
      }

      setTimerEntries(filteredData);
    } catch (error) {
      console.error('Error loading timer entries:', error);
      toast({
        title: "Feil ved lasting av timer",
        description: "Kunne ikke laste timelister.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleEntrySelection = (entryId: string) => {
    const newSelection = new Set(selectedEntries);
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId);
    } else {
      newSelection.add(entryId);
    }
    setSelectedEntries(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedEntries.size === timerEntries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(timerEntries.map(entry => entry.id)));
    }
  };

  const markAsApproved = async () => {
    if (selectedEntries.size === 0) return;

    setActionLoading({ ...actionLoading, approve: true });
    try {
      const { error } = await supabase
        .from('vakt_timer')
        .update({ status: 'godkjent' })
        .in('id', Array.from(selectedEntries))
        .eq('org_id', profile.org_id);

      if (error) throw error;

      toast({
        title: "Timer godkjent",
        description: `${selectedEntries.size} timer ble markert som godkjent.`
      });

      setSelectedEntries(new Set());
      loadTimerEntries();
    } catch (error: any) {
      toast({
        title: "Godkjenning feilet",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setActionLoading({ ...actionLoading, approve: false });
    }
  };

  const sendToTripletex = async () => {
    if (selectedEntries.size === 0) return;

    setActionLoading({ ...actionLoading, export: true });
    try {
      // Get selected entries with full data needed for export
      const selectedTimerEntries = timerEntries.filter(entry => 
        selectedEntries.has(entry.id) && 
        (entry.status === 'godkjent' || entry.status === 'klar')
      );

      if (selectedTimerEntries.length === 0) {
        toast({
          title: "Ingen gyldige timer",
          description: "Kun timer med status 'godkjent' eller 'klar' kan sendes til Tripletex.",
          variant: "destructive"
        });
        return;
      }

      // Prepare timesheet entries for export
      const timesheetEntries = selectedTimerEntries.map(entry => ({
        id: entry.id,
        employeeId: 1, // TODO: Map from person to Tripletex employee ID
        projectId: entry.vakt?.ttx_project_cache?.project_number || 1, // TODO: Use actual Tripletex project ID
        activityId: 1, // TODO: Map from ttx_activity_cache
        date: entry.vakt?.dato,
        hours: entry.timer,
        comment: entry.notat || ''
      }));

      const { data, error } = await supabase.functions.invoke('tripletex-api', {
        body: { 
          action: 'export-timesheet',
          orgId: profile.org_id,
          timesheetEntries 
        }
      });

      if (error) throw error;

      const results = data?.data?.results || [];
      const successful = results.filter((r: any) => r.success);
      const failed = results.filter((r: any) => !r.success);

      if (successful.length > 0) {
        toast({
          title: "Eksport fullført",
          description: `${successful.length} timer ble sendt til Tripletex.`
        });
      }

      if (failed.length > 0) {
        const periodLockedErrors = failed.filter((r: any) => r.errorType === 'period_locked');
        
        if (periodLockedErrors.length > 0) {
          toast({
            title: "Periode låst i Tripletex",
            description: "Noen timer kunne ikke sendes fordi perioden er låst - kontakt lønn.",
            variant: "destructive"
          });
        }

        if (failed.length > periodLockedErrors.length) {
          toast({
            title: "Noen timer feilet",
            description: `${failed.length - periodLockedErrors.length} timer kunne ikke sendes på grunn av feil.`,
            variant: "destructive"
          });
        }
      }

      setSelectedEntries(new Set());
      loadTimerEntries();
    } catch (error: any) {
      toast({
        title: "Eksport til Tripletex feilet",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setActionLoading({ ...actionLoading, export: false });
    }
  };

  const getStatusBadge = (status: string, tripletexId?: number | null) => {
    switch (status) {
      case 'godkjent':
        return <Badge className="bg-green-500">🟢 Godkjent</Badge>;
      case 'sendt':
        return <Badge className="bg-blue-500">🔵 Sendt {tripletexId ? `(#${tripletexId})` : ''}</Badge>;
      case 'klar':
        return <Badge className="bg-orange-500">🟠 Klar</Badge>;
      default:
        return <Badge variant="outline">📝 Kladd</Badge>;
    }
  };

  const getKildeBadge = (kilde: string) => {
    return kilde === 'tripletex' ? 
      <Badge variant="secondary">Tripletex</Badge> : 
      <Badge variant="outline">Intern</Badge>;
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Laster...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Timer - Godkjenning</h1>
            <p className="text-muted-foreground mt-1">
              {profile.org?.name} - Administrer og godkjenn timelister
            </p>
          </div>
          <Button onClick={loadTimerEntries} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Oppdater
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtre og søk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Søk</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="Søk i ansatt, prosjekt, aktivitet..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="all">Alle statuser</SelectItem>
                    <SelectItem value="utkast">Kladd</SelectItem>
                    <SelectItem value="klar">Klar</SelectItem>
                    <SelectItem value="godkjent">Godkjent</SelectItem>
                    <SelectItem value="sendt">Sendt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fra dato</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Til dato</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mass Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {selectedEntries.size} av {timerEntries.length} timer valgt
                </span>
                {selectedEntries.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      onClick={markAsApproved}
                      disabled={actionLoading.approve}
                      size="sm"
                    >
                      {actionLoading.approve ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Merk som godkjent
                    </Button>
                    <Button
                      onClick={sendToTripletex}
                      disabled={actionLoading.export}
                      size="sm"
                      variant="outline"
                    >
                      {actionLoading.export ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send til Tripletex
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timer Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Laster timer...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                    <Checkbox
                      checked={selectedEntries.size === timerEntries.length && timerEntries.length > 0}
                      onCheckedChange={toggleAllSelection}
                    />
                    </TableHead>
                    <TableHead>Ansatt</TableHead>
                    <TableHead>Dato</TableHead>
                    <TableHead>Prosjekt</TableHead>
                    <TableHead>Aktivitet</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Timer</TableHead>
                    <TableHead>Notat</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Kilde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timerEntries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Checkbox
                          checked={selectedEntries.has(entry.id)}
                          onCheckedChange={() => toggleEntrySelection(entry.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {entry.vakt?.person ? 
                            getPersonDisplayName(entry.vakt.person.fornavn, entry.vakt.person.etternavn) :
                            'Ukjent'
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {entry.vakt?.dato ? 
                            new Date(entry.vakt.dato).toLocaleDateString('no-NO') :
                            'Ukjent'
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.vakt?.ttx_project_cache ? 
                          `${entry.vakt.ttx_project_cache.project_number} - ${entry.vakt.ttx_project_cache.project_name}` :
                          'Ikke tilordnet'
                        }
                      </TableCell>
                      <TableCell>
                        {entry.ttx_activity_cache?.navn || 'Ingen aktivitet'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.lonnstype}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatTimeValue(entry.timer)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {entry.notat && (
                            <>
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm truncate max-w-32" title={entry.notat}>
                                {entry.notat}
                              </span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(entry.status, entry.tripletex_entry_id)}
                      </TableCell>
                      <TableCell>
                        {getKildeBadge(entry.kilde)}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {timerEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        Ingen timer funnet med gjeldende filtre.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminTimer;