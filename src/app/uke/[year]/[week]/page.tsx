"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Plus,
  Download,
  Settings,
} from "lucide-react";
import {
  getDateFromWeek,
  getWeekNumber,
  getPersonDisplayName,
  generateProjectColor,
  getContrastColor,
} from "@/lib/displayNames";
import { toLocalDateString } from "@/lib/utils";

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

interface CalendarDay {
  dato: string;
  iso_uke: number;
  iso_ar: number;
  is_weekend: boolean;
  is_holiday: boolean;
  holiday_name: string | null;
}

interface WeekEntry {
  id: string;
  person: {
    fornavn: string;
    etternavn: string;
  } | null;
  ttx_project_cache: {
    project_name: string;
    tripletex_project_id: number;
  } | null;
  vakt_timer: Array<{
    timer: number;
    status: string;
    ttx_activity_cache: {
      navn: string;
    } | null;
  }>;
}

const UkePage = () => {
  const params = useParams<{ year: string; week: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [weekEntries, setWeekEntries] = useState<WeekEntry[]>([]);
  const [projectColors, setProjectColors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [fillWeekSettings, setFillWeekSettings] = useState({ includeHolidays: false });

  const currentYear = Number.parseInt(params?.year ?? `${new Date().getFullYear()}`, 10);
  const currentWeek = Number.parseInt(params?.week ?? `${getWeekNumber(new Date())}`, 10);

  const loadUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, org:org_id (id, name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      setProfile((data as Profile) ?? null);
    } catch (err) {
      console.error("Error loading profile:", err);
      setProfile(null);
    }
  }, [user]);

  const loadWeekData = useCallback(async () => {
    if (!profile?.org_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const startDate = getDateFromWeek(currentYear, currentWeek);
      const weekDates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        weekDates.push(toLocalDateString(date));
      }

      await supabase.functions.invoke("calendar-sync", {
        body: { monthsAhead: 3 },
      });

      const { data: calendarData } = await supabase
        .from("kalender_dag")
        .select("*")
        .in("dato", weekDates)
        .order("dato");

      setCalendarDays((calendarData as CalendarDay[]) ?? []);

      const { data: entriesData } = await supabase
        .from("vakt")
        .select(
          `
            id,
            person:person_id (
              fornavn,
              etternavn
            ),
            ttx_project_cache:project_id (
              project_name,
              tripletex_project_id
            ),
            vakt_timer (
              timer,
              status,
              ttx_activity_cache!aktivitet_id (
                navn
              )
            )
          `,
        )
        .eq("org_id", profile.org_id)
        .in("dato", weekDates);

      setWeekEntries((entriesData as WeekEntry[]) ?? []);

      const { data: colorData } = await supabase
        .from("project_color")
        .select("tripletex_project_id, hex")
        .eq("org_id", profile.org_id);

      const colorMap: Record<number, string> = {};
      colorData?.forEach((color: { tripletex_project_id: number | null; hex: string }) => {
        if (color.tripletex_project_id !== null) {
          colorMap[color.tripletex_project_id] = color.hex;
        }
      });
      setProjectColors(colorMap);
    } catch (err) {
      console.error("Error loading week data:", err);
      toast({
        title: "Feil ved lasting",
        description: "Kunne ikke laste ukedata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id, currentYear, currentWeek, toast]);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user, loadUserProfile]);

  useEffect(() => {
    if (profile) {
      loadWeekData();
    }
  }, [profile, loadWeekData]);

  const navigateWeek = (delta: number) => {
    let newYear = currentYear;
    let newWeek = currentWeek + delta;

    const lastWeekOfYear = getWeekNumber(new Date(currentYear, 11, 31));

    if (newWeek > lastWeekOfYear) {
      newYear += 1;
      newWeek = 1;
    } else if (newWeek < 1) {
      newYear -= 1;
      const newLastWeek = getWeekNumber(new Date(newYear, 11, 31));
      newWeek = newLastWeek;
    }

    router.push(`/uke/${newYear}/${newWeek.toString().padStart(2, "0")}`);
  };

  const getProjectColor = (projectId?: number) => {
    if (!projectId) return generateProjectColor(0);
    return projectColors[projectId] || generateProjectColor(projectId);
  };

  const getDayHeaderClass = (day: CalendarDay) => {
    let className = "text-center p-2 font-medium ";

    if (day.is_weekend) {
      className += "bg-muted/50 ";
    }

    if (day.is_holiday) {
      className += "bg-red-50 border-l-4 border-red-500 ";
    }

    return className;
  };

  const exportWeekCSV = async () => {
    try {
      const csvData = weekEntries.map((entry) => ({
        Ansatt: entry.person ? getPersonDisplayName(entry.person.fornavn, entry.person.etternavn) : "Ukjent",
        Prosjekt: entry.ttx_project_cache?.project_name || "Ikke tilordnet",
        ProsjektNr: entry.ttx_project_cache?.tripletex_project_id || "",
        Timer: entry.vakt_timer.reduce((sum, timer) => sum + timer.timer, 0),
        Status: entry.vakt_timer.map((timer) => timer.status).join(", "),
        Aktiviteter: entry.vakt_timer.map((timer) => timer.ttx_activity_cache?.navn || "Ingen").join(", "),
        Farge: getProjectColor(entry.ttx_project_cache?.tripletex_project_id ?? undefined),
      }));

      if (csvData.length === 0) {
        toast({
          title: "Ingen data",
          description: "Ingen timeoppføringer å eksportere",
        });
        return;
      }

      const csvContent = [
        Object.keys(csvData[0] ?? {}).join(";"),
        ...csvData.map((row) => Object.values(row).join(";")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `uke-${currentWeek}-${currentYear}.csv`;
      link.click();

      toast({
        title: "Eksport fullført",
        description: "CSV-fil er lastet ned",
      });
    } catch (error) {
      toast({
        title: "Eksport feilet",
        description: "Kunne ikke eksportere data",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">Laster ukedata...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Ukeplan</h1>
            <p className="mt-1 text-muted-foreground">
              {profile?.org?.name} - Uke {currentWeek}, {currentYear}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={exportWeekCSV} variant="outline" size="sm">
              <Download className="mr-1 h-4 w-4" />
              CSV
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Fyll uke
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Fyll uke med timer</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="include-holidays"
                      checked={fillWeekSettings.includeHolidays}
                      onCheckedChange={(checked) =>
                        setFillWeekSettings((prev) => ({ ...prev, includeHolidays: checked }))
                      }
                    />
                    <label htmlFor="include-holidays" className="text-sm">
                      Inkluder helligdager (default AV)
                    </label>
                  </div>
                  <Button className="w-full" disabled>
                    Fyll valgte dager (ikke implementert)
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
            Forrige uke
          </Button>
          <div className="text-lg font-medium">
            Uke {currentWeek}, {currentYear}
          </div>
          <Button variant="outline" onClick={() => navigateWeek(1)}>
            Neste uke
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b">
              {calendarDays.map((day) => {
                const date = new Date(day.dato);
                return (
                  <div key={day.dato} className={getDayHeaderClass(day)}>
                    <div className="text-sm">
                      {date.toLocaleDateString("no-NO", { weekday: "short" })}
                    </div>
                    <div className="text-lg font-semibold">{date.getDate()}</div>
                    {day.is_holiday && (
                      <Badge variant="destructive" className="mt-1 text-xs">
                        {day.holiday_name}
                      </Badge>
                    )}
                    {day.is_weekend && !day.is_holiday && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        Helg
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Timeoppføringer ({weekEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weekEntries.map((entry) => {
                const projectColor = getProjectColor(entry.ttx_project_cache?.tripletex_project_id ?? undefined);
                const textColor = getContrastColor(projectColor);
                const totalHours = entry.vakt_timer.reduce((sum, timer) => sum + timer.timer, 0);

                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border p-4"
                    style={{
                      backgroundColor: `${projectColor}20`,
                      borderColor: projectColor,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {entry.person
                            ? getPersonDisplayName(entry.person.fornavn, entry.person.etternavn)
                            : "Ukjent person"}
                        </div>
                        <div
                          className="mt-1 inline-block rounded px-2 py-1 text-sm"
                          style={{
                            backgroundColor: projectColor,
                            color: textColor,
                          }}
                        >
                          {entry.ttx_project_cache?.project_name || "Ikke tilordnet"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{totalHours.toFixed(2)} t</div>
                        <div className="text-sm text-muted-foreground">
                          {entry.vakt_timer.length} oppføringer
                        </div>
                      </div>
                    </div>

                    {entry.vakt_timer.length > 0 && (
                      <div className="mt-3 space-y-1 text-sm">
                        {entry.vakt_timer.map((timer, idx) => (
                          <div key={`${entry.id}-${idx}`} className="flex justify-between">
                            <span>{timer.ttx_activity_cache?.navn || "Ingen aktivitet"}</span>
                            <span>
                              {timer.timer.toFixed(2)} t ({timer.status})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {weekEntries.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  Ingen timeoppføringer funnet for denne uken
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {weekEntries
                      .reduce((sum, entry) => sum + entry.vakt_timer.reduce((inner, timer) => inner + timer.timer, 0), 0)
                      .toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total timer</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {new Set(
                      weekEntries
                        .filter((entry) => entry.person)
                        .map((entry) => `${entry.person?.fornavn ?? ""}${entry.person?.etternavn ?? ""}`),
                    ).size}
                  </div>
                  <div className="text-sm text-muted-foreground">Aktive ansatte</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {
                      weekEntries.filter((entry) => entry.vakt_timer.some((timer) => timer.status === "godkjent")).length
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">Godkjente</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UkePage;


