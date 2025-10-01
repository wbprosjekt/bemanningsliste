"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Function to get current week number using ISO week calculation
function getCurrentWeek(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return weekNumber;
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

export default function MinUkeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const currentYear = getCurrentYear();
    const currentWeek = getCurrentWeek();
    
    // Redirect to current week
    router.replace(`/min/uke/${currentYear}/${currentWeek}`);
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Laster dagens uke...</p>
      </div>
    </div>
  );
}
