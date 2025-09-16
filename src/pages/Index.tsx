import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getWeekNumber } from '@/lib/displayNames';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Laster...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  const currentYear = new Date().getFullYear();
  const currentWeek = getWeekNumber(new Date());

  const goToCurrentWeek = () => {
    navigate(`/min/uke/${currentYear}/${currentWeek.toString().padStart(2, '0')}`);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold">Bemanningsliste & Timer</h1>
            <p className="text-xl text-muted-foreground mt-2">
              Logget inn som: {user.email}
            </p>
          </div>
          <Button onClick={signOut} variant="outline">
            Logg ut
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={goToCurrentWeek}>
            <CardHeader>
              <CardTitle>📅 Min uke</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Uke {currentWeek}, {currentYear}
              </p>
              <p className="text-sm">
                Timeføring og ukeoversikt for denne uken.
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => {
            const currentYear = new Date().getFullYear();
            const currentWeek = getWeekNumber(new Date());
            navigate(`/admin/bemanningsliste/${currentYear}/${currentWeek.toString().padStart(2, '0')}`);
          }}>
            <CardHeader>
              <CardTitle>📋 Bemanningsliste</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Admin-verktøy
              </p>
              <p className="text-sm">
                Planlegg prosjekter for alle ansatte i Excel-lignende visning.
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/admin/brukere')}>
            <CardHeader>
              <CardTitle>👥 Brukerhåndtering</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Admin-verktøy
              </p>
              <p className="text-sm">
                Se alle brukere i systemet og administrer tilganger.
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/admin/underleverandorer')}>
            <CardHeader>
              <CardTitle>🏢 Underleverandører</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Bemanningsressurser
              </p>
              <p className="text-sm">
                Administrer underleverandører for bemanningslisten.
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/admin/integrasjoner/tripletex')}>
            <CardHeader>
              <CardTitle>🔧 Tripletex-integrasjon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Integrasjonsoppsett
              </p>
              <p className="text-sm">
                Administrer API-tilkobling og synkronisering.
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <CardTitle>📊 Rapporter</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Kommer snart
              </p>
              <p className="text-sm">
                Oversikter og rapporter for timer og bemanning.
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <CardTitle>⚙️ Innstillinger</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Kommer snart
              </p>
              <p className="text-sm">
                Brukerinnstillinger og organisasjonsoppsett.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
