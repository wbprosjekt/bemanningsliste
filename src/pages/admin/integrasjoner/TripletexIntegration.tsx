import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, XCircle, Users, FolderOpen, Activity, Clock, Settings, Eye, EyeOff } from 'lucide-react';
import OnboardingDialog from '@/components/OnboardingDialog';

const TripletexIntegration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [integrationSettings, setIntegrationSettings] = useState<any>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [nightlySync, setNightlySync] = useState(false);
  const [tokenConfig, setTokenConfig] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [tokenForm, setTokenForm] = useState({
    consumerToken: '',
    employeeToken: '',
    apiBaseUrl: 'https://api-test.tripletex.tech/v2'
  });

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  // Load integration settings after profile is loaded
  useEffect(() => {
    if (profile?.org_id) {
      loadIntegrationSettings();
      checkTokenConfig();
    }
  }, [profile?.org_id]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, org:org_id (id, name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (!data) {
        setShowOnboarding(true);
        return;
      }
      
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Profil mangler",
        description: "Du må opprette en profil før du kan bruke integrasjoner.",
        variant: "destructive"
      });
      setShowOnboarding(true);
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
      
      // Load existing tokens if they exist
      if (data?.settings) {
        const settings = data.settings as any;
        
        // Decode base64 tokens for display
        let consumerToken = '';
        let employeeToken = '';
        
        try {
          if (settings.consumer_token) {
            consumerToken = atob(settings.consumer_token);
          }
        } catch (e) {
          // If decoding fails, use as-is (might already be decoded)
          consumerToken = settings.consumer_token || '';
        }
        
        try {
          if (settings.employee_token) {
            employeeToken = atob(settings.employee_token);
          }
        } catch (e) {
          // If decoding fails, use as-is (might already be decoded)
          employeeToken = settings.employee_token || '';
        }
        
        setTokenForm({
          consumerToken,
          employeeToken,
          apiBaseUrl: settings.api_base_url || 'https://api-test.tripletex.tech/v2'
        });
      }
      
      // Refresh token config when integration settings change
      checkTokenConfig();
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
        setSessionInfo({
          ...result.data,
          testedAt: new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
        });
        
        const expiresAt = result.data?.expirationDate ? 
          new Date(result.data.expirationDate).toLocaleDateString('no-NO') :
          'Ukjent';
        
        toast({
          title: "Sesjon opprettet",
          description: `API-tilkobling OK - gyldig til ${expiresAt}`
        });
      } else {
        // Handle specific error types
        const errorMsg = result?.error || "Ukjent feil";
        let title = "API-sesjon feilet";
        let description = errorMsg;
        
        if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('Unauthorized')) {
          title = "Ugyldige nøkler";
          description = "API-nøklene er ikke gyldige eller mangler tilgang";
        } else if (errorMsg.includes('429')) {
          title = "Rate-limit";
          description = "For mange forespørsler - prøv igjen om litt";
        } else if (errorMsg.includes('5')) {
          title = "Tripletex utilgjengelig"; 
          description = "Tripletex API er midlertidig utilgjengelig";
        } else if (errorMsg.includes('not configured')) {
          title = "Tokens mangler";
          description = "Tripletex consumer/employee tokens er ikke konfigurert";
        }
        
        toast({
          title,
          description,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Kunne ikke opprette sesjon",
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

  const checkTokenConfig = async () => {
    if (!profile?.org_id) return;

    try {
      const result = await callTripletexAPI('check-config');
      if (result?.success) {
        setTokenConfig(result.data);
      }
    } catch (error) {
      console.error('Error checking token config:', error);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    loadUserProfile(); // Reload profile after onboarding
  };

  const saveTokens = async () => {
    if (!profile?.org_id) return;

    if (!tokenForm.consumerToken.trim() || !tokenForm.employeeToken.trim()) {
      toast({
        title: "Manglende tokens",
        description: "Både Consumer Token og Employee Token må fylles inn.",
        variant: "destructive"
      });
      return;
    }

    setLoading({ ...loading, saveTokens: true });
    try {
      const settings = {
        ...(integrationSettings?.settings || {}),
        consumer_token: tokenForm.consumerToken.trim(),
        employee_token: tokenForm.employeeToken.trim(),
        api_base_url: tokenForm.apiBaseUrl.trim(),
        nightly_sync: nightlySync
      };

      const { error } = await supabase
        .from('integration_settings')
        .upsert({
          org_id: profile.org_id,
          integration_type: 'tripletex',
          settings,
          aktiv: true
        }, { 
          onConflict: 'org_id,integration_type' 
        });

      if (error) throw error;

      setIntegrationSettings({ ...integrationSettings, settings, aktiv: true });

      toast({
        title: "Tokens lagret",
        description: "Tripletex API-tokens er oppdatert og lagret sikkert."
      });

      // Refresh token config to reflect changes
      checkTokenConfig();
    } catch (error: any) {
      toast({
        title: "Feil ved lagring av tokens",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading({ ...loading, saveTokens: false });
    }
  };

  const toggleNightlySync = async (enabled: boolean) => {
    if (!profile?.org_id) return;

    try {
      const settings = {
        ...(integrationSettings?.settings || {}),
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

  if (showOnboarding) {
    return <OnboardingDialog onComplete={handleOnboardingComplete} />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Laster...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Profil mangler</h2>
          <p className="text-muted-foreground">
            Du må opprette en profil og være tilknyttet en organisasjon før du kan bruke integrasjoner.
          </p>
          <Button onClick={() => setShowOnboarding(true)}>
            Sett opp organisasjon
          </Button>
        </div>
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

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              API-konfigurasjon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiBaseUrl">API Base URL</Label>
              <Input
                id="apiBaseUrl"
                value={tokenForm.apiBaseUrl}
                onChange={(e) => setTokenForm({ ...tokenForm, apiBaseUrl: e.target.value })}
                placeholder="https://api-test.tripletex.tech/v2"
              />
              <p className="text-xs text-muted-foreground">
                Test: https://api-test.tripletex.tech/v2 | Prod: https://api.tripletex.tech/v2
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="consumerToken">Consumer Token</Label>
              <div className="relative">
                <Input
                  id="consumerToken"
                  type={showTokens ? "text" : "password"}
                  value={tokenForm.consumerToken}
                  onChange={(e) => setTokenForm({ ...tokenForm, consumerToken: e.target.value })}
                  placeholder="Din Consumer Token fra Tripletex"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowTokens(!showTokens)}
                >
                  {showTokens ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeeToken">Employee Token</Label>
              <div className="relative">
                <Input
                  id="employeeToken"
                  type={showTokens ? "text" : "password"}
                  value={tokenForm.employeeToken}
                  onChange={(e) => setTokenForm({ ...tokenForm, employeeToken: e.target.value })}
                  placeholder="Din Employee Token fra Tripletex"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowTokens(!showTokens)}
                >
                  {showTokens ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">📋 Slik får du API-tokens fra Tripletex:</p>
              <p className="text-muted-foreground">
                1. Logg inn på Tripletex → Innstillinger → Integrasjoner<br/>
                2. Opprett ny integrasjon → Velg "Egendefinert integrasjon"<br/>
                3. Kopier Consumer Token og Employee Token herfra
              </p>
            </div>

            <Button 
              onClick={saveTokens}
              disabled={loading.saveTokens}
              className="w-full"
            >
              {loading.saveTokens ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Lagre API-konfigurasjon
            </Button>
          </CardContent>
        </Card>

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
                disabled={loading.testSession || (!tokenForm.consumerToken || !tokenForm.employeeToken)}
                variant="outline"
                title={(!tokenForm.consumerToken || !tokenForm.employeeToken) ? "Fyll inn tokens først" : ""}
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
                  {sessionInfo.testedAt && (
                    <span className="text-sm text-muted-foreground">
                      Sist testet {sessionInfo.testedAt}
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
                {tokenForm.consumerToken ? '✓ Konfigurert' : '✗ Mangler'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Employee Token:</span>
              <Badge variant="outline">
                {tokenForm.employeeToken ? '✓ Konfigurert' : '✗ Mangler'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>API Base URL:</span>
              <span className="text-sm text-muted-foreground">
                {tokenForm.apiBaseUrl}
              </span>
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