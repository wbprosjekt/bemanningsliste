"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useRef, useState } from "react";
import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toLocalDateString } from "@/lib/utils";
import { TripletexRateLimiter } from "@/lib/tripletexRateLimiter";
import TimeEntry from "@/components/TimeEntry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Car,
  Calendar,
  CheckCircle,
  Download,
  FileText,
  Filter,
  MessageSquare,
  Pencil,
  RefreshCw,
  Route,
  Search,
  Send,
  Loader2,
  Timer,
  Truck,
  User,
  Paperclip,
  ClipboardList,
  Hammer,
  HardHat,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

type VehicleType = "servicebil" | "km_utenfor" | "tilhenger";

interface VehicleEntry {
  id: string;
  vakt_id: string;
  vehicle_type: VehicleType;
  distance_km: number | null;
  tripletex_entry_id: number | null;
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
  aktivitet_id: string | null;
  tripletex_synced_at: string | null;
  original_timer: number | null;
  original_aktivitet_id: string | null;
  original_notat: string | null;
  original_status: string | null;
  vakt: {
    id?: string;
    dato: string;
    person: {
      id?: string;
      fornavn: string;
      etternavn: string;
      tripletex_employee_id?: number | null;
    } | null;
    ttx_project_cache: {
      id: string;
      project_name: string;
      project_number: number | null;
      tripletex_project_id: number | null;
      is_active?: boolean | null;
      is_closed?: boolean | null;
    } | null;
  } | null;
  ttx_activity_cache: {
    id: string;
    navn: string;
    ttx_id: number | null;
  } | null;
  vehicles: VehicleEntry[];
}

interface GroupedTimerEntry {
  vaktId: string;
  date: string;
  person: {
    id: string;
    fornavn: string;
    etternavn: string;
    tripletex_employee_id?: number | null;
  };
  project: {
    id: string;
    project_name: string;
    project_number: number | null;
    tripletex_project_id: number | null;
    is_active?: boolean | null;
    is_closed?: boolean | null;
  } | null;
  // All entries for this vaktId
  entries: TimerEntry[];
  // Aggregated data
  totalHours: number;
  hoursByType: {
    normal: number;
    overtid_50: number;
    overtid_100: number;
  };
  // Status info
  allStatuses: Set<string>;
  hasTripletexEntries: boolean;
  allTripletexIds: number[];
  // Vehicles (aggregated from all entries)
  vehicles: VehicleEntry[];
}

type PeriodPreset = "today" | "currentWeek" | "currentMonth" | "previousMonth";

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

const getPeriodRange = (period: PeriodPreset) => {
  const today = new Date();

  switch (period) {
    case "today": {
      const dateString = toLocalDateString(today);
      return { from: dateString, to: dateString };
    }
    case "currentWeek": {
      const start = startOfWeek(today, WEEK_OPTIONS);
      const end = endOfWeek(today, WEEK_OPTIONS);
      return { from: toLocalDateString(start), to: toLocalDateString(end) };
    }
    case "previousMonth": {
      const lastMonth = subMonths(today, 1);
      const start = startOfMonth(lastMonth);
      const end = endOfMonth(lastMonth);
      return { from: toLocalDateString(start), to: toLocalDateString(end) };
    }
    case "currentMonth":
    default: {
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      return { from: toLocalDateString(start), to: toLocalDateString(end) };
    }
  }
};

const vehicleDisplayMeta: Record<VehicleType, { label: string; icon: LucideIcon }> = {
  servicebil: { label: "Servicebil", icon: Car },
  km_utenfor: { label: "Km utenfor", icon: Route },
  tilhenger: { label: "Tilhenger", icon: Truck },
};

type ActivityDisplay = {
  label: string;
  icon: LucideIcon;
  variant: "default" | "outline" | "secondary";
};

const activityMappings: Array<{ keywords: string[]; icon: LucideIcon; variant: ActivityDisplay["variant"] }> = [
  { keywords: ["befaring", "inspeksjon", "kontroll"], icon: Route, variant: "secondary" },
  { keywords: ["verktøy", "service", "reparasjon"], icon: Wrench, variant: "outline" },
  { keywords: ["bygg", "mont", "arbeid", "installasjon"], icon: Hammer, variant: "outline" },
  { keywords: ["sikkerhet", "hms"], icon: HardHat, variant: "secondary" },
];

const getActivityDisplay = (activityName?: string | null): ActivityDisplay => {
  if (!activityName) {
    return { label: "Ingen aktivitet", icon: ClipboardList, variant: "outline" };
  }

  const normalized = activityName.toLowerCase();
  const mapping = activityMappings.find((entry) => entry.keywords.some((keyword) => normalized.includes(keyword)));

  if (mapping) {
    return { label: activityName, icon: mapping.icon, variant: mapping.variant };
  }

  return { label: activityName, icon: ClipboardList, variant: "outline" };
};

const extractRetryAfter = (payload: unknown): number | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidates = [
    (payload as { retryInfo?: { retryAfter?: unknown } }).retryInfo?.retryAfter,
    (payload as { retryAfter?: unknown }).retryAfter,
    (payload as { data?: { retryInfo?: { retryAfter?: unknown } } }).data?.retryInfo?.retryAfter,
    (payload as { data?: { retryAfter?: unknown } }).data?.retryAfter,
    (payload as { error?: { retryAfter?: unknown } }).error?.retryAfter,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }

    if (typeof candidate === "string") {
      const parsed = Number(candidate);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
};

const getFriendlyTripletexError = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as { error?: unknown; details?: unknown; message?: unknown };
  const rawError = typeof data.error === "string" ? data.error : null;
  const detail = typeof data.details === "string" ? data.details : null;
  const message = typeof data.message === "string" ? data.message : null;

  const textSamples = [rawError, detail, message].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  const matches = (needle: string) =>
    textSamples.some((text) => text.toLowerCase().includes(needle.toLowerCase()));

  if (matches("employee_not_participant") || matches("ansatt er ikke deltaker")) {
    return "Den ansatte er ikke registrert som deltaker på prosjektet i Tripletex.";
  }

  if (matches("activity_not_on_project") || matches("aktiviteten er ikke knyttet")) {
    return "Aktiviteten er ikke knyttet til prosjektet i Tripletex.";
  }

  if (
    matches("project is closed") ||
    matches("prosjektet er avsluttet") ||
    matches("prosjektet er lukket") ||
    matches("project closed") ||
    matches("inactive project") ||
    matches("prosjektet er inaktivt")
  ) {
    return "Prosjektet er avsluttet i Tripletex og kan ikke motta timer.";
  }

  if (matches("period is closed") || matches("perioden er låst") || matches("period_locked")) {
    return "Perioden er låst i Tripletex. Åpne perioden i Tripletex før du sender på nytt.";
  }

  if (rawError) {
    switch (rawError) {
      case "employee_not_participant":
        return "Den ansatte er ikke registrert som deltaker på prosjektet i Tripletex.";
      case "activity_not_on_project":
        return "Aktiviteten er ikke knyttet til prosjektet i Tripletex.";
      case "period_locked":
        return "Perioden er låst i Tripletex. Åpne perioden i Tripletex før du sender på nytt.";
      default:
        return rawError;
    }
  }

  return textSamples[0] ?? null;
};

const AdminTimerPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [timerEntries, setTimerEntries] = useState<TimerEntry[]>([]); // Keep raw entries for grouping
  const [groupedEntries, setGroupedEntries] = useState<GroupedTimerEntry[]>([]); // Grouped by vaktId
  const [loading, setLoading] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set()); // Stores vaktId for grouped entries
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    status: "all",
    search: "",
  });
  const [periodLockBanner, setPeriodLockBanner] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState({ approve: false, export: false, unapprove: false, recall: false });
  const [sendingStates, setSendingStates] = useState<Set<string>>(new Set());
  const [recallingStates, setRecallingStates] = useState<Set<string>>(new Set());
  const [successStates, setSuccessStates] = useState<Set<string>>(new Set());
  const [cooldownCountdown, setCooldownCountdown] = useState(0);
  const [editingVaktId, setEditingVaktId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{
    mode: "send" | "recall" | null;
    total: number;
    completed: number;
    failed: number;
    running: boolean;
  }>({
    mode: null,
    total: 0,
    completed: 0,
    failed: 0,
    running: false,
  });
  const [cancelRequested, setCancelRequested] = useState(false);
  const cancelRequestedRef = useRef(false);
  const rateLimitKey = profile?.org_id ? `tripletex_send_${profile.org_id}` : null;

  const resetCancel = useCallback(() => {
    setCancelRequested(false);
    cancelRequestedRef.current = false;
  }, []);

  const requestCancel = useCallback(() => {
    setCancelRequested(true);
    cancelRequestedRef.current = true;
  }, []);

  const applyPeriodFilter = useCallback((period: PeriodPreset) => {
    const { from, to } = getPeriodRange(period);
    setFilters((prev) => ({
      ...prev,
      dateFrom: from,
      dateTo: to,
    }));
  }, []);

  const isPeriodActive = useCallback(
    (period: PeriodPreset) => {
      const { from, to } = getPeriodRange(period);
      return filters.dateFrom === from && filters.dateTo === to && filters.dateFrom !== "" && filters.dateTo !== "";
    },
    [filters.dateFrom, filters.dateTo],
  );

  const clearDateFilters = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      dateFrom: "",
      dateTo: "",
    }));
  }, []);

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
            tripletex_synced_at,
            original_timer,
            original_aktivitet_id,
            original_notat,
            original_status,
            aktivitet_id,
            vakt:vakt_id (
              id,
              dato,
              person:person_id (
                id,
                fornavn,
                etternavn,
                tripletex_employee_id
              ),
            ttx_project_cache:project_id (
              id,
              project_name,
              project_number,
              tripletex_project_id,
              is_active,
              is_closed
            )
            ),
            ttx_activity_cache!aktivitet_id (
              id,
              navn,
              ttx_id
            )
          `,
        )
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: false });

      if (filters.status !== "all") {
        if (filters.status === "godkjent") {
          // For "godkjent", only show entries that are godkjent AND not sent to Tripletex
          query = query.eq("status", "godkjent").is("tripletex_entry_id", null);
        } else if (filters.status === "sendt") {
          // For "sendt", show entries that have tripletex_entry_id (regardless of status field)
          query = query.not("tripletex_entry_id", "is", null);
        } else {
          // For other statuses (klar, utkast, etc.), filter by status and exclude sent entries
          query = query.eq("status", filters.status).is("tripletex_entry_id", null);
        }
      }

      // Always exclude entries without a valid vakt_id
      query = query.not("vakt_id", "is", null);

      // Date filtering on nested vakt.dato field
      if (filters.dateFrom) {
        query = query.gte("vakt.dato", filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte("vakt.dato", filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      type SupabaseTimerEntry = Omit<TimerEntry, "vehicles">;
      let filteredData = (data || []) as SupabaseTimerEntry[];
      
      // Post-filter: Exclude entries with invalid or missing data
      // This ensures we don't show "Ukjent" entries when date filter is active
      if (filters.dateFrom || filters.dateTo) {
        filteredData = filteredData.filter((entry) => {
          // Must have valid vakt and date
          if (!entry.vakt?.id || !entry.vakt?.dato) {
            return false;
          }
          return true;
        });
      }
      
      // Always exclude entries without person or project when they should exist
      // (Optional: Comment out if you want to see orphaned entries for debugging)
      filteredData = filteredData.filter((entry) => {
        // Exclude if vakt exists but has no person (shows as "Ukjent")
        if (entry.vakt?.id && !entry.vakt?.person?.id) {
          return false;
        }
        return true;
      });
      // Filter out entries with 0 or null timer
      filteredData = filteredData.filter((entry) => {
        return entry.timer > 0 && entry.timer !== null;
      });

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

      const baseEntries: TimerEntry[] = filteredData.map((entry) => ({
        ...entry,
        vehicles: [],
      }));

      const vaktIds = Array.from(
        new Set(
          baseEntries
            .map((entry) => entry.vakt?.id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      if (vaktIds.length > 0) {
        const { data: vehicleData, error: vehicleError } = await supabase
          .from("vehicle_entries")
          .select("id, vakt_id, vehicle_type, distance_km, tripletex_entry_id")
          .in("vakt_id", vaktIds)
          .eq("org_id", profile.org_id)
          .order("vehicle_type", { ascending: true })
          .order("distance_km", { ascending: true, nullsFirst: false });

        if (vehicleError) {
          console.error("Error loading vehicle entries:", vehicleError);
        } else {
          const vehiclesByVakt = new Map<string, VehicleEntry[]>();
          (vehicleData || []).forEach((vehicle) => {
            const typedVehicle = vehicle as VehicleEntry;
            const list = vehiclesByVakt.get(typedVehicle.vakt_id) ?? [];
            vehiclesByVakt.set(typedVehicle.vakt_id, [...list, typedVehicle]);
          });

          baseEntries.forEach((entry) => {
            const vaktId = entry.vakt?.id;
            if (vaktId) {
              entry.vehicles = vehiclesByVakt.get(vaktId) ?? [];
            }
          });
        }
      }

      setTimerEntries(baseEntries);

      // Group entries by vaktId
      const groupedMap = new Map<string, TimerEntry[]>();
      baseEntries.forEach((entry) => {
        const vaktId = entry.vakt?.id;
        if (!vaktId) return;

        const existing = groupedMap.get(vaktId) || [];
        groupedMap.set(vaktId, [...existing, entry]);
      });

      const grouped: GroupedTimerEntry[] = Array.from(groupedMap.entries()).map(([vaktId, entries]) => {
        const firstEntry = entries[0];
        if (!firstEntry.vakt || !firstEntry.vakt.person) {
          throw new Error("Invalid entry structure");
        }

        // Calculate total hours and hours by type
        let totalHours = 0;
        const hoursByType = { normal: 0, overtid_50: 0, overtid_100: 0 };
        const allStatuses = new Set<string>();
        const allTripletexIds: number[] = [];
        const allVehicles: VehicleEntry[] = [];

        entries.forEach((entry) => {
          totalHours += entry.timer;
          
          const lonnstype = entry.lonnstype?.toLowerCase() || "";
          if (lonnstype.includes("overtid_100") || lonnstype.includes("overtid100")) {
            hoursByType.overtid_100 += entry.timer;
          } else if (lonnstype.includes("overtid_50") || lonnstype.includes("overtid50")) {
            hoursByType.overtid_50 += entry.timer;
          } else {
            hoursByType.normal += entry.timer;
          }

          allStatuses.add(entry.status);
          if (entry.tripletex_entry_id) {
            allTripletexIds.push(entry.tripletex_entry_id);
          }

          // Collect vehicles (they're the same for all entries with same vaktId)
          if (entry.vehicles.length > 0) {
            allVehicles.push(...entry.vehicles);
          }
        });

        // Remove duplicate vehicles
        const uniqueVehicles = Array.from(
          new Map(allVehicles.map((v) => [v.id, v])).values()
        );

        return {
          vaktId,
          date: firstEntry.vakt.dato,
          person: {
            id: firstEntry.vakt.person.id!,
            fornavn: firstEntry.vakt.person.fornavn,
            etternavn: firstEntry.vakt.person.etternavn,
            tripletex_employee_id: firstEntry.vakt.person.tripletex_employee_id,
          },
          project: firstEntry.vakt.ttx_project_cache
            ? {
                id: firstEntry.vakt.ttx_project_cache.id,
                project_name: firstEntry.vakt.ttx_project_cache.project_name,
                project_number: firstEntry.vakt.ttx_project_cache.project_number,
                tripletex_project_id: firstEntry.vakt.ttx_project_cache.tripletex_project_id,
                is_active: firstEntry.vakt.ttx_project_cache.is_active,
                is_closed: firstEntry.vakt.ttx_project_cache.is_closed,
              }
            : null,
          entries,
          totalHours,
          hoursByType,
          allStatuses,
          hasTripletexEntries: allTripletexIds.length > 0,
          allTripletexIds,
          vehicles: uniqueVehicles,
        };
      });

      setGroupedEntries(grouped);
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

  useEffect(() => {
    if (!rateLimitKey) {
      setCooldownCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const countdown = TripletexRateLimiter.getCountdown(rateLimitKey);
      setCooldownCountdown(countdown);
    };

    updateCountdown();

    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [rateLimitKey]);

  const ensureRateLimitAvailable = useCallback(() => {
    if (!rateLimitKey) return true;

    if (!TripletexRateLimiter.isLimited(rateLimitKey)) {
      return true;
    }

    const countdown = TripletexRateLimiter.getCountdown(rateLimitKey);
    setCooldownCountdown(countdown);
    toast({
      title: "Tripletex begrensning",
      description: `Vent ${countdown}s før du sender flere timer.`,
      variant: "destructive",
    });
    return false;
  }, [rateLimitKey, toast]);

  const applyRateLimitFromResponse = useCallback(
    (response: unknown) => {
      if (!rateLimitKey) return;

      const retryAfter = extractRetryAfter(response);
      if (retryAfter && retryAfter > 0) {
        TripletexRateLimiter.setLimit(rateLimitKey, retryAfter);
        setCooldownCountdown(TripletexRateLimiter.getCountdown(rateLimitKey));
      }
    },
    [rateLimitKey],
  );

  const handleOpenEdit = useCallback(
    (groupedEntry: GroupedTimerEntry) => {
      if (!profile?.org_id) {
        toast({
          title: "Organisasjon mangler",
          description: "Kunne ikke åpne redigering fordi organisasjons-id mangler.",
          variant: "destructive",
        });
        return;
      }

      if (!groupedEntry.vaktId) {
        toast({
          title: "Kan ikke redigere",
          description: "Denne timen mangler kobling til vakt og kan ikke redigeres.",
          variant: "destructive",
        });
        return;
      }

      setEditingVaktId(groupedEntry.vaktId);
    },
    [profile?.org_id, toast],
  );

  const handleCloseEdit = useCallback(() => {
    setEditingVaktId(null);
  }, []);

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
      if (prev.size === groupedEntries.length) {
        return new Set();
      }
      return new Set(groupedEntries.map((entry) => entry.vaktId));
    });
  };

  const markAsApproved = async () => {
    if (selectedEntries.size === 0 || !profile?.org_id) return;

    // Collect all entry IDs from selected grouped entries
    const entryIds: string[] = [];
    groupedEntries.forEach((grouped) => {
      if (selectedEntries.has(grouped.vaktId)) {
        entryIds.push(...grouped.entries.map((e) => e.id));
      }
    });

    if (entryIds.length === 0) return;

    setActionLoading((prev) => ({ ...prev, approve: true }));
    try {
      const { error } = await supabase
        .from("vakt_timer")
        .update({ status: "godkjent" })
        .in("id", entryIds)
        .eq("org_id", profile.org_id);

      if (error) throw error;

      toast({
        title: "Timer godkjent",
        description: `${selectedEntries.size} linjer (${entryIds.length} timer) ble markert som godkjent.`,
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

  const markAsUnapproved = async () => {
    if (selectedEntries.size === 0 || !profile?.org_id) return;

    // Collect all entry IDs from selected grouped entries that are not sent to Tripletex
    const unapprovedEntryIds: string[] = [];
    groupedEntries.forEach((grouped) => {
      if (selectedEntries.has(grouped.vaktId)) {
        grouped.entries
          .filter((e) => !e.tripletex_entry_id)
          .forEach((e) => unapprovedEntryIds.push(e.id));
      }
    });

    if (unapprovedEntryIds.length === 0) {
      toast({
        title: "Ingen gyldige timer",
        description: "Kun timer som ikke er sendt til Tripletex kan avgodkjennes.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading((prev) => ({ ...prev, unapprove: true }));
    try {
      const { data, error } = await supabase.functions.invoke("tripletex-api", {
        body: {
          action: "unapprove_timesheet_entries",
          entry_ids: unapprovedEntryIds,
          orgId: profile.org_id,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Kunne ikke avgodkjenne timer");
      }

      toast({
        title: "Godkjenning trukket tilbake",
        description: `${unapprovedEntryIds.length} timer ble satt tilbake til utkast-status.`,
      });

      setSelectedEntries(new Set());
      loadTimerEntries();
    } catch (error: unknown) {
      toast({
        title: "Avgodkjenning feilet",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, unapprove: false }));
    }
  };

  const approveSingleEntry = async (entry: TimerEntry) => {
    if (!profile?.org_id) return;

    try {
      const { error } = await supabase
        .from("vakt_timer")
        .update({ status: "godkjent" })
        .eq("id", entry.id)
        .eq("org_id", profile.org_id);

      if (error) throw error;

      toast({
        title: "Timer godkjent",
        description: "Timene ble markert som godkjent.",
      });

      loadTimerEntries();
    } catch (error: unknown) {
      toast({
        title: "Godkjenning feilet",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    }
  };

  const unapproveSingleEntry = async (entry: TimerEntry) => {
    if (!profile?.org_id) return;

    try {
      const { data, error } = await supabase.functions.invoke("tripletex-api", {
        body: {
          action: "unapprove_timesheet_entries",
          entry_ids: [entry.id],
          orgId: profile.org_id,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Kunne ikke avgodkjenne timer");
      }

      toast({
        title: "Godkjenning trukket tilbake",
        description: "Timene er satt tilbake til utkast-status.",
      });

      loadTimerEntries();
    } catch (error: unknown) {
      toast({
        title: "Avgodkjenning feilet",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    }
  };

  const runRecallForGroups = useCallback(
    async (
      targetGroups: GroupedTimerEntry[],
      options: { skipSelectionReset?: boolean; showEmptySelectionToast?: boolean } = {},
    ) => {
      if (!profile?.org_id) {
        return { started: false };
      }

      if (targetGroups.length === 0) {
        if (options.showEmptySelectionToast) {
          toast({
            title: "Ingen timer valgt",
            description: "Velg timer som skal tilbakekalles før du starter prosessen.",
            variant: "destructive",
          });
        }
        setBulkProgress({ mode: null, total: 0, completed: 0, failed: 0, running: false });
        resetCancel();
        return { started: false };
      }

      if (!ensureRateLimitAvailable()) {
        return { started: false };
      }

      const entriesToRecall: Array<{ entry: TimerEntry; grouped: GroupedTimerEntry }> = [];

      targetGroups.forEach((grouped) => {
        grouped.entries
          .filter((entry) => entry.tripletex_entry_id)
          .forEach((entry) => {
            entriesToRecall.push({ entry, grouped });
          });
      });

      if (entriesToRecall.length === 0) {
        toast({
          title: "Ingen timer å tilbakekalle",
          description: "Kun timer som er sendt til Tripletex kan tilbakekalles.",
          variant: "destructive",
        });
        setBulkProgress({ mode: null, total: 0, completed: 0, failed: 0, running: false });
        resetCancel();
        return { started: false };
      }

      resetCancel();
      setBulkProgress({
        mode: "recall",
        total: entriesToRecall.length,
        completed: 0,
        failed: 0,
        running: true,
      });

      const failedEntries: Array<{ entry: TimerEntry; error: unknown }> = [];
      let completedCount = 0;
      let failedCount = 0;
      let haltedByRateLimit = false;
      let canceled = false;

      try {
        for (const grouped of targetGroups) {
          const recallableEntries = grouped.entries.filter((entry) => entry.tripletex_entry_id);
          if (recallableEntries.length === 0) {
            continue;
          }

          setRecallingStates((prev) => {
            const next = new Set(prev);
            next.add(grouped.vaktId);
            return next;
          });

          let groupCompleted = 0;
          let groupHours = 0;

          for (const entry of recallableEntries) {
            if (cancelRequestedRef.current) {
              canceled = true;
              break;
            }

            if (rateLimitKey && TripletexRateLimiter.isLimited(rateLimitKey)) {
              const countdown = TripletexRateLimiter.getCountdown(rateLimitKey);
              toast({
                title: "Tripletex rate limit",
                description: `Vent ${countdown}s før du kaller tilbake flere timer.`,
                variant: "destructive",
              });
              haltedByRateLimit = true;
              canceled = true;
              break;
            }

            try {
              const { data, error } = await supabase.functions.invoke("tripletex-api", {
                body: {
                  action: "delete_timesheet_entry",
                  tripletex_entry_id: entry.tripletex_entry_id!,
                  vakt_timer_id: entry.id,
                  orgId: profile.org_id,
                },
              });

              if (error) {
                applyRateLimitFromResponse(error);
                throw error;
              }

              applyRateLimitFromResponse(data);

              if (!data?.success) {
                throw new Error(
                  getFriendlyTripletexError(data) || data?.error || "Failed to recall from Tripletex",
                );
              }

              completedCount += 1;
              groupCompleted += 1;
              groupHours += entry.timer;
              setBulkProgress((prev) => ({
                ...prev,
                completed: completedCount,
              }));
            } catch (err: unknown) {
              failedCount += 1;
              failedEntries.push({ entry, error: err });
              const friendly =
                getFriendlyTripletexError(err) ||
                (err instanceof Error ? err.message : "En uventet feil oppstod");
              toast({
                title: "Tilbakekalling feilet",
                description: friendly,
                variant: "destructive",
              });
              setBulkProgress((prev) => ({
                ...prev,
                failed: failedCount,
              }));
            }

            if (cancelRequestedRef.current) {
              canceled = true;
              break;
            }
          }

          setRecallingStates((prev) => {
            const next = new Set(prev);
            next.delete(grouped.vaktId);
            return next;
          });

          if (canceled) {
            break;
          }

          if (groupCompleted > 0) {
            setSuccessStates((prev) => {
              const next = new Set(prev);
              next.add(grouped.vaktId);
              return next;
            });

            const employeeName =
              getPersonDisplayName(grouped.person.fornavn, grouped.person.etternavn) || "Ukjent ansatt";
            toast({
              title: "Timer kalt tilbake",
              description: `${employeeName}: ${formatTimeValue(groupHours)} timer tilbakekalt (${groupCompleted} aktivitet${groupCompleted === 1 ? "" : "er"}).`,
            });

            setTimeout(() => {
              setSuccessStates((prev) => {
                const next = new Set(prev);
                next.delete(grouped.vaktId);
                return next;
              });
            }, 1500);
          }
        }
      } finally {
        // Always ensure per-group spinner state is cleared if we exit early
        setRecallingStates(new Set());
      }

      setBulkProgress((prev) => ({
        ...prev,
        completed: completedCount,
        failed: failedCount,
        running: false,
      }));

      resetCancel();

      if (canceled) {
        if (completedCount > 0) {
          await loadTimerEntries();
        }
        toast({
          title: "Tilbakekalling avbrutt",
          description: `Tilbakekalte ${completedCount} av ${entriesToRecall.length} aktivitet${entriesToRecall.length === 1 ? "" : "er"}.`,
          variant: "destructive",
        });
      } else {
        if (completedCount > 0) {
          await loadTimerEntries();
        }

        if (failedEntries.length > 0) {
          toast({
            title: "Noen timer feilet",
            description: `${failedEntries.length} aktivitet${failedEntries.length === 1 ? "" : "er"} kunne ikke tilbakekalles.`,
            variant: "destructive",
          });
        }

        if (haltedByRateLimit) {
          toast({
            title: "Rate limit nådd",
            description: "Fullførte så langt som tillatt. Vent litt før du prøver igjen.",
            variant: "destructive",
          });
        }

        if (!cancelRequestedRef.current && completedCount > 0 && !options.skipSelectionReset) {
          setSelectedEntries(new Set());
        }

        const shouldShowSummary = !canceled && completedCount > 0 && entriesToRecall.length > 1;
        if (shouldShowSummary) {
          const failedSuffix =
            failedCount > 0
              ? ` • ${failedCount} aktivitet${failedCount === 1 ? "" : "er"} feilet`
              : "";
          toast({
            title: "Tilbakekalling fullført",
            description: `Tilbakekalte ${completedCount} av ${entriesToRecall.length} aktivitet${entriesToRecall.length === 1 ? "" : "er"}${failedSuffix}.`,
          });
        }
      }

      setBulkProgress((prev) => ({
        ...prev,
        running: false,
        mode: null,
      }));
      resetCancel();

      return {
        started: true,
        completedCount,
        failedCount,
        canceled,
        haltedByRateLimit,
      };
    },
    [
      profile?.org_id,
      toast,
      setBulkProgress,
      resetCancel,
      ensureRateLimitAvailable,
      setRecallingStates,
      rateLimitKey,
      supabase,
      applyRateLimitFromResponse,
      setSuccessStates,
      loadTimerEntries,
      setSelectedEntries,
    ],
  );

  const recallFromTripletex = async (grouped: GroupedTimerEntry) => {
    await runRecallForGroups([grouped], { skipSelectionReset: true });
  };

  const sendToTripletex = async () => {
    if (selectedEntries.size === 0 || !profile?.org_id) return;

    if (!ensureRateLimitAvailable()) {
      return;
    }

    setActionLoading((prev) => ({ ...prev, export: true }));
    try {
      const selectedGroups = groupedEntries.filter((grouped) =>
        selectedEntries.has(grouped.vaktId),
      );

      if (selectedGroups.length === 0) {
        setBulkProgress({ mode: null, total: 0, completed: 0, failed: 0, running: false });
        resetCancel();
        setActionLoading((prev) => ({ ...prev, export: false }));
        return;
      }

      const entriesToSend: Array<{
        entry: TimerEntry;
        grouped: GroupedTimerEntry;
      }> = [];

      selectedGroups.forEach((grouped) => {
        grouped.entries
          .filter(
            (entry) =>
              (entry.status === "godkjent" || entry.status === "klar") &&
              !entry.tripletex_entry_id,
          )
          .forEach((entry) => {
            entriesToSend.push({ entry, grouped });
          });
      });

      if (entriesToSend.length === 0) {
        toast({
          title: "Ingen gyldige timer",
          description: "Kun timer med status 'godkjent' eller 'klar' som ikke er sendt kan sendes til Tripletex.",
          variant: "destructive",
        });
        setBulkProgress({ mode: null, total: 0, completed: 0, failed: 0, running: false });
        resetCancel();
        setActionLoading((prev) => ({ ...prev, export: false }));
        return;
      }

      const invalidEntries = entriesToSend.filter(({ entry, grouped }) => {
        const hasProjectId = !!grouped.project?.tripletex_project_id;
        const hasActivityId = !!entry.ttx_activity_cache?.ttx_id;
        const hasEmployeeId = !!grouped.person.tripletex_employee_id;
        const projectInactive = grouped.project?.is_closed === true || grouped.project?.is_active === false;
        return !hasProjectId || !hasActivityId || !hasEmployeeId || projectInactive;
      });

      if (invalidEntries.length > 0) {
        toast({
          title: "Noen timer mangler nødvendig data",
          description: `${invalidEntries.length} timer kunne ikke sendes. Sjekk at alle har åpne Tripletex-prosjekter, aktivitet og ansatt-ID.`,
          variant: "destructive",
        });
      }

      const closedProjectCount = invalidEntries.filter(
        ({ grouped }) => grouped.project?.is_closed === true || grouped.project?.is_active === false,
      ).length;
      if (closedProjectCount > 0) {
        toast({
          title: "Prosjekt er lukket i Tripletex",
          description: `${closedProjectCount} valgt${closedProjectCount === 1 ? " prosjekt" : "e prosjekter"} er avsluttet i Tripletex og kan ikke motta timer.`,
          variant: "destructive",
        });
      }

      const validEntriesToSend = entriesToSend.filter(({ entry, grouped }) => {
        const hasProjectId = !!grouped.project?.tripletex_project_id;
        const hasActivityId = !!entry.ttx_activity_cache?.ttx_id;
        const hasEmployeeId = !!grouped.person.tripletex_employee_id;
        const projectInactive = grouped.project?.is_closed === true || grouped.project?.is_active === false;
        return hasProjectId && hasActivityId && hasEmployeeId && !projectInactive;
      });

      if (validEntriesToSend.length === 0) {
        setBulkProgress({ mode: null, total: 0, completed: 0, failed: 0, running: false });
        resetCancel();
        setActionLoading((prev) => ({ ...prev, export: false }));
        return;
      }

      resetCancel();
      setBulkProgress({
        mode: "send",
        total: validEntriesToSend.length,
        completed: 0,
        failed: 0,
        running: true,
      });

      const successfulVaktIds = new Set<string>();
      const failedEntries: Array<{ entry: TimerEntry; error: unknown }> = [];
      let completedCount = 0;
      let failedCount = 0;
      let haltedByRateLimit = false;
      let canceled = false;

      for (const { entry, grouped } of validEntriesToSend) {
        if (!grouped.person.tripletex_employee_id || !grouped.project?.tripletex_project_id) {
          continue;
        }

        if (cancelRequestedRef.current) {
          canceled = true;
          break;
        }

        if (rateLimitKey && TripletexRateLimiter.isLimited(rateLimitKey)) {
          const countdown = TripletexRateLimiter.getCountdown(rateLimitKey);
          toast({
            title: "Tripletex rate limit",
            description: `Vent ${countdown}s før du sender flere timer.`,
            variant: "destructive",
          });
          haltedByRateLimit = true;
          break;
        }

        setSendingStates((prev) => {
          const next = new Set(prev);
          next.add(entry.id);
          return next;
        });

        try {
          const { data, error } = await supabase.functions.invoke("tripletex-api", {
            body: {
              action: "send_timesheet_entry",
              vakt_timer_id: entry.id,
              employee_id: grouped.person.tripletex_employee_id!,
              project_id: grouped.project.tripletex_project_id!,
              activity_id: entry.ttx_activity_cache?.ttx_id || null,
              hours: entry.timer,
              date: grouped.date,
              is_overtime: entry.lonnstype?.toLowerCase().includes("overtid") || false,
              description: entry.notat || "",
              orgId: profile.org_id,
            },
          });

          if (error) {
            applyRateLimitFromResponse(error);
            throw error;
          }

          applyRateLimitFromResponse(data);

          if (!data?.success) {
            throw new Error(
              getFriendlyTripletexError(data) || data?.error || "Failed to send to Tripletex",
            );
          }

          completedCount += 1;
          successfulVaktIds.add(grouped.vaktId);
          setBulkProgress((prev) => ({
            ...prev,
            completed: completedCount,
          }));
        } catch (err: unknown) {
          failedCount += 1;
          failedEntries.push({ entry, error: err });
          const friendly =
            getFriendlyTripletexError(err) ||
            (err instanceof Error ? err.message : "En uventet feil oppstod");
          toast({
            title: "Sending feilet",
            description: friendly,
            variant: "destructive",
          });
          setBulkProgress((prev) => ({
            ...prev,
            failed: failedCount,
          }));
        } finally {
          setSendingStates((prev) => {
            const next = new Set(prev);
            next.delete(entry.id);
            return next;
          });
        }
      }

      for (const grouped of selectedGroups) {
        if (
          successfulVaktIds.has(grouped.vaktId) &&
          grouped.person.tripletex_employee_id &&
          grouped.project?.tripletex_project_id
        ) {
          const vehicleResponse = await supabase.functions.invoke("tripletex-api", {
            body: {
              action: "sync_vehicle_entries",
              vakt_id: grouped.vaktId,
              employee_id: grouped.person.tripletex_employee_id!,
              project_id: grouped.project.tripletex_project_id!,
              date: grouped.date,
              orgId: profile.org_id,
            },
          });

          if (vehicleResponse.error) {
            applyRateLimitFromResponse(vehicleResponse.error);
            console.warn("Sync vehicle entries failed:", vehicleResponse.error);
          } else {
            applyRateLimitFromResponse(vehicleResponse.data);
            if (!vehicleResponse.data?.success) {
              const errorMessage =
                getFriendlyTripletexError(vehicleResponse.data) ||
                vehicleResponse.data?.error ||
                "Kunne ikke synkronisere kjøretøylinjer.";
              toast({
                title: "Kjøretøy ikke synkronisert",
                description: errorMessage,
                variant: "destructive",
              });
            }
            const vehicleDetails = Array.isArray(vehicleResponse.data?.data?.details)
              ? vehicleResponse.data.data.details
              : [];
            const failedVehicleEntries = vehicleDetails.filter(
              (detail: { status?: string }) => detail?.status === "failed",
            );
            if (vehicleResponse.data?.success !== false && failedVehicleEntries.length > 0) {
              toast({
                title: "Kjøretøy feilet",
                description: `${failedVehicleEntries.length} registrering${
                  failedVehicleEntries.length === 1 ? "" : "er"
                } kunne ikke synkroniseres mot Tripletex.`,
                variant: "destructive",
              });
            }
          }
        }
      }

      setBulkProgress((prev) => ({
        ...prev,
        completed: completedCount,
        failed: failedCount,
        running: false,
      }));

      resetCancel();

      if (canceled) {
        if (completedCount > 0) {
          await loadTimerEntries();
        }
        toast({
          title: "Sending avbrutt",
          description: `Sendte ${completedCount} av ${validEntriesToSend.length} aktivitet${validEntriesToSend.length === 1 ? "" : "er"}.`,
          variant: "destructive",
        });
      } else {
        const successCount = successfulVaktIds.size;
        if (successCount > 0) {
          toast({
            title: "Timer sendt til Tripletex",
            description: `${successCount} linje${successCount === 1 ? "" : "r"} ble sendt.`,
          });
          setSelectedEntries(new Set());
          await loadTimerEntries();
        }

        if (failedEntries.length > 0) {
          toast({
            title: "Noen timer feilet",
            description: `${failedEntries.length} aktivitet${failedEntries.length === 1 ? "" : "er"} kunne ikke sendes.`,
            variant: "destructive",
          });
        }

        if (haltedByRateLimit) {
          toast({
            title: "Rate limit nådd",
            description: "Fullførte så langt som tillatt. Vent litt før du prøver igjen.",
            variant: "destructive",
          });
        }
      }
    } catch (error: unknown) {
      applyRateLimitFromResponse(error);
      toast({
        title: "Eksport til Tripletex feilet",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, export: false }));
      setBulkProgress((prev) => ({
        ...prev,
        running: false,
        mode: null,
      }));
      resetCancel();
    }
  };

  const recallBulkFromTripletex = async () => {
    if (!profile?.org_id) return;

    setActionLoading((prev) => ({ ...prev, recall: true }));
    try {
      const selectedGroups = groupedEntries.filter((grouped) =>
        selectedEntries.has(grouped.vaktId),
      );

      await runRecallForGroups(selectedGroups, { showEmptySelectionToast: true });
    } finally {
      setActionLoading((prev) => ({ ...prev, recall: false }));
    }
  };

  const sendGroupedToTripletex = useCallback(
    async (grouped: GroupedTimerEntry) => {
      if (!profile?.org_id) {
        toast({
          title: "Mangler organisasjon",
          description: "Kunne ikke sende timer fordi organisasjon ikke ble lastet.",
          variant: "destructive",
        });
        return;
      }

      if (!ensureRateLimitAvailable()) {
        return;
      }

      if (!grouped.person.tripletex_employee_id) {
        toast({
          title: "Manglende Tripletex-ansatt",
          description: "Koble den ansatte til Tripletex før du sender timen.",
          variant: "destructive",
        });
        return;
      }

      if (!grouped.project?.tripletex_project_id) {
        toast({
          title: "Manglende Tripletex-prosjekt",
          description: "Prosjektet mangler Tripletex ID. Synkroniser prosjektet før sending.",
          variant: "destructive",
        });
        return;
      }

      if (grouped.project?.is_closed === true || grouped.project?.is_active === false) {
        toast({
          title: "Prosjekt avsluttet",
          description: "Prosjektet er lukket i Tripletex og kan ikke ta imot flere timer.",
          variant: "destructive",
        });
        return;
      }

      // Get all entries that can be sent
      const entriesToSend = grouped.entries.filter(
        (entry) =>
          (entry.status === "godkjent" || entry.status === "klar") &&
          !entry.tripletex_entry_id &&
          entry.ttx_activity_cache?.ttx_id, // Must have activity ID
      );

      if (entriesToSend.length === 0) {
        toast({
          title: "Kan ikke sende",
          description: "Ingen timer kan sendes. Sjekk at de er godkjent og har aktivitet-ID.",
          variant: "destructive",
        });
        return;
      }

      // Set loading state (using vaktId)
      setSendingStates((prev) => {
        const next = new Set(prev);
        next.add(grouped.vaktId);
        return next;
      });

      try {
        // Send all entries in parallel (like bemanningsliste)
        const activityPromises = entriesToSend.map(async (entry) => {
          const { data, error } = await supabase.functions.invoke("tripletex-api", {
            body: {
              action: "send_timesheet_entry",
              vakt_timer_id: entry.id,
              employee_id: grouped.person.tripletex_employee_id!,
              project_id: grouped.project!.tripletex_project_id!,
              activity_id: entry.ttx_activity_cache?.ttx_id || null,
              hours: entry.timer,
              date: grouped.date,
              is_overtime: entry.lonnstype?.toLowerCase().includes("overtid") || false,
              description: entry.notat || "",
              orgId: profile.org_id,
            },
          });

          if (error) {
            applyRateLimitFromResponse(error);
            throw new Error(error instanceof Error ? error.message : "Failed to send to Tripletex");
          }

          applyRateLimitFromResponse(data);

          if (!data?.success) {
            const friendly = getFriendlyTripletexError(data) || data?.error || "Sending til Tripletex feilet.";
            throw new Error(friendly);
          }

          return data;
        });

        await Promise.all(activityPromises);

        // Sync vehicle compensation/orderlines after successful send
        if (grouped.person.tripletex_employee_id && grouped.project?.tripletex_project_id) {
          const vehicleResponse = await supabase.functions.invoke("tripletex-api", {
            body: {
              action: "sync_vehicle_entries",
              vakt_id: grouped.vaktId,
              employee_id: grouped.person.tripletex_employee_id,
              project_id: grouped.project.tripletex_project_id,
              date: grouped.date,
              orgId: profile.org_id,
            },
          });

          if (vehicleResponse.error) {
            applyRateLimitFromResponse(vehicleResponse.error);
            console.warn("Sync vehicle entries failed:", vehicleResponse.error);
          } else {
            applyRateLimitFromResponse(vehicleResponse.data);
            if (!vehicleResponse.data?.success) {
              const errorMessage =
                getFriendlyTripletexError(vehicleResponse.data) ||
                vehicleResponse.data?.error ||
                "Kunne ikke synkronisere kjøretøylinjer.";
              toast({
                title: "Kjøretøy ikke synkronisert",
                description: errorMessage,
                variant: "destructive",
              });
            }
            const vehicleDetails = Array.isArray(vehicleResponse.data?.data?.details)
              ? vehicleResponse.data.data.details
              : [];
            const failedVehicleEntries = vehicleDetails.filter(
              (detail: { status?: string }) => detail?.status === "failed",
            );
            if (vehicleResponse.data?.success !== false && failedVehicleEntries.length > 0) {
              toast({
                title: "Kjøretøy feilet",
                description: `${failedVehicleEntries.length} registrering${
                  failedVehicleEntries.length === 1 ? "" : "er"
                } kunne ikke synkroniseres mot Tripletex.`,
                variant: "destructive",
              });
            }
          }
        }

        // Show success state briefly
        setSuccessStates((prev) => {
          const next = new Set(prev);
          next.add(grouped.vaktId);
          return next;
        });

        const totalHours = entriesToSend.reduce((sum, entry) => sum + entry.timer, 0);
        const employeeName = getPersonDisplayName(grouped.person.fornavn, grouped.person.etternavn) || "Ukjent ansatt";

        toast({
          title: "Sendt til Tripletex",
          description: `${formatTimeValue(totalHours)} timer (${entriesToSend.length} ${entriesToSend.length === 1 ? "aktivitet" : "aktiviteter"}) sendt for ${employeeName} • ${new Date(grouped.date).toLocaleDateString("no-NO")}`,
        });

        // Clear success state after 1.5 seconds
        setTimeout(() => {
          setSuccessStates((prev) => {
            const next = new Set(prev);
            next.delete(grouped.vaktId);
            return next;
          });
        }, 1500);

        await loadTimerEntries();
      } catch (error: unknown) {
        applyRateLimitFromResponse(error);
        
        // Clear success state on error
        setSuccessStates((prev) => {
          const next = new Set(prev);
          next.delete(grouped.vaktId);
          return next;
        });
        
        const friendly =
          getFriendlyTripletexError(error) ||
          (error instanceof Error ? error.message : "En uventet feil oppstod under sending til Tripletex.");
        toast({
          title: "Sending feilet",
          description: friendly,
          variant: "destructive",
        });
      } finally {
        setSendingStates((prev) => {
          const next = new Set(prev);
          next.delete(grouped.vaktId);
          return next;
        });
      }
    },
    [profile?.org_id, ensureRateLimitAvailable, toast, loadTimerEntries, applyRateLimitFromResponse],
  );

  const sendSingleTimerToTripletex = useCallback(
    async (entry: TimerEntry) => {
      if (!profile?.org_id) {
        toast({
          title: "Mangler organisasjon",
          description: "Kunne ikke sende timer fordi organisasjon ikke ble lastet.",
          variant: "destructive",
        });
        return;
      }

      if (!ensureRateLimitAvailable()) {
        return;
      }

      if (!entry.vakt?.id) {
        toast({
          title: "Mangler vakt",
          description: "Timer mangler kobling til vakt og kan ikke sendes.",
          variant: "destructive",
        });
        return;
      }

      if (entry.status === "sendt" || entry.tripletex_entry_id) {
        toast({
          title: "Allerede sendt",
          description: "Denne timen er allerede sendt til Tripletex.",
        });
        return;
      }

      if (!["godkjent", "klar"].includes(entry.status)) {
        toast({
          title: "Kan ikke sende",
          description: "Timene må være klare eller godkjent før de kan sendes til Tripletex.",
          variant: "destructive",
        });
        return;
      }

      const employeeId = entry.vakt.person?.tripletex_employee_id;
      if (!employeeId) {
        toast({
          title: "Manglende Tripletex-ansatt",
          description: "Koble den ansatte til Tripletex før du sender timen.",
          variant: "destructive",
        });
        return;
      }

      const projectId = entry.vakt.ttx_project_cache?.tripletex_project_id;
      if (!projectId) {
        toast({
          title: "Manglende Tripletex-prosjekt",
          description: "Prosjektet mangler Tripletex ID. Synkroniser prosjektet før sending.",
          variant: "destructive",
        });
        return;
      }

      if (entry.vakt.ttx_project_cache?.is_closed === true || entry.vakt.ttx_project_cache?.is_active === false) {
        toast({
          title: "Prosjekt avsluttet",
          description: "Prosjektet er lukket i Tripletex og kan ikke ta imot flere timer.",
          variant: "destructive",
        });
        return;
      }

      const activityId = entry.ttx_activity_cache?.ttx_id;
      if (!activityId) {
        toast({
          title: "Manglende aktivitet",
          description: "Aktiviteten mangler Tripletex ID og kan ikke sendes.",
          variant: "destructive",
        });
        return;
      }

      const vaktId = entry.vakt.id;
      const date = entry.vakt.dato;
      const isOvertime = entry.lonnstype ? entry.lonnstype.toLowerCase().includes("overtid") : false;

      setSendingStates((prev) => {
        const next = new Set(prev);
        next.add(entry.id);
        return next;
      });

      try {
        const { data, error } = await supabase.functions.invoke("tripletex-api", {
          body: {
            action: "send_timesheet_entry",
            vakt_timer_id: entry.id,
            employee_id: employeeId,
            project_id: projectId,
            activity_id: activityId,
            hours: entry.timer,
            date,
            is_overtime: isOvertime,
            description: entry.notat || "",
            orgId: profile.org_id,
          },
        });

        if (error) {
          applyRateLimitFromResponse(error);
          throw error;
        }

        applyRateLimitFromResponse(data);

        if (!data?.success) {
          const friendly = getFriendlyTripletexError(data) || data?.error || "Sending til Tripletex feilet.";
          throw new Error(friendly);
        }

        const vehicleResponse = await supabase.functions.invoke("tripletex-api", {
          body: {
            action: "sync_vehicle_entries",
            vakt_id: vaktId,
            employee_id: employeeId,
            project_id: projectId,
            date,
            orgId: profile.org_id,
          },
        });

        if (vehicleResponse.error) {
          applyRateLimitFromResponse(vehicleResponse.error);
          console.warn("Sync vehicle entries failed:", vehicleResponse.error);
        } else {
          applyRateLimitFromResponse(vehicleResponse.data);
          if (!vehicleResponse.data?.success) {
            const errorMessage =
              getFriendlyTripletexError(vehicleResponse.data) ||
              vehicleResponse.data?.error ||
              "Kunne ikke synkronisere kjøretøylinjer.";
            toast({
              title: "Kjøretøy ikke synkronisert",
              description: errorMessage,
              variant: "destructive",
            });
          }
          const vehicleDetails = Array.isArray(vehicleResponse.data?.data?.details)
            ? vehicleResponse.data.data.details
            : [];
          const failedVehicleEntries = vehicleDetails.filter(
            (detail: { status?: string }) => detail?.status === "failed",
          );
          if (vehicleResponse.data?.success !== false && failedVehicleEntries.length > 0) {
            toast({
              title: "Kjøretøy feilet",
              description: `${failedVehicleEntries.length} registrering${
                failedVehicleEntries.length === 1 ? "" : "er"
              } kunne ikke synkroniseres mot Tripletex.`,
              variant: "destructive",
            });
          }
        }

        // Show success state briefly
      setSuccessStates((prev) => {
        const next = new Set(prev);
        next.add(entry.id);
        return next;
      });

      const employeeName =
          getPersonDisplayName(entry.vakt.person?.fornavn ?? "", entry.vakt.person?.etternavn ?? "") || "Ukjent ansatt";

        toast({
          title: "Sendt til Tripletex",
          description: `${employeeName} • ${new Date(date).toLocaleDateString("no-NO")}`,
        });

        // Clear success state after 1.5 seconds
        setTimeout(() => {
          setSuccessStates((prev) => {
            const next = new Set(prev);
            next.delete(entry.id);
            return next;
          });
        }, 1500);

        setSelectedEntries((prev) => {
          if (!prev.has(entry.id)) return prev;
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });

        await loadTimerEntries();
      } catch (error: unknown) {
        applyRateLimitFromResponse(error);
        
        // Clear success state on error
        setSuccessStates((prev) => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
        
        const friendly =
          getFriendlyTripletexError(error) ||
          (error instanceof Error ? error.message : "En uventet feil oppstod under sending til Tripletex.");
        toast({
          title: "Sending feilet",
          description: friendly,
          variant: "destructive",
        });
      } finally {
        setSendingStates((prev) => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
      }
    },
    [profile?.org_id, ensureRateLimitAvailable, toast, loadTimerEntries, applyRateLimitFromResponse],
  );

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
    // Prioritize tripletex_entry_id - if it exists, the entry is sent regardless of status field
    if (tripletexId) {
      return <Badge className="bg-blue-500 text-white">🔵 Sendt {`(#${tripletexId})`}</Badge>;
    }

    // Otherwise, use status field
    switch (status) {
      case "godkjent":
        return <Badge className="bg-green-500 text-white">🟢 Godkjent</Badge>;
      case "sendt":
        return <Badge className="bg-blue-500 text-white">🔵 Sendt</Badge>;
      case "klar":
        return <Badge className="bg-orange-500 text-white">🟠 Klar</Badge>;
      default:
        return <Badge variant="outline">📝 Kladd</Badge>;
    }
  };

  const getGroupedStatusBadge = (grouped: GroupedTimerEntry) => {
    // If all entries are sent, show "Sendt"
    if (grouped.hasTripletexEntries && grouped.entries.every((e) => e.tripletex_entry_id)) {
      return (
        <Badge className="bg-blue-500 text-white">
          🔵 Sendt
        </Badge>
      );
    }

    // If some entries are sent, show "Delvis sendt"
    if (grouped.hasTripletexEntries) {
      const sentCount = grouped.entries.filter((e) => e.tripletex_entry_id).length;
      return (
        <Badge className="bg-yellow-500 text-white">
          🟡 Delvis sendt ({sentCount}/{grouped.entries.length})
        </Badge>
      );
    }

    // If all are godkjent, show "Godkjent"
    if (grouped.allStatuses.size === 1 && grouped.allStatuses.has("godkjent")) {
      return <Badge className="bg-green-500 text-white">🟢 Godkjent</Badge>;
    }

    // If all are klar, show "Klar"
    if (grouped.allStatuses.size === 1 && grouped.allStatuses.has("klar")) {
      return <Badge className="bg-orange-500 text-white">🟠 Klar</Badge>;
    }

    // Mixed statuses - prioritize showing the most relevant status
    const statusList = Array.from(grouped.allStatuses);
    
    // If there's a mix, prioritize: godkjent > klar > others
    if (statusList.includes("godkjent")) {
      // If mixed with klar, show both
      if (statusList.includes("klar")) {
        return <Badge variant="outline">📝 Godkjent/Klar</Badge>;
      }
      // Otherwise show godkjent (most important status)
      return <Badge className="bg-green-500 text-white">🟢 Godkjent</Badge>;
    }
    
    if (statusList.includes("klar")) {
      return <Badge className="bg-orange-500 text-white">🟠 Klar</Badge>;
    }

    // Generic mixed status (for other combinations)
    return <Badge variant="outline">📝 Blandet status</Badge>;
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
  const isRateLimited = cooldownCountdown > 0;
  const isBulkRunning = bulkProgress.running;
  const progressTotal = bulkProgress.total || 0;
  const progressDone = bulkProgress.completed + bulkProgress.failed;
  const progressPercentage = progressTotal > 0 ? (progressDone / progressTotal) * 100 : 0;
  const bulkLabelBase = bulkProgress.mode === "recall"
    ? "Tilbakekaller fra Tripletex"
    : bulkProgress.mode === "send"
      ? "Sender til Tripletex"
      : "Behandler";
  const bulkStatusLabel = cancelRequested ? `Avbryter ${bulkProgress.mode === "recall" ? "tilbakekalling" : "sending"}...` : `${bulkLabelBase}...`;

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
        <div className="mx-auto max-w-[95vw] xl:max-w-7xl space-y-6">
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
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Hurtigvalg periode</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={isPeriodActive("currentMonth") ? "default" : "outline"}
                  onClick={() => applyPeriodFilter("currentMonth")}
                >
                  Denne måneden
                </Button>
                <Button
                  size="sm"
                  variant={isPeriodActive("previousMonth") ? "default" : "outline"}
                  onClick={() => applyPeriodFilter("previousMonth")}
                >
                  Forrige måned
                </Button>
                <Button
                  size="sm"
                  variant={isPeriodActive("currentWeek") ? "default" : "outline"}
                  onClick={() => applyPeriodFilter("currentWeek")}
                >
                  Denne uken
                </Button>
                <Button
                  size="sm"
                  variant={isPeriodActive("today") ? "default" : "outline"}
                  onClick={() => applyPeriodFilter("today")}
                >
                  Dag
                </Button>
                <Button size="sm" variant="ghost" onClick={clearDateFilters}>
                  Nullstill dato
                </Button>
              </div>
            </div>
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
                  {selectedCount} av {groupedEntries.length} linjer valgt
                </span>
                {selectedCount > 0 && (() => {
                  const selectedGroups = groupedEntries.filter((grouped) =>
                    selectedEntries.has(grouped.vaktId),
                  );
                  const hasRecallableEntries = selectedGroups.some((grouped) => grouped.hasTripletexEntries);
                  const hasSendableEntries = selectedGroups.some((grouped) => {
                    return grouped.entries.some((entry) =>
                      (entry.status === "godkjent" || entry.status === "klar") &&
                      !entry.tripletex_entry_id &&
                      grouped.person.tripletex_employee_id &&
                      grouped.project?.tripletex_project_id &&
                      entry.ttx_activity_cache?.ttx_id
                    );
                  });

                  return (
                    <div className="flex gap-2">
                    <Button onClick={markAsApproved} disabled={isBulkRunning || actionLoading.approve} size="sm">
                      {actionLoading.approve ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      Merk som godkjent
                    </Button>
                    <Button
                      onClick={markAsUnapproved}
                      disabled={isBulkRunning || actionLoading.unapprove}
                      size="sm"
                      variant="outline"
                      className="border-gray-500 text-gray-600 hover:bg-gray-50"
                    >
                      {actionLoading.unapprove ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <X className="mr-2 h-4 w-4" />
                      )}
                      Avgodkjenn
                    </Button>
                    <Button
                      onClick={sendToTripletex}
                      disabled={isBulkRunning || actionLoading.export || isRateLimited || !hasSendableEntries}
                      size="sm"
                      variant="outline"
                    >
                      {actionLoading.export ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sender...
                        </>
                      ) : isRateLimited ? (
                        <>
                          <Timer className="mr-2 h-4 w-4" />
                          Vent {cooldownCountdown}s
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send til Tripletex
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={recallBulkFromTripletex}
                      disabled={isBulkRunning || actionLoading.recall || isRateLimited || !hasRecallableEntries}
                      size="sm"
                      variant="outline"
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      {actionLoading.recall ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Tilbakekaller...
                        </>
                      ) : isRateLimited ? (
                        <>
                          <Timer className="mr-2 h-4 w-4" />
                          Vent {cooldownCountdown}s
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Tilbakekall fra Tripletex
                        </>
                      )}
                    </Button>
                    <Button onClick={exportWeekCSV} variant="outline" size="sm" disabled={isBulkRunning}>
                      <Download className="mr-2 h-4 w-4" />
                      Eksporter CSV
                    </Button>
                    <Button onClick={exportMonthCSV} variant="outline" size="sm" disabled={isBulkRunning}>
                      <FileText className="mr-2 h-4 w-4" />
                      Måned CSV
                    </Button>
                  </div>
                  );
                })()}
              </div>
            </div>
            {isBulkRunning && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{bulkStatusLabel}</span>
                  <span>
                    {progressDone}/{progressTotal}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={progressPercentage} className="h-2 flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={requestCancel}
                    disabled={cancelRequested}
                  >
                    {cancelRequested ? "Avbryter..." : "Avbryt"}
                  </Button>
                </div>
                {bulkProgress.failed > 0 && (
                  <div className="text-xs text-destructive">
                    {bulkProgress.failed} aktivitet{bulkProgress.failed === 1 ? "" : "er"} feilet
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
                Laster timer...
              </div>
            ) : (
              <div className="overflow-x-auto w-full" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
                <table className="text-sm" style={{ minWidth: '1350px', width: '100%', tableLayout: 'fixed' }}>
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-12 px-4 py-3 text-left">
                      <Checkbox
                        checked={selectedEntries.size === groupedEntries.length && groupedEntries.length > 0}
                        onCheckedChange={toggleAllSelection}
                      />
                    </th>
                    <th className="w-[110px] min-w-[110px] px-3 py-3 text-left whitespace-nowrap">Ansatt</th>
                    <th className="w-[95px] min-w-[95px] px-4 py-3 text-left whitespace-nowrap">Dato</th>
                    <th className="w-[180px] min-w-[180px] px-4 py-3 text-left">Prosjekt</th>
                    <th className="w-[95px] min-w-[95px] px-3 py-3 text-left whitespace-nowrap">Aktivitet</th>
                    <th className="w-[150px] min-w-[150px] px-3 py-3 text-left">Kjøretøy</th>
                    <th className="w-[75px] min-w-[75px] px-3 py-3 text-left whitespace-nowrap">Type</th>
                    <th className="w-[90px] min-w-[90px] px-3 py-3 text-right whitespace-nowrap">Timer</th>
                    <th className="w-[110px] min-w-[110px] px-3 py-3 text-left">Notat</th>
                    <th className="w-[125px] min-w-[125px] px-3 py-3 text-left whitespace-nowrap">Status</th>
                    <th className="w-[200px] min-w-[200px] px-3 py-3 text-left whitespace-nowrap">Aksjon</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedEntries.map((grouped) => {
                    // Get first entry for activity display (entries have same aktivitet in a group)
                    const firstEntry = grouped.entries[0];
                    const activityDisplay = getActivityDisplay(firstEntry.ttx_activity_cache?.navn);
                    const ActivityIcon = activityDisplay.icon;
                    const vehicles = grouped.vehicles;
                    
                    const projectLabel = grouped.project
                      ? (() => {
                          const projectNumber = grouped.project.project_number;
                          const projectName = grouped.project.project_name || "";
                          
                          // Check if project name already starts with the project number
                          if (projectNumber && projectName.startsWith(`${projectNumber} `)) {
                            return projectName;
                          } else if (projectNumber && projectName) {
                            return `${projectNumber} - ${projectName}`;
                          } else {
                            return projectName || `Prosjekt ${projectNumber || ""}`.trim() || "Prosjekt";
                          }
                        })()
                      : "Ikke tilordnet";

                    // Build timer display with structured vertical layout
                    const timerDisplay = (
                      <div className="text-right">
                        <div className="font-mono font-semibold">{formatTimeValue(grouped.totalHours)} t</div>
                        {(grouped.hoursByType.normal > 0 || grouped.hoursByType.overtid_50 > 0 || grouped.hoursByType.overtid_100 > 0) && (
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {grouped.hoursByType.normal > 0 && (
                              <div className="font-mono">Normal: {formatTimeValue(grouped.hoursByType.normal)}</div>
                            )}
                            {grouped.hoursByType.overtid_50 > 0 && (
                              <div className="font-mono">⚡50: {formatTimeValue(grouped.hoursByType.overtid_50)}</div>
                            )}
                            {grouped.hoursByType.overtid_100 > 0 && (
                              <div className="font-mono">⚡⚡100: {formatTimeValue(grouped.hoursByType.overtid_100)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );

                    // Get aggregated notes (show if any entry has a note)
                    const hasNote = grouped.entries.some((e) => e.notat);
                    const firstNote = grouped.entries.find((e) => e.notat)?.notat;
                    const hasTripletexSource = grouped.entries.some((e) => e.kilde === "tripletex");

                    // Determine if we can send/recall/approve based on individual entries
                    // Godkjenn: show if at least one entry is not godkjent/sendt
                    const canApprove = grouped.entries.some((e) => 
                      e.status !== "godkjent" && e.status !== "sendt" && !e.tripletex_entry_id);
                    
                    // Avgodkjenn: show if at least one entry is godkjent/sendt but NOT sent to Tripletex
                    const canUnapprove = grouped.entries.some((e) => 
                      (e.status === "godkjent" || e.status === "sendt") && !e.tripletex_entry_id);
                    
                    // Send til Tripletex: show if at least one entry is godkjent/klar and NOT sent
                    const isProjectClosed = grouped.project?.is_closed === true || grouped.project?.is_active === false;
                    const canSend = !isProjectClosed && grouped.entries.some((e) => 
                      (e.status === "godkjent" || e.status === "klar") && !e.tripletex_entry_id);
                    
                    // Tilbakekall: show if at least one entry IS sent to Tripletex
                    const canRecall = grouped.entries.some((e) => e.tripletex_entry_id);

                    // Check loading states (using vaktId)
                    const isSending = sendingStates.has(grouped.vaktId);
                    const isRecalling = recallingStates.has(grouped.vaktId);
                    const isSuccess = successStates.has(grouped.vaktId);

                    return (
                      <tr key={grouped.vaktId} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedEntries.has(grouped.vaktId)}
                            onCheckedChange={() => toggleEntrySelection(grouped.vaktId)}
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap w-[110px] min-w-[110px]">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">
                              {getPersonDisplayName(grouped.person.fornavn, grouped.person.etternavn)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap w-[95px] min-w-[95px]">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span>{new Date(grouped.date).toLocaleDateString("no-NO")}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 w-[180px] min-w-[180px]">
                          <span className="line-clamp-2 text-sm">{projectLabel}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap w-[95px] min-w-[95px]">
                          <Badge variant={activityDisplay.variant} className="flex items-center gap-1 w-fit">
                            <ActivityIcon className="h-3 w-3" />
                            <span className="truncate">{activityDisplay.label}</span>
                          </Badge>
                        </td>
                        <td className="px-3 py-3 w-[150px] min-w-[150px]">
                          {vehicles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {vehicles.map((vehicle) => {
                                const meta = vehicleDisplayMeta[vehicle.vehicle_type];
                                const VehicleIcon = meta.icon;
                                const distance = vehicle.distance_km;

                                return (
                                  <Badge
                                    key={vehicle.id}
                                    variant="secondary"
                                    className="flex items-center gap-1"
                                  >
                                    <VehicleIcon className="h-3 w-3" />
                                    <span>{meta.label}</span>
                                    {typeof distance === "number" && distance > 0 && (
                                      <span className="font-mono text-xs">{distance} km</span>
                                    )}
                                  </Badge>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Ingen</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap w-[75px] min-w-[75px]">
                          <div className="flex flex-wrap gap-1">
                            {grouped.hoursByType.normal > 0 && (
                              <Badge variant="outline" className="text-xs">Normal</Badge>
                            )}
                            {grouped.hoursByType.overtid_50 > 0 && (
                              <Badge variant="outline" className="text-xs">⚡50</Badge>
                            )}
                            {grouped.hoursByType.overtid_100 > 0 && (
                              <Badge variant="outline" className="text-xs">⚡⚡100</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap w-[90px] min-w-[90px]">{timerDisplay}</td>
                        <td className="px-3 py-3 w-[110px] min-w-[110px]">
                          <div className="flex items-start gap-1">
                            {hasNote && firstNote && (
                              <>
                                <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />
                                <span className="line-clamp-2 text-xs" title={firstNote}>
                                  {firstNote}
                                </span>
                              </>
                            )}
                            {hasTripletexSource && <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap w-[125px] min-w-[125px]">{getGroupedStatusBadge(grouped)}</td>
                        <td className="px-3 py-3 whitespace-nowrap align-middle" style={{ minWidth: '200px', width: '200px', flexShrink: 0 }}>
                          <div className="flex items-center gap-1" style={{ minWidth: '180px' }}>
                            {/* Rediger knapp - alltid synlig */}
                            <Button
                              onClick={() => handleOpenEdit(grouped)}
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 flex-shrink-0"
                              title="Rediger timer"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            
                            {/* Godkjenn knapp - vis hvis noen entries ikke er godkjent */}
                            {canApprove && (
                              <Button
                                onClick={async () => {
                                  // Approve all entries in the group that can be approved
                                  const entriesToApprove = grouped.entries.filter((e) => 
                                    e.status !== "godkjent" && e.status !== "sendt" && !e.tripletex_entry_id
                                  );
                                  if (entriesToApprove.length > 0 && profile?.org_id) {
                                    try {
                                      const { error } = await supabase
                                        .from("vakt_timer")
                                        .update({ status: "godkjent" })
                                        .in("id", entriesToApprove.map((e) => e.id))
                                        .eq("org_id", profile.org_id);

                                      if (error) throw error;

                                      toast({
                                        title: "Timer godkjent",
                                        description: `${entriesToApprove.length} ${entriesToApprove.length === 1 ? "aktivitet" : "aktiviteter"} ble markert som godkjent.`,
                                      });

                                      loadTimerEntries();
                                    } catch (error: unknown) {
                                      toast({
                                        title: "Godkjenning feilet",
                                        description: error instanceof Error ? error.message : "En uventet feil oppstod",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 flex-shrink-0 border-green-500 text-green-600 hover:bg-green-50"
                                title="Godkjenn alle timer i denne linjen"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Avgodkjenn knapp - vis hvis noen entries er godkjent og ikke sendt */}
                            {canUnapprove && (
                              <Button
                                onClick={async () => {
                                  // Unapprove all entries in the group that can be unapproved
                                  const entriesToUnapprove = grouped.entries.filter((e) => 
                                    (e.status === "godkjent" || e.status === "sendt") && !e.tripletex_entry_id
                                  );
                                  if (entriesToUnapprove.length > 0 && profile?.org_id) {
                                    try {
                                      const { data, error } = await supabase.functions.invoke("tripletex-api", {
                                        body: {
                                          action: "unapprove_timesheet_entries",
                                          entry_ids: entriesToUnapprove.map((e) => e.id),
                                          orgId: profile.org_id,
                                        },
                                      });

                                      if (error) throw error;

                                      if (!data?.success) {
                                        throw new Error(data?.error || "Kunne ikke avgodkjenne timer");
                                      }

                                      toast({
                                        title: "Godkjenning trukket tilbake",
                                        description: `${entriesToUnapprove.length} ${entriesToUnapprove.length === 1 ? "aktivitet" : "aktiviteter"} ble satt tilbake til utkast-status.`,
                                      });

                                      loadTimerEntries();
                                    } catch (error: unknown) {
                                      toast({
                                        title: "Avgodkjenning feilet",
                                        description: error instanceof Error ? error.message : "En uventet feil oppstod",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 flex-shrink-0 border-gray-500 text-gray-600 hover:bg-gray-50"
                                title="Avgodkjenn alle timer i denne linjen"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Send til Tripletex knapp - vis hvis kan sendes */}
                            {canSend && (
                              <Button
                                onClick={() => {
                                  // Send all entries in the group (like bemanningsliste)
                                  sendGroupedToTripletex(grouped);
                                }}
                                size="icon"
                                variant="outline"
                                className={`h-8 w-8 flex-shrink-0 border-blue-500 text-blue-600 hover:bg-blue-50 ${
                                  (isSending || isBulkRunning || isProjectClosed) ? 'opacity-60 cursor-not-allowed' : ''
                                }`}
                                disabled={isBulkRunning || isRateLimited || isSending || isRecalling || isProjectClosed}
                                title={
                                  isRateLimited
                                    ? `Vent ${cooldownCountdown}s før du sender flere timer`
                                    : isSending
                                    ? "Sender til Tripletex..."
                                    : isProjectClosed
                                    ? "Prosjektet er lukket i Tripletex"
                                    : "Send alle timer til Tripletex"
                                }
                              >
                                {isSending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isSuccess ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            )}

                            {/* Tilbakekall fra Tripletex knapp - vis hvis sendt */}
                            {canRecall && (
                              <Button
                                onClick={() => recallFromTripletex(grouped)}
                                size="icon"
                                variant="outline"
                                className={`h-8 w-8 flex-shrink-0 border-orange-500 text-orange-600 hover:bg-orange-50 ${
                                  (isRecalling || isBulkRunning) ? 'opacity-60 cursor-not-allowed' : ''
                                }`}
                                disabled={isBulkRunning || isRecalling || isSending}
                                title={
                                  isRecalling
                                    ? "Kaller tilbake fra Tripletex..."
                                    : "Tilbakekall alle timer fra Tripletex"
                                }
                              >
                                {isRecalling ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isSuccess ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {groupedEntries.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                        Ingen timer funnet med gjeldende filtre.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    <Dialog open={Boolean(editingVaktId)} onOpenChange={(open) => {
      if (!open) {
        handleCloseEdit();
      }
    }}>
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
              Oppdater timer, aktivitet og kjøretøydata. Endringer følger samme regler som i bemanningslisten.
            </DialogDescription>
          </DialogHeader>
          {editingVaktId && profile?.org_id && (
            <TimeEntry
              vaktId={editingVaktId}
              orgId={profile.org_id}
              onSave={async () => {
                await loadTimerEntries();
                handleCloseEdit();
              }}
              onClose={handleCloseEdit}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
    </ProtectedRoute>
  );
};

export default AdminTimerPage;
