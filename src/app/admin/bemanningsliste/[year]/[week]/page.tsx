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

  useEffect(() => {
    const invalid = Number.isNaN(parsedYear) || Number.isNaN(parsedWeek);
    const noParams = !params?.year || !params?.week;

    if (invalid || noParams) {
      router.replace(`/admin/bemanningsliste/${currentYear}/${String(currentWeek).padStart(2, "0")}`);
    }
  }, [parsedYear, parsedWeek, router, currentYear, currentWeek, params?.year, params?.week]);

  const navigateWeeks = (delta: number) => {
    let newYear = currentYear;
    let newWeek = currentWeek + delta;
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

    router.push(`/admin/bemanningsliste/${newYear}/${newWeek.toString().padStart(2, "0")}`);
  };

  return (
    <ProtectedRoute requiredRole="any-admin">
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card p-4">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <Button variant="outline" onClick={() => navigateWeeks(-6)}>
                <ChevronLeft className="h-4 w-4" />
                Forrige 6 uker
              </Button>
              <Button variant="outline" onClick={() => navigateWeeks(6)}>
                Neste 6 uker
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-center text-lg font-medium sm:flex-1 sm:text-right">
              Fra uke {currentWeek}, {currentYear}
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

        <StaffingList startWeek={currentWeek} startYear={currentYear} weeksToShow={6} />
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
