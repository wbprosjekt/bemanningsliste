import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

        <Card>
          <CardHeader>
            <CardTitle>Velkommen til systemet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Her kommer administrasjonsgrensesnittet for bemanningsplanlegging og timeregistrering.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
