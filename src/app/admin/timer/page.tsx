"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toLocalDateString } from "@/lib/utils";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Download,
  FileText,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  User,
  Paperclip,
} from "lucide-react";
import { formatTimeValue, getPersonDisplayName } from "@/lib/displayNames";
import ProtectedRoute from "@/components/ProtectedRoute";

interface Profile {
  id: string;
  org_id: string;
  user_id: string;
  created_at: string;
  org?: {
    id: string;
    name: string;
  } | null;
}

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
    id?: string;
    dato: string;
    person: {
      fornavn: string;
      etternavn: string;
    } | null;
    ttx_project_cache: {
      project_name: string;
      project_number: number;
    } | null;
  } | null;
  ttx_activity_cache: {
    navn: string;
    ttx_id?: string;
  } | null;
}

const AdminTimerPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [timerEntries, setTimerEntries] = useState<TimerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    status: "all",
    search: "",
  });
  const [dryRunMode, setDryRunMode] = useState(false);
  const [periodLockBanner, setPeriodLockBanner] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState({ approve: false, export: false });

  const loadUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, org:org_id (id, name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setProfile(data as Profile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
      setProfile(null);
    }
  }, [user]);

  const loadTimerEntries = useCallback(async () => {
    if (!profile?.org_id) return;

    setLoading(true);
    try {
      let query = supabase
        .from("vakt_timer")
        .select(
          `
            id,
            timer,
            notat,
            status,
            lonnstype,
            kilde,
            tripletex_entry_id,
            created_at,
            vakt:vakt_id (
              id,
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
            ttx_activity_cache!aktivitet_id (
              navn,
              ttx_id
            )
          `,
        )
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: false });

      if (filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      if (filters.dateFrom) {
        query = query.gte("vakt.dato", filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte("vakt.dato", filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = (data || []) as TimerEntry[];
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredData = filteredData.filter((entry) =>
          entry.vakt?.person?.fornavn?.toLowerCase().includes(searchTerm) ||
          entry.vakt?.person?.etternavn?.toLowerCase().includes(searchTerm) ||
          entry.vakt?.ttx_project_cache?.project_name?.toLowerCase().includes(searchTerm) ||
          entry.ttx_activity_cache?.navn?.toLowerCase().includes(searchTerm) ||
          entry.notat?.toLowerCase().includes(searchTerm),
        );
      }

      setTimerEntries(filteredData);
    } catch (err) {
      console.error("Error loading timer entries:", err);
      toast({
        title: "Feil ved lasting av timer",
        description: "Kunne ikke laste timelister.",
        variant: "destructive",
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
    setSelectedEntries((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(entryId)) {
        newSelection.delete(entryId);
      } else {
        newSelection.add(entryId);
      }
      return newSelection;
    });
  };

  const toggleAllSelection = () => {
    setSelectedEntries((prev) => {
      if (prev.size === timerEntries.length) {
        return new Set();
      }
      return new Set(timerEntries.map((entry) => entry.id));
    });
  };

  const markAsApproved = async () => {
    if (selectedEntries.size === 0 || !profile?.org_id) return;

    setActionLoading((prev) => ({ ...prev, approve: true }));
    try {
      const { error } = await supabase
        .from("vakt_timer")
        .update({ status: "godkjent" })
        .in("id", Array.from(selectedEntries))
        .eq("org_id", profile.org_id);

      if (error) throw error;

      toast({
        title: "Timer godkjent",
        description: `${selectedEntries.size} timer ble markert som godkjent.`,
      });

      setSelectedEntries(new Set());
      loadTimerEntries();
    } catch (error: unknown) {
      toast({
        title: "Godkjenning feilet",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, approve: false }));
    }
  };

  const sendToTripletex = async () => {
    if (selectedEntries.size === 0 || !profile?.org_id) return;

    setActionLoading((prev) => ({ ...prev, export: true }));
    try {
      const selectedTimerEntries = timerEntries.filter(
        (entry) =>
          selectedEntries.has(entry.id) &&
          (entry.status === "godkjent" || entry.status === "klar"),
      );

      if (selectedTimerEntries.length === 0) {
        toast({
          title: "Ingen gyldige timer",
          description: "Kun timer med status 'godkjent' eller 'klar' kan sendes til Tripletex.",
          variant: "destructive",
        });
        return;
      }

      const vaktIds = selectedTimerEntries
        .map((entry) => entry.vakt?.id || null)
        .filter((id): id is string => Boolean(id));

      const { data: vaktData } = await supabase
        .from("vakt")
        .select("id, person_id")
        .in("id", vaktIds)
        .eq("org_id", profile.org_id);

      const vaktToPersonMap = new Map((vaktData || []).map((v) => [v.id, v.person_id]));

      const timesheetEntries = selectedTimerEntries.map((entry) => {
        const vaktId = entry.vakt?.id;
        const personId = vaktId ? vaktToPersonMap.get(vaktId) || "" : "";

        return {
          id: entry.id,
          personId,
          projectId: entry.vakt?.ttx_project_cache?.project_number || "",
          activityId: entry.ttx_activity_cache?.ttx_id || "",
          date: entry.vakt?.dato,
          hours: entry.timer,
          comment: entry.notat || "",
          clientReference: `${profile.org_id}-${entry.id}`,
        };
      });

      const requestBody = {
        action: "export-timesheet",
        orgId: profile.org_id,
        timesheetEntries,
        dryRun: dryRunMode,
      } as const;

      if (dryRunMode) {
        console.log("Dry-run mode - would send:", requestBody);
        toast({
          title: "Dry-run utført",
          description: `Ville sendt ${selectedTimerEntries.length} timer til Tripletex (ingen data sendt)`,
        });
        setSelectedEntries(new Set());
        return;
      }

      const { data, error } = await supabase.functions.invoke("tripletex-api", {
        body: requestBody,
      });

      if (error) throw error;

      const results: Array<{ success: boolean; errorType?: string; error?: string; weekNumber?: string }> =
        data?.data?.results || [];
      const successful = results.filter((result) => result.success);
      const failed = results.filter((result) => !result.success);

      const periodLockedErrors = failed.filter((result) =>
        result.errorType === "period_locked" || result.error?.includes("period is locked"),
      );

      if (periodLockedErrors.length > 0) {
        const weekInfo = periodLockedErrors[0]?.weekNumber || "ukjent";
        setPeriodLockBanner(`Uke ${weekInfo} er låst i Tripletex – åpne perioden i Tripletex for å eksportere timer.`);

        toast({
          title: "Periode låst i Tripletex",
          description: `${periodLockedErrors.length} timer kunne ikke sendes fordi perioden er låst`,
          variant: "destructive",
        });
      }

      if (successful.length > 0) {
        toast({
          title: "Eksport fullført",
          description: `${successful.length} timer ble sendt til Tripletex.`,
        });
      }

      if (failed.length > periodLockedErrors.length) {
        toast({
          title: "Noen timer feilet",
          description: `${failed.length - periodLockedErrors.length} timer kunne ikke sendes på grunn av andre feil.`,
          variant: "destructive",
        });
      }

      setSelectedEntries(new Set());
      loadTimerEntries();
    } catch (error: unknown) {
      toast({
        title: "Eksport til Tripletex feilet",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, export: false }));
    }
  };

  const checkTripletexStatus = async (entryId: string) => {
    const entry = timerEntries.find((timerEntry) => timerEntry.id === entryId);
    if (!entry || !entry.tripletex_entry_id || !profile?.org_id) {
      toast({
        title: "Ingen Tripletex ID",
        description: "Denne oppføringen har ikke blitt sendt til Tripletex ennå",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("tripletex-api", {
        body: {
          action: "verify-timesheet-entry",
          orgId: profile.org_id,
          tripletexEntryId: entry.tripletex_entry_id,
        },
      });

      if (error) throw error;

      if (data?.exists) {
        toast({
          title: "Status bekreftet",
          description: `Oppføringen eksisterer i Tripletex (ID: ${entry.tripletex_entry_id})`,
        });
      } else {
        toast({
          title: "Ikke funnet i Tripletex",
          description: "Oppføringen ble ikke funnet i Tripletex - kan være slettet eller ikke synkronisert",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Status-sjekk feilet",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string, tripletexId?: number | null) => {
    switch (status) {
      case "godkjent":
        return <Badge className="bg-green-500">🟢 Godkjent</Badge>;
      case "sendt":
        return <Badge className="bg-blue-500">🔵 Sendt {tripletexId ? `(#${tripletexId})` : ""}</Badge>;
      case "klar":
        return <Badge className="bg-orange-500">🟠 Klar</Badge>;
      default:
        return <Badge variant="outline">📝 Kladd</Badge>;
    }
  };

  const getKildeBadge = (kilde: string) =>
    kilde === "tripletex" ? <Badge variant="secondary">Tripletex</Badge> : <Badge variant="outline">Intern</Badge>;

  const exportWeekCSV = useCallback(() => {
    try {
      const csvData = timerEntries.map((entry) => ({
        Ansatt: entry.vakt?.person
          ? getPersonDisplayName(entry.vakt.person.fornavn, entry.vakt.person.etternavn)
          : "Ukjent",
        Dato: entry.vakt?.dato || "",
        Prosjektnr: entry.vakt?.ttx_project_cache?.project_number || "",
        Prosjektnavn: entry.vakt?.ttx_project_cache?.project_name || "",
        Aktivitet: (entry.ttx_activity_cache as { navn?: string } | null)?.navn || "",
        Lønnstype: entry.lonnstype,
        Timer: formatTimeValue(entry.timer),
        Notat: entry.notat || "",
        Status: entry.status,
        Kilde: entry.kilde,
        TripletexID: entry.tripletex_entry_id || "",
        Farge: "",
      }));

      const csvContent = [
        "Ansatt;Dato;Prosjektnr;Prosjektnavn;Aktivitet;Lønnstype;Timer;Notat;Status;Kilde;TripletexID;Farge",
        ...csvData.map((row) => Object.values(row).map((value) => `"${value}"`).join(";")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `timer-eksport-${toLocalDateString(new Date())}.csv`;
      link.click();

      toast({
        title: "Eksport fullført",
        description: `Eksporterte ${csvData.length} timeroppføringer til CSV`,
      });
    } catch (error) {
      toast({
        title: "Eksport feilet",
        description: "Kunne ikke eksportere data",
        variant: "destructive",
      });
    }
  }, [timerEntries, toast]);

  const exportMonthCSV = useCallback(async () => {
    if (!profile?.org_id) return;

    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const { data: monthData } = await supabase
        .from("vakt_timer")
        .select(
          `
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
          `,
        )
        .eq("org_id", profile.org_id)
        .gte("vakt.dato", toLocalDateString(startOfMonth))
        .lte("vakt.dato", toLocalDateString(endOfMonth))
        .order("created_at", { ascending: false });

      const csvData = (monthData || []).map((entry) => ({
        Ansatt: entry.vakt?.person
          ? getPersonDisplayName(entry.vakt.person.fornavn, entry.vakt.person.etternavn)
          : "Ukjent",
        Dato: entry.vakt?.dato || "",
        Prosjektnr: entry.vakt?.ttx_project_cache?.project_number || "",
        Prosjektnavn: entry.vakt?.ttx_project_cache?.project_name || "",
        Aktivitet: (entry.ttx_activity_cache as { navn?: string } | null)?.navn || "",
        Lønnstype: entry.lonnstype,
        Timer: formatTimeValue(entry.timer),
        Notat: entry.notat || "",
        Status: entry.status,
        Kilde: entry.kilde,
        TripletexID: entry.tripletex_entry_id || "",
      }));

      const csvContent = [
        "Ansatt;Dato;Prosjektnr;Prosjektnavn;Aktivitet;Lønnstype;Timer;Notat;Status;Kilde;TripletexID",
        ...csvData.map((row) => Object.values(row).map((value) => `"${value}"`).join(";")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `timer-måned-${toLocalDateString(startOfMonth)}.csv`;
      link.click();

      toast({
        title: "Måned eksportert",
        description: `Eksporterte ${csvData.length} oppføringer for ${startOfMonth.toLocaleDateString("no-NO", { month: "long", year: "numeric" })}`,
      });
    } catch (error) {
      toast({
        title: "Månedseksport feilet",
        description: "Kunne ikke eksportere månedsdata",
        variant: "destructive",
      });
    }
  }, [profile?.org_id, toast]);

  const selectedCount = selectedEntries.size;

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">Laster...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredRole="any-admin">
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Timer - Godkjenning</h1>
            <p className="mt-1 text-muted-foreground">
              {profile.org?.name} - Administrer og godkjenn timelister
            </p>
          </div>
          <Button onClick={loadTimerEntries} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Oppdater
          </Button>
        </div>

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
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søk i ansatt, prosjekt, aktivitet..."
                    value={filters.search}
                    onChange={(event) => setFilters({ ...filters, search: event.target.value })}
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
                  <SelectContent className="z-50 border bg-background">
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
                  onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Til dato</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {selectedCount} av {timerEntries.length} timer valgt
                </span>
                {selectedCount > 0 && (
                  <div className="flex gap-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="dry-run" checked={dryRunMode} onCheckedChange={setDryRunMode} />
                      <label htmlFor="dry-run" className="text-sm">
                        Dry-run (kun validering)
                      </label>
                    </div>
                    <Button onClick={markAsApproved} disabled={actionLoading.approve} size="sm">
                      {actionLoading.approve ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      Merk som godkjent
                    </Button>
                    <Button onClick={sendToTripletex} disabled={actionLoading.export} size="sm" variant="outline">
                      {actionLoading.export ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {dryRunMode ? "Test eksport" : "Send til Tripletex"}
                    </Button>
                    <Button onClick={exportWeekCSV} variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Eksporter CSV
                    </Button>
                    <Button onClick={exportMonthCSV} variant="outline" size="sm">
                      <FileText className="mr-2 h-4 w-4" />
                      Måned CSV
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
                Laster timer...
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-12 px-4 py-3 text-left">
                      <Checkbox
                        checked={selectedEntries.size === timerEntries.length && timerEntries.length > 0}
                        onCheckedChange={toggleAllSelection}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">Ansatt</th>
                    <th className="px-4 py-3 text-left">Dato</th>
                    <th className="px-4 py-3 text-left">Prosjekt</th>
                    <th className="px-4 py-3 text-left">Aktivitet</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-right">Timer</th>
                    <th className="px-4 py-3 text-left">Notat</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Kilde</th>
                    <th className="px-4 py-3 text-left">Aksjon</th>
                  </tr>
                </thead>
                <tbody>
                  {timerEntries.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedEntries.has(entry.id)}
                          onCheckedChange={() => toggleEntrySelection(entry.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {entry.vakt?.person
                            ? getPersonDisplayName(entry.vakt.person.fornavn, entry.vakt.person.etternavn)
                            : "Ukjent"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {entry.vakt?.dato ? new Date(entry.vakt.dato).toLocaleDateString("no-NO") : "Ukjent"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {entry.vakt?.ttx_project_cache
                          ? `${entry.vakt.ttx_project_cache.project_number} - ${entry.vakt.ttx_project_cache.project_name}`
                          : "Ikke tilordnet"}
                      </td>
                      <td className="px-4 py-3">{entry.ttx_activity_cache?.navn || "Ingen aktivitet"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{entry.lonnstype}</Badge>
                          {entry.lonnstype === "overtid" && (
                            <span className="font-bold text-yellow-600" title="Overtid">
                              ⚡
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatTimeValue(entry.timer)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {entry.notat && (
                            <>
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <span className="max-w-32 truncate text-sm" title={entry.notat}>
                                {entry.notat}
                              </span>
                            </>
                          )}
                          {entry.kilde === "tripletex" && <Paperclip className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(entry.status, entry.tripletex_entry_id)}</td>
                      <td className="px-4 py-3">{getKildeBadge(entry.kilde)}</td>
                      <td className="px-4 py-3">
                        {entry.status === "sendt" && entry.tripletex_entry_id && (
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
                      </td>
                    </tr>
                  ))}

                  {timerEntries.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                        Ingen timer funnet med gjeldende filtre.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </ProtectedRoute>
  );
};

export default AdminTimerPage;


