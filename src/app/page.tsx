"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWeekNumber } from "@/lib/displayNames";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProjectDashboard from "@/components/ProjectDashboard";
import { supabase } from "@/integrations/supabase/client";

function DashboardContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  const currentYear = new Date().getFullYear();
  const currentWeek = getWeekNumber(new Date());

  const goToCurrentWeek = () => {
    router.push(`/min/uke/${currentYear}/${currentWeek.toString().padStart(2, "0")}`);
  };

  // Check user role and redirect if needed
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        setIsCheckingRole(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error loading user role:', error);
          setIsCheckingRole(false);
          return;
        }

        const role = profile?.role || 'user';
        setUserRole(role);

        // If user has role 'user', redirect to their week page
        if (role === 'user') {
          console.log('🔄 User with role "user" detected, redirecting to /min/uke');
          router.replace(`/min/uke/${currentYear}/${currentWeek.toString().padStart(2, "0")}`);
          return;
        }

        // Admin/manager/leder can see the project dashboard
        console.log(`✅ User with role "${role}" can access project dashboard`);
      } catch (error) {
        console.error('Error in checkUserRole:', error);
      } finally {
        setIsCheckingRole(false);
      }
    };

    checkUserRole();
  }, [user, router, currentYear, currentWeek]);

  // Show loading while checking role
  if (isCheckingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Sjekker tilgang...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show ProjectDashboard for admins/managers/leders
  return <ProjectDashboard />;
}

export default function IndexPage() {
  return (
    <ProtectedRoute requireProfile={true}>
      <DashboardContent />
    </ProtectedRoute>
  );
}
