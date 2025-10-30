"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
// import { Button } from "@/components/ui/button"; // fjernet – håndteres i topbar
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

        // Admin/manager/leder can see the full dashboard
        console.log(`✅ User with role "${role}" can access dashboard`);
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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">FieldNote Dashboard</h1>
            <p className="mt-2 text-xl text-muted-foreground">
              Logget inn som: {user.email}
              {userRole && (
                <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Rolle: {userRole}
                </span>
              )}
            </p>
          </div>
          {/* Logg ut flyttet til topbar dropdown */}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer transition-shadow hover:shadow-lg" onClick={goToCurrentWeek}>
            <CardHeader>
              <CardTitle>📅 Min uke</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">
                Uke {currentWeek}, {currentYear}
              </p>
              <p className="text-sm">Timeføring og ukeoversikt for denne uken.</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => router.push("/dashboard")}
          >
            <CardHeader>
              <CardTitle>🏗️ Prosjekt Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">Ny funksjonalitet</p>
              <p className="text-sm">Oversikt over alle prosjekter og oppgaver.</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => {
              const year = new Date().getFullYear();
              const week = getWeekNumber(new Date());
              router.push(`/admin/bemanningsliste/${year}/${week.toString().padStart(2, "0")}`);
            }}
          >
            <CardHeader>
              <CardTitle>📋 Bemanningsliste</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">Admin-verktøy</p>
              <p className="text-sm">Planlegg prosjekter for alle ansatte i Excel-lignende visning.</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => router.push("/befaring")}
          >
            <CardHeader>
              <CardTitle>🔍 Befaring</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">Befaring-modul</p>
              <p className="text-sm">Opprett og administrer befaringer med oppgaver og bilder.</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => router.push("/admin/brukere")}
          >
            <CardHeader>
              <CardTitle>👥 Brukerhåndtering</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">Admin-verktøy</p>
              <p className="text-sm">Administrer brukere og synkroniser ansatte fra Tripletex.</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => router.push("/admin/integrasjoner/tripletex")}
          >
            <CardHeader>
              <CardTitle>🔧 Tripletex-integrasjon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">Integrasjonsoppsett</p>
              <p className="text-sm">Administrer API-tilkobling og synkronisering.</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => router.push("/admin/rapporter/maanedlig")}
          >
            <CardHeader>
              <CardTitle>📊 Rapporter</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">Admin-verktøy</p>
              <p className="text-sm">Månedlige rapporter for lønnsgrunnlag og timeføring.</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => router.push("/admin/settings")}
          >
            <CardHeader>
              <CardTitle>⚙️ Innstillinger</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">Admin-verktøy</p>
              <p className="text-sm">Konfigurer påminnelser og systeminnstillinger.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function IndexPage() {
  return (
    <ProtectedRoute requireProfile={true}>
      <DashboardContent />
    </ProtectedRoute>
  );
}
