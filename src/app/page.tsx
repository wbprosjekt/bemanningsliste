"use client";

export const dynamic = 'force-dynamic';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWeekNumber } from "@/lib/displayNames";
import ProtectedRoute from "@/components/ProtectedRoute";

function DashboardContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const currentWeek = getWeekNumber(new Date());

  const goToCurrentWeek = () => {
    router.push(`/min/uke/${currentYear}/${currentWeek.toString().padStart(2, "0")}`);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Bemanningsliste & Timer</h1>
            <p className="mt-2 text-xl text-muted-foreground">Logget inn som: {user.email}</p>
          </div>
          <Button onClick={signOut} variant="outline">
            Logg ut
          </Button>
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
