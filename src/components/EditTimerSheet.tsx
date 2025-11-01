'use client';

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveVehicleEntry } from "@/lib/vehicleEntries";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const QUICK_HOURS = [
  { label: "0t 30m", value: 0.5 },
  { label: "1t", value: 1 },
  { label: "7t 30m", value: 7.5 },
  { label: "8t", value: 8 },
];

type VehicleType = "servicebil" | "km_utenfor" | "tilhenger";

interface VehicleEntry {
  id: string;
  vakt_id: string;
  vehicle_type: VehicleType;
  distance_km: number | null;
  tripletex_entry_id: number | null;
}

interface EditableTimerEntry {
  id: string;
  timer: number;
  notat: string | null;
  status: string;
  lonnstype: string;
  aktivitet_id: string | null;
  tripletex_entry_id: number | null;
  vakt: {
    id?: string;
    dato: string;
    person: {
      id?: string;
      fornavn: string;
      etternavn: string;
    } | null;
    ttx_project_cache: {
      id: string;
      project_name: string;
      project_number: number | null;
      tripletex_project_id: number | null;
    } | null;
  } | null;
  ttx_activity_cache: {
    id: string;
    navn: string;
    ttx_id: number | null;
  } | null;
  vehicles: VehicleEntry[];
}

interface EditTimerSheetProps {
  open: boolean;
  entry: EditableTimerEntry | null;
  orgId: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

interface ProjectOption {
  id: string;
  project_name: string | null;
  project_number: number | null;
  tripletex_project_id: number | null;
}

interface ActivityOption {
  id: string;
  navn: string | null;
  ttx_id: number | null;
}

interface VehicleToggleState {
  enabled: boolean;
  entryId: string | null;
  tripletexEntryId: number | null;
  distanceKm: number;
}

const defaultVehicleState: VehicleToggleState = {
  enabled: false,
  entryId: null,
  tripletexEntryId: null,
  distanceKm: 0,
};

const formatProjectLabel = (project: ProjectOption) => {
  const numberPart = project.project_number ? `${project.project_number}` : null;
  const namePart = project.project_name || "Prosjekt";
  return [numberPart, namePart].filter(Boolean).join(" - ");
};

export function EditTimerSheet({ open, entry, orgId, onClose, onSaved }: EditTimerSheetProps) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  const [servicebil, setServicebil] = useState<VehicleToggleState>(defaultVehicleState);
  const [kmUtenfor, setKmUtenfor] = useState<VehicleToggleState>(defaultVehicleState);
  const [tilhenger, setTilhenger] = useState<VehicleToggleState>(defaultVehicleState);

  const vaktId = entry?.vakt?.id ?? null;

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id === selectedActivityId) ?? null,
    [activities, selectedActivityId],
  );

  useEffect(() => {
    if (!open || !entry) {
      return;
    }

    setLoadingOptions(true);
    const loadOptions = async () => {
      try {
        const [{ data: projectData }, { data: activityData }] = await Promise.all([
          supabase
            .from("ttx_project_cache")
            .select("id, project_name, project_number, tripletex_project_id")
            .eq("org_id", orgId)
            .order("project_name"),
          supabase
            .from("ttx_activity_cache")
            .select("id, navn, ttx_id")
            .eq("org_id", orgId)
            .order("navn"),
        ]);

        setProjects(projectData || []);
        setActivities(activityData || []);
      } catch (error) {
        console.error("Failed to load projects/activities", error);
        toast({
          title: "Kunne ikke laste valg",
          description: "Forsøk igjen senere.",
          variant: "destructive",
        });
      } finally {
        setLoadingOptions(false);
      }
    };

    void loadOptions();
  }, [open, entry, orgId, toast]);

  useEffect(() => {
    if (!open || !entry) {
      return;
    }

    const totalHours = entry.timer ?? 0;
    const wholeHours = Math.floor(totalHours);
    const remainingMinutes = Math.round((totalHours - wholeHours) * 60);

    setHours(wholeHours);
    setMinutes(remainingMinutes);
    setNote(entry.notat ?? "");
    setSelectedProjectId(entry.vakt?.ttx_project_cache?.id ?? null);
    setSelectedActivityId(entry.ttx_activity_cache?.id ?? null);

    const servicebilEntry = entry.vehicles.find((vehicle) => vehicle.vehicle_type === "servicebil") ?? null;
    const kmEntry = entry.vehicles.find((vehicle) => vehicle.vehicle_type === "km_utenfor") ?? null;
    const trailerEntry = entry.vehicles.find((vehicle) => vehicle.vehicle_type === "tilhenger") ?? null;

    setServicebil({
      enabled: Boolean(servicebilEntry),
      entryId: servicebilEntry?.id ?? null,
      tripletexEntryId: servicebilEntry?.tripletex_entry_id ?? null,
      distanceKm: 0,
    });

    setKmUtenfor({
      enabled: Boolean(kmEntry),
      entryId: kmEntry?.id ?? null,
      tripletexEntryId: kmEntry?.tripletex_entry_id ?? null,
      distanceKm: kmEntry?.distance_km ?? 0,
    });

    setTilhenger({
      enabled: Boolean(trailerEntry),
      entryId: trailerEntry?.id ?? null,
      tripletexEntryId: trailerEntry?.tripletex_entry_id ?? null,
      distanceKm: 0,
    });
  }, [open, entry]);

  const handleQuickHours = (value: number) => {
    const wholeHours = Math.floor(value);
    const remainingMinutes = Math.round((value - wholeHours) * 60);
    setHours(wholeHours);
    setMinutes(remainingMinutes);
  };

  const handleSave = async () => {
    if (!entry || !orgId || !vaktId) {
      return;
    }

    if (!selectedProjectId) {
      toast({
        title: "Velg prosjekt",
        description: "Du må velge hvilket prosjekt timen tilhører.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedActivityId) {
      toast({
        title: "Velg aktivitet",
        description: "Du må velge en aktivitet.",
        variant: "destructive",
      });
      return;
    }

    const totalHours = hours + minutes / 60;
    if (totalHours <= 0) {
      toast({
        title: "Manglende timer",
        description: "Legg til timer før du lagrer.",
        variant: "destructive",
      });
      return;
    }

    if (kmUtenfor.enabled && kmUtenfor.distanceKm <= 0) {
      toast({
        title: "Manglende kilometer",
        description: "Oppgi antall kilometer for kjøring utenfor.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      await supabase
        .from("vakt_timer")
        .update({
          timer: totalHours,
          notat: note || null,
          aktivitet_id: selectedActivityId,
        })
        .eq("id", entry.id);

      if (entry.vakt?.ttx_project_cache?.id !== selectedProjectId) {
        await supabase
          .from("vakt")
          .update({
            project_id: selectedProjectId,
          })
          .eq("id", vaktId);
      }

      await Promise.all([
        saveVehicleEntry({
          supabase,
          vaktId,
          orgId,
          vehicleType: servicebil.enabled ? "servicebil" : "none",
          distanceKm: 0,
          existingEntryId: servicebil.entryId,
          existingTripletexEntryId: servicebil.tripletexEntryId ?? undefined,
        }),
        saveVehicleEntry({
          supabase,
          vaktId,
          orgId,
          vehicleType: kmUtenfor.enabled ? "km_utenfor" : "none",
          distanceKm: kmUtenfor.enabled ? kmUtenfor.distanceKm : 0,
          existingEntryId: kmUtenfor.entryId,
          existingTripletexEntryId: kmUtenfor.tripletexEntryId ?? undefined,
        }),
        saveVehicleEntry({
          supabase,
          vaktId,
          orgId,
          vehicleType: tilhenger.enabled ? "tilhenger" : "none",
          distanceKm: 0,
          existingEntryId: tilhenger.entryId,
          existingTripletexEntryId: tilhenger.tripletexEntryId ?? undefined,
        }),
      ]);

      toast({
        title: "Endringer lagret",
        description: "Timer og kjøretøydata er oppdatert.",
      });

      await onSaved();
    } catch (error: unknown) {
      console.error("Failed to save timer", error);
      toast({
        title: "Lagring feilet",
        description: error instanceof Error ? error.message : "Kunne ikke lagre oppdateringene.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const disableSave = saving || loadingOptions;

  return (
    <Sheet open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-1">
          <SheetTitle>Rediger timer</SheetTitle>
          {entry && (
            <p className="text-sm text-muted-foreground">
              {entry.vakt?.person
                ? `${entry.vakt.person.fornavn} ${entry.vakt.person.etternavn}`
                : "Ukjent ansatt"}{" "}
              • {entry.vakt?.dato ? new Date(entry.vakt.dato).toLocaleDateString("no-NO") : "Ukjent dato"}
            </p>
          )}
        </SheetHeader>

        {!entry ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Ingen time valgt
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-6">
            <div className="space-y-3">
              <Label>Timer</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    value={hours}
                    onChange={(event) => setHours(Math.max(0, Number(event.target.value)))}
                    aria-label="Timer"
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={(event) => {
                      const value = Math.min(59, Math.max(0, Number(event.target.value)));
                      setMinutes(value);
                    }}
                    aria-label="Minutter"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_HOURS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickHours(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-select">Prosjekt</Label>
              <Select
                value={selectedProjectId ?? ""}
                onValueChange={(value) => setSelectedProjectId(value)}
                disabled={loadingOptions}
              >
                <SelectTrigger id="project-select">
                  <SelectValue placeholder={loadingOptions ? "Laster prosjekter..." : "Velg prosjekt"}>
                    {selectedProject ? formatProjectLabel(selectedProject) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {formatProjectLabel(project)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-select">Aktivitet</Label>
              <Select
                value={selectedActivityId ?? ""}
                onValueChange={(value) => setSelectedActivityId(value)}
                disabled={loadingOptions}
              >
                <SelectTrigger id="activity-select">
                  <SelectValue placeholder={loadingOptions ? "Laster aktiviteter..." : "Velg aktivitet"}>
                    {selectedActivity
                      ? selectedActivity.navn ?? "Ukjent aktivitet"
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activities.map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      {activity.navn ?? "Ukjent aktivitet"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Notat</Label>
              <Textarea
                id="note"
                placeholder="Legg til detaljer..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Servicebil</Label>
                  <p className="text-xs text-muted-foreground">Merk hvis servicebil ble brukt denne dagen.</p>
                </div>
                <Switch
                  checked={servicebil.enabled}
                  onCheckedChange={(checked) =>
                    setServicebil((prev) => ({
                      ...prev,
                      enabled: checked,
                    }))
                  }
                />
              </div>

              <div className="space-y-2 rounded border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Km utenfor</Label>
                    <p className="text-xs text-muted-foreground">Registrer distanse hvis du har kjørt utenfor avtalt område.</p>
                  </div>
                  <Switch
                    checked={kmUtenfor.enabled}
                    onCheckedChange={(checked) =>
                      setKmUtenfor((prev) => ({
                        ...prev,
                        enabled: checked,
                      }))
                    }
                  />
                </div>
                {kmUtenfor.enabled && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={kmUtenfor.distanceKm}
                      onChange={(event) =>
                        setKmUtenfor((prev) => ({
                          ...prev,
                          distanceKm: Math.max(0, Number(event.target.value)),
                        }))
                      }
                    />
                    <span className="text-sm text-muted-foreground">km</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Tilhenger</Label>
                  <p className="text-xs text-muted-foreground">Aktiver hvis tilhenger ble brukt.</p>
                </div>
                <Switch
                  checked={tilhenger.enabled}
                  onCheckedChange={(checked) =>
                    setTilhenger((prev) => ({
                      ...prev,
                      enabled: checked,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        )}

        <SheetFooter className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={saving}>
            Avbryt
          </Button>
          <Button type="button" onClick={handleSave} disabled={disableSave} className="flex-1">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Lagre endringer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
