import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, XCircle, Users, FolderOpen, Activity, Clock } from 'lucide-react';

const TripletexIntegration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [integrationSettings, setIntegrationSettings] = useState<any>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [nightlySync, setNightlySync] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadIntegrationSettings();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, org:org_id (id, name)')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadIntegrationSettings = async () => {
    if (!profile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('integration_type', 'tripletex')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      setIntegrationSettings(data);
      if (data?.settings && typeof data.settings === 'object' && 'nightly_sync' in data.settings) {
        setNightlySync(data.settings.nightly_sync as boolean);
      }
    } catch (error) {
      console.error('Error loading integration settings:', error);
    }
  };

  const callTripletexAPI = async (action: string, additionalParams?: any) => {
    if (!profile?.org_id) return null;

    const params = new URLSearchParams({
      action,
      orgId: profile.org_id,
      ...additionalParams
    });

    try {
      const { data, error } = await supabase.functions.invoke('tripletex-api', {
        body: { params: params.toString() }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error calling Tripletex API (${action}):`, error);
      throw error;
    }
  };

  const testAPISession = async () => {
    setLoading({ ...loading, testSession: true });
    try {
      const result = await callTripletexAPI('test-session');
      
      if (result?.success) {
        setSessionInfo(result.data);
        toast({
          title: "API-sesjon OK",
          description: "Tripletex API er tilgjengelig og tokens er gyldige."
        });
      } else {
        toast({
          title: "API-sesjon feilet",
          description: result?.error || "Ukjent feil",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "API-test feilet",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading({ ...loading, testSession: false });
    }
  };

  const syncData = async (type: 'employees' | 'projects' | 'activities') => {
    const actionMap = {
      employees: 'sync-employees',
      projects: 'sync-projects', 
      activities: 'sync-activities'
    };

    const titleMap = {
      employees: 'ansatte',
      projects: 'prosjekter',
      activities: 'aktiviteter'
    };

    setLoading({ ...loading, [type]: true });
    try {
      const result = await callTripletexAPI(actionMap[type]);
      
      if (result?.success) {
        toast({
          title: `Synkronisering fullført`,
          description: `${result.data?.count || 0} ${titleMap[type]} ble synkronisert.`
        });
      } else {
        toast({
          title: `Synkronisering av ${titleMap[type]} feilet`,
          description: result?.error || "Ukjent feil",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: `Synkronisering av ${titleMap[type]} feilet`,
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading({ ...loading, [type]: false });
    }
  };

  const toggleNightlySync = async (enabled: boolean) => {
    if (!profile?.org_id) return;

    try {
      const settings = {
        nightly_sync: enabled,
        sync_time: '02:00'
      };

      const { error } = await supabase
        .from('integration_settings')
        .upsert({
          org_id: profile.org_id,
          integration_type: 'tripletex',
          settings,
          aktiv: enabled
        }, { 
          onConflict: 'org_id,integration_type' 
        });

      if (error) throw error;

      setNightlySync(enabled);
      setIntegrationSettings({ ...integrationSettings, settings, aktiv: enabled });

      toast({
        title: enabled ? "Nattlig synkronisering aktivert" : "Nattlig synkronisering deaktivert",
        description: enabled ? "Data vil synkroniseres automatisk kl. 02:00 hver natt." : "Automatisk synkronisering er deaktivert."
      });
    } catch (error: any) {
      toast({
        title: "Feil ved endring av innstillinger",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Laster...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tripletex-integrasjon</h1>
            <p className="text-muted-foreground mt-1">
              {profile.org?.name} - Administrer Tripletex API-tilkobling
            </p>
          </div>
          <Badge variant={integrationSettings?.aktiv ? "default" : "secondary"}>
            {integrationSettings?.aktiv ? "Aktiv" : "Inaktiv"}
          </Badge>
        </div>

        {/* API Session Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              API-tilkobling
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button 
                onClick={testAPISession}
                disabled={loading.testSession}
                variant="outline"
              >
                {loading.testSession ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Test API-sesjon
              </Button>
              
              {sessionInfo && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600">
                    ✓ Tilkoblet
                  </Badge>
                  {sessionInfo.expirationDate && (
                    <span className="text-sm text-muted-foreground">
                      Utløper: {new Date(sessionInfo.expirationDate).toLocaleDateString('no-NO')}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground">
              Test om API-tokens er konfigurert riktig og kan nå Tripletex.
            </p>
          </CardContent>
        </Card>

        {/* Data Synchronization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Datasynkronisering
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Button 
                  onClick={() => syncData('employees')}
                  disabled={loading.employees}
                  className="w-full"
                  variant="outline"
                >
                  {loading.employees ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4 mr-2" />
                  )}
                  Synk ansatte
                </Button>
                <p className="text-xs text-muted-foreground">
                  Henter ansatte fra Tripletex og lagrer i lokal cache.
                </p>
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={() => syncData('projects')}
                  disabled={loading.projects}
                  className="w-full"
                  variant="outline"
                >
                  {loading.projects ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4 mr-2" />
                  )}
                  Synk prosjekter
                </Button>
                <p className="text-xs text-muted-foreground">
                  Henter prosjekter fra Tripletex og lagrer i lokal cache.
                </p>
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={() => syncData('activities')}
                  disabled={loading.activities}
                  className="w-full"
                  variant="outline"
                >
                  {loading.activities ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4 mr-2" />
                  )}
                  Synk aktiviteter
                </Button>
                <p className="text-xs text-muted-foreground">
                  Henter aktiviteter fra Tripletex og lagrer i lokal cache.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nightly Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Automatisk synkronisering
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="nightly-sync">Nattlig synkronisering kl. 02:00</Label>
                <p className="text-sm text-muted-foreground">
                  Synkroniser automatisk ansatte, prosjekter og aktiviteter hver natt.
                </p>
              </div>
              <Switch
                id="nightly-sync"
                checked={nightlySync}
                onCheckedChange={toggleNightlySync}
              />
            </div>
          </CardContent>
        </Card>

        {/* Status Information */}
        <Card>
          <CardHeader>
            <CardTitle>Integrasjonsstatus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Consumer Token:</span>
              <Badge variant="outline">
                {process.env.TRIPLETEX_CONSUMER_TOKEN ? '✓ Konfigurert' : '✗ Mangler'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Employee Token:</span>
              <Badge variant="outline">
                {process.env.TRIPLETEX_EMPLOYEE_TOKEN ? '✓ Konfigurert' : '✗ Mangler'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Sist synkronisert:</span>
              <span className="text-sm text-muted-foreground">
                {integrationSettings?.updated_at ? 
                  new Date(integrationSettings.updated_at).toLocaleString('no-NO') : 
                  'Aldri'
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TripletexIntegration;