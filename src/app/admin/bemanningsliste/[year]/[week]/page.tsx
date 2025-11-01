"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import StaffingList from "@/components/StaffingList";
import { getWeekNumber } from "@/lib/displayNames";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useStaffingData";
import VehicleProductSettingsDialog from "@/components/VehicleProductSettingsDialog";

const getWeeksInYear = (targetYear: number) => {
  const dec28 = new Date(targetYear, 11, 28);
  return getWeekNumber(dec28);
};

const shiftWeek = (year: number, week: number, delta: number) => {
  let newYear = year;
  let newWeek = week + delta;
  let weeksInYear = getWeeksInYear(newYear);

  while (newWeek > weeksInYear) {
    newWeek -= weeksInYear;
    newYear += 1;
    weeksInYear = getWeeksInYear(newYear);
  }

  while (newWeek < 1) {
    newYear -= 1;
    weeksInYear = getWeeksInYear(newYear);
    newWeek += weeksInYear;
  }

  return { year: newYear, week: newWeek };
};

const WEEKS_WINDOW = 7;

export default function BemanningslisteWeekPage() {
  const params = useParams<{ year: string; week: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const orgId = profile?.org_id;
  const [settingsOpen, setSettingsOpen] = useState(false);

  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultWeek = getWeekNumber(now);

  const parsedYear = Number(params?.year ?? "");
  const parsedWeek = Number(params?.week ?? "");

  const currentYear = Number.isNaN(parsedYear) ? defaultYear : parsedYear;
  const weeksInCurrentYear = getWeeksInYear(currentYear);
  const currentWeek = Number.isNaN(parsedWeek)
    ? defaultWeek
    : Math.max(1, Math.min(weeksInCurrentYear, parsedWeek));

  // Range: current week first, then WEEKS_WINDOW-1 weeks forward
  const rangeStart = { year: currentYear, week: currentWeek };
  const rangeEnd = shiftWeek(currentYear, currentWeek, WEEKS_WINDOW - 1);

  useEffect(() => {
    const invalid = Number.isNaN(parsedYear) || Number.isNaN(parsedWeek);
    const noParams = !params?.year || !params?.week;

    // Always redirect to current week if no params or invalid params
    if (invalid || noParams) {
      router.replace(`/admin/bemanningsliste/${defaultYear}/${String(defaultWeek).padStart(2, "0")}`);
      return;
    }

    // If user has a specific week in URL, respect it (existing behavior)
    // The centering logic in StaffingList will handle displaying it correctly
  }, [parsedYear, parsedWeek, router, defaultYear, defaultWeek, params?.year, params?.week]);

  const navigateWeeks = (delta: number) => {
    const { year, week } = shiftWeek(currentYear, currentWeek, delta);
    router.push(`/admin/bemanningsliste/${year}/${week.toString().padStart(2, "0")}`);
  };

  return (
    <ProtectedRoute requiredRole="any-admin">
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card p-4">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <Button variant="outline" onClick={() => navigateWeeks(-3)}>
                <ChevronLeft className="h-4 w-4" />
                Forrige 3 uker
              </Button>
              <Button variant="outline" onClick={() => navigateWeeks(3)}>
                Neste 3 uker
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-center text-lg font-medium sm:flex-1 sm:text-right">
              Viser uker {String(rangeStart.week).padStart(2, "0")}/{rangeStart.year} – {String(rangeEnd.week).padStart(2, "0")}/{rangeEnd.year}
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setSettingsOpen(true)}
                disabled={!orgId}
              >
                <Settings className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Innstillinger</span>
              </Button>
            </div>
          </div>
        </div>

        <StaffingList startWeek={currentWeek} startYear={currentYear} weeksToShow={WEEKS_WINDOW} />
      </div>

      {orgId && (
        <VehicleProductSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          orgId={orgId}
        />
      )}
    </ProtectedRoute>
  );
}
