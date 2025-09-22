import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
  RefreshCw,
  Download,
  FileText,
  AlertTriangle
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timerEntries, setTimerEntries] = useState<TimerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });
  const [dryRunMode, setDryRunMode] = useState(false);
  const [periodLockBanner, setPeriodLockBanner] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user, loadUserProfile]);

  useEffect(() => {
    if (profile) {
      loadTimerEntries();
    }
  }, [profile, filters, loadTimerEntries]);

  const loadUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, org:org_id (id, name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [user]);

  const loadTimerEntries = useCallback(async () => {
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
  }, [profile?.org_id, filters, toast]);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user, loadUserProfile]);

  useEffect(() => {
    if (profile) {
      loadTimerEntries();
    }
  }, [profile, filters, loadTimerEntries]);

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

      // Get vakt IDs from selected entries
      const vaktIds = selectedTimerEntries
        .map(e => {
          // Extract vakt ID from the vakt object structure
          if (typeof e.vakt === 'object' && e.vakt !== null) {
            // The vakt object should have an id property or we need to find it differently
            return (e.vakt as any).id;
          }
          return null;
        })
        .filter(id => id !== null);

      // Get person mappings for vakt entries
      const { data: vaktData } = await supabase
        .from('vakt')
        .select('id, person_id')
        .in('id', vaktIds)
        .eq('org_id', profile.org_id);

      const vaktToPersonMap = new Map(vaktData?.map(v => [v.id, v.person_id]) || []);

      // Prepare timesheet entries for export with proper mapping
      const timesheetEntries = selectedTimerEntries.map(entry => {
        const vaktId = (entry.vakt as any)?.id;
        const personId = vaktToPersonMap.get(vaktId) || '';
        
        return {
          id: entry.id,
          personId: personId,
          projectId: entry.vakt?.ttx_project_cache?.project_number || '',
          activityId: entry.ttx_activity_cache ? (entry.ttx_activity_cache as any).ttx_id || '' : '',
          date: entry.vakt?.dato,
          hours: entry.timer,
          comment: entry.notat || '',
          clientReference: `${profile.org_id}-${entry.id}` // Idempotency key
        };
      });

      const requestBody = { 
        action: 'export-timesheet',
        orgId: profile.org_id,
        timesheetEntries,
        dryRun: dryRunMode
      };

      if (dryRunMode) {
        console.log('Dry-run mode - would send:', requestBody);
        toast({
          title: "Dry-run utført",
          description: `Ville sendt ${selectedTimerEntries.length} timer til Tripletex (ingen data sendt)`,
        });
        setSelectedEntries(new Set());
        return;
      }

      const { data, error } = await supabase.functions.invoke('tripletex-api', {
        body: requestBody
      });

      if (error) throw error;

      const results = data?.data?.results || [];
      const successful = results.filter((r: any) => r.success);
      const failed = results.filter((r: any) => !r.success);

      // Handle period locked errors
      const periodLockedErrors = failed.filter((r: any) => 
        r.errorType === 'period_locked' || r.error?.includes('period is locked')
      );
      
      if (periodLockedErrors.length > 0) {
        // Don't change status for period locked entries
        const firstPeriodError = periodLockedErrors[0];
        const weekInfo = firstPeriodError.weekNumber || 'ukjent';
        setPeriodLockBanner(`Uke ${weekInfo} er låst i Tripletex – åpne perioden i Tripletex for å eksportere timer.`);
        
        toast({
          title: "Periode låst i Tripletex",
          description: `${periodLockedErrors.length} timer kunne ikke sendes fordi perioden er låst`,
          variant: "destructive"
        });
      }

      if (successful.length > 0) {
        toast({
          title: "Eksport fullført",
          description: `${successful.length} timer ble sendt til Tripletex.`
        });
      }

      if (failed.length > periodLockedErrors.length) {
        toast({
          title: "Noen timer feilet",
          description: `${failed.length - periodLockedErrors.length} timer kunne ikke sendes på grunn av andre feil.`,
          variant: "destructive"
        });
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

  const checkTripletexStatus = async (entryId: string) => {
    try {
      const entry = timerEntries.find(e => e.id === entryId);
      if (!entry?.tripletex_entry_id) {
        toast({
          title: "Ingen Tripletex ID",
          description: "Denne oppføringen har ikke blitt sendt til Tripletex ennå",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('tripletex-api', {
        body: { 
          action: 'verify-timesheet-entry',
          orgId: profile.org_id,
          tripletexEntryId: entry.tripletex_entry_id
        }
      });

      if (error) throw error;

      if (data?.exists) {
        toast({
          title: "Status bekreftet",
          description: `Oppføringen eksisterer i Tripletex (ID: ${entry.tripletex_entry_id})`
        });
      } else {
        toast({
          title: "Ikke funnet i Tripletex",
          description: "Oppføringen ble ikke funnet i Tripletex - kan være slettet eller ikke synkronisert",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Status-sjekk feilet",
        description: error.message,
        variant: "destructive"
      });
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

  const exportWeekCSV = async () => {
    try {
      const csvData = timerEntries.map(entry => ({
        Ansatt: entry.vakt?.person ? 
          getPersonDisplayName(entry.vakt.person.fornavn, entry.vakt.person.etternavn) : 
          'Ukjent',
        Dato: entry.vakt?.dato || '',
        Prosjektnr: entry.vakt?.ttx_project_cache?.project_number || '',
        Prosjektnavn: entry.vakt?.ttx_project_cache?.project_name || '',
        Aktivitet: entry.ttx_activity_cache?.navn || '',
        Lønnstype: entry.lonnstype,
        Timer: formatTimeValue(entry.timer),
        Notat: entry.notat || '',
        Status: entry.status,
        Kilde: entry.kilde,
        TripletexID: entry.tripletex_entry_id || '',
        Farge: '' // Could add project color here if needed
      }));

      const csvContent = [
        'Ansatt;Dato;Prosjektnr;Prosjektnavn;Aktivitet;Lønnstype;Timer;Notat;Status;Kilde;TripletexID;Farge',
        ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(';'))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `timer-eksport-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast({
        title: "Eksport fullført",
        description: `Eksporterte ${csvData.length} timeroppføringer til CSV`
      });
    } catch (error) {
      toast({
        title: "Eksport feilet", 
        description: "Kunne ikke eksportere data",
        variant: "destructive"
      });
    }
  };

  const exportMonthCSV = async () => {
    try {
      // Get month range
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const { data: monthData } = await supabase
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
        .gte('vakt.dato', startOfMonth.toISOString().split('T')[0])
        .lte('vakt.dato', endOfMonth.toISOString().split('T')[0])
        .order('created_at', { ascending: false });

      const csvData = (monthData || []).map(entry => ({
        Ansatt: entry.vakt?.person ? 
          getPersonDisplayName(entry.vakt.person.fornavn, entry.vakt.person.etternavn) : 
          'Ukjent',
        Dato: entry.vakt?.dato || '',
        Prosjektnr: entry.vakt?.ttx_project_cache?.project_number || '',
        Prosjektnavn: entry.vakt?.ttx_project_cache?.project_name || '',
        Aktivitet: entry.ttx_activity_cache?.navn || '',
        Lønnstype: entry.lonnstype,
        Timer: formatTimeValue(entry.timer),
        Notat: entry.notat || '',
        Status: entry.status,
        Kilde: entry.kilde,
        TripletexID: entry.tripletex_entry_id || ''
      }));

      const csvContent = [
        'Ansatt;Dato;Prosjektnr;Prosjektnavn;Aktivitet;Lønnstype;Timer;Notat;Status;Kilde;TripletexID',
        ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(';'))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `timer-måned-${startOfMonth.toISOString().split('T')[0]}.csv`;
      link.click();

      toast({
        title: "Måned eksportert",
        description: `Eksporterte ${csvData.length} oppføringer for ${startOfMonth.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })}`
      });
    } catch (error) {
      toast({
        title: "Månedseksport feilet",
        description: "Kunne ikke eksportere månedsdata",
        variant: "destructive"
      });
    }
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

        {/* Period Lock Banner */}
        {periodLockBanner && (
          <Card className="border-red-500 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <div className="font-medium">Periode låst i Tripletex</div>
                  <div className="text-sm">{periodLockBanner}</div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-auto"
                  onClick={() => setPeriodLockBanner(null)}
                >
                  Lukk
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="dry-run"
                        checked={dryRunMode}
                        onCheckedChange={setDryRunMode}
                      />
                      <label htmlFor="dry-run" className="text-sm">
                        Dry-run (kun validering)
                      </label>
                    </div>
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
                      {dryRunMode ? 'Test eksport' : 'Send til Tripletex'}
                    </Button>
                    <Button onClick={exportWeekCSV} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Eksporter CSV
                    </Button>
                    <Button onClick={exportMonthCSV} variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Måned CSV
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
                    <TableHead>Aksjon</TableHead>
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
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{entry.lonnstype}</Badge>
                          {entry.lonnstype === 'overtid' && (
                            <span className="text-yellow-600 font-bold" title="Overtid">⚡</span>
                          )}
                        </div>
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
                      <TableCell>
                        {entry.status === 'sendt' && entry.tripletex_entry_id && (
                          <Button
                            onClick={() => checkTripletexStatus(entry.id)}
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            title="Hent status fra Tripletex"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {timerEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
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