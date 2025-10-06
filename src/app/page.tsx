"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWeekNumber } from "@/lib/displayNames";
import { supabase } from "@/integrations/supabase/client";

export default function IndexPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<{ role: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    } else if (!loading && user) {
      loadProfile();
    }
  }, [user, loading, router]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      setProfileLoading(true);
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        setProfile(null);
      } else {
        const userRole = profileData?.role || 'user';
        setProfile({ role: userRole });

        // Auto-redirect based on role
        if (userRole === 'user') {
          // Regular users go straight to their week view
          const currentYear = new Date().getFullYear();
          const currentWeek = getWeekNumber(new Date());
          router.replace(`/min/uke/${currentYear}/${currentWeek.toString().padStart(2, "0")}`);
        }
        // Admin/leder stay on dashboard (this page)
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Laster...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  // If user role, they will be redirected - show nothing
  if (profile.role === 'user') {
    return null;
  }

  const currentYear = new Date().getFullYear();
  const currentWeek = getWeekNumber(new Date());

  const goToCurrentWeek = () => {
    router.push(`/min/uke/${currentYear}/${currentWeek.toString().padStart(2, "0")}`);
  };

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

          <Card className="opacity-60">
            <CardHeader>
              <CardTitle>⚙️ Innstillinger</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">Kommer snart</p>
              <p className="text-sm">Brukerinnstillinger og organisasjonsoppsett.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
