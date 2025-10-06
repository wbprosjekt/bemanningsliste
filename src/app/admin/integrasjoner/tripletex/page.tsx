"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  RefreshCw,
  CheckCircle,
  Users,
  FolderOpen,
  Activity,
  Clock,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";
import OnboardingDialog from "@/components/OnboardingDialog";
import ProtectedRoute from "@/components/ProtectedRoute";

interface Profile {
  id: string;
  org_id: string;
  user_id: string;
  created_at: string;
  org?: {
    id: string;
    name: string;
  } | null;
}

interface IntegrationSettings {
  id: string;
  org_id: string;
  integration_type: string;
  aktiv: boolean;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface SessionInfo {
  expirationDate?: string;
  testedAt?: string;
}

interface TokenConfig {
  consumerToken: string;
  employeeToken: string;
  apiBaseUrl: string;
}

type LoadingKey =
  | "testSession"
  | "employees"
  | "projects"
  | "activities"
  | "saveTokens"
  | "nightly";

type LoadingState = Partial<Record<LoadingKey, boolean>>;

const TripletexIntegrationPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [integrationSettings, setIntegrationSettings] = useState<IntegrationSettings | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState<LoadingState>({});
  const [nightlySync, setNightlySync] = useState(false);
  const [tokenForm, setTokenForm] = useState({
    consumerToken: "",
    employeeToken: "",
    apiBaseUrl: "https://api-test.tripletex.tech/v2",
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTokens, setShowTokens] = useState(false);

  const setLoadingState = useCallback((key: LoadingKey, value: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  }, []);

  const loadUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, org:org_id (id, name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (!data) {
        setShowOnboarding(true);
        return;
      }

      setProfile(data as Profile);
    } catch (err) {
      console.error("Error loading profile:", err);
      toast({
        title: "Profil mangler",
        description: "Du må opprette en profil før du kan bruke integrasjoner.",
        variant: "destructive",
      });
      setShowOnboarding(true);
    }
  }, [user, toast]);

  const callTripletexAPI = useCallback(
    async (action: string, additionalParams?: Record<string, string | number | boolean | undefined>) => {
      if (!profile?.org_id) return null;

      const params = new URLSearchParams({
        action,
        orgId: profile.org_id,
        ...(additionalParams || {}),
      });

      const { data, error } = await supabase.functions.invoke("tripletex-api", {
        body: { params: params.toString() },
      });

      if (error) throw error;
      return data;
    },
    [profile?.org_id],
  );

  const testAPISession = async () => {
    setLoadingState("testSession", true);
    try {
      const result = await callTripletexAPI("test-session");

      if (result?.success) {
        setSessionInfo({
          expirationDate: result.data?.expirationDate,
          testedAt: new Date().toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" }),
        });

        const expiresAt = result.data?.expirationDate
          ? new Date(result.data.expirationDate).toLocaleDateString("no-NO")
          : "Ukjent";

        toast({
          title: "Sesjon opprettet",
          description: `API-tilkobling OK - gyldig til ${expiresAt}`,
        });
      } else {
        const errorMsg = result?.error || "Ukjent feil";
        let title = "API-sesjon feilet";
        let description = errorMsg;

        if (/(401|403|Unauthorized)/.test(errorMsg)) {
          title = "Ugyldige nøkler";
          description = "API-nøklene er ikke gyldige eller mangler tilgang";
        } else if (errorMsg.includes("429")) {
          title = "Rate-limit";
          description = "For mange forespørsler - prøv igjen om litt";
        } else if (/5\d{2}/.test(errorMsg)) {
          title = "Tripletex utilgjengelig";
          description = "Tripletex API er midlertidig utilgjengelig";
        } else if (errorMsg.includes("not configured")) {
          title = "Tokens mangler";
          description = "Tripletex consumer/employee tokens er ikke konfigurert";
        }

        toast({
          title,
          description,
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Kunne ikke opprette sesjon",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    } finally {
      setLoadingState("testSession", false);
    }
  };

  const syncData = async (type: "employees" | "projects" | "activities") => {
    const actionMap = {
      employees: "sync-employees",
      projects: "sync-projects",
      activities: "sync-activities",
    } as const;

    const titleMap = {
      employees: "ansatte",
      projects: "prosjekter",
      activities: "aktiviteter",
    } as const;

    setLoadingState(type, true);
    try {
      const result = await callTripletexAPI(actionMap[type]);

      if (result?.success) {
        toast({
          title: "Synkronisering fullført",
          description: `${result.data?.count || 0} ${titleMap[type]} ble synkronisert.`,
        });
      } else {
        toast({
          title: `Synkronisering av ${titleMap[type]} feilet`,
          description: result?.error || "Ukjent feil",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      toast({
        title: `Synkronisering av ${titleMap[type]} feilet`,
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    } finally {
      setLoadingState(type, false);
    }
  };

  const checkTokenConfig = useCallback(async () => {
    if (!profile?.org_id) return;

    try {
      const result = await callTripletexAPI("check-config");
      if (result?.success) {
        const config = result.data as TokenConfig;
        setTokenForm({
          consumerToken: config.consumerToken ?? "",
          employeeToken: config.employeeToken ?? "",
          apiBaseUrl: config.apiBaseUrl ?? "https://api-test.tripletex.tech/v2",
        });
      }
    } catch (error) {
      console.error("Error checking token config:", error);
    }
  }, [profile?.org_id, callTripletexAPI]);

  const loadIntegrationSettings = useCallback(async () => {
    if (!profile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("org_id", profile.org_id)
        .eq("integration_type", "tripletex")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setIntegrationSettings(data as IntegrationSettings);
        if (data.settings && typeof data.settings === "object" && "nightly_sync" in data.settings) {
          setNightlySync(Boolean((data.settings as { nightly_sync?: boolean }).nightly_sync));
        }
      }

      checkTokenConfig();
    } catch (error) {
      console.error("Error loading integration settings:", error);
    }
  }, [profile?.org_id, checkTokenConfig]);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user, loadUserProfile]);

  useEffect(() => {
    if (profile?.org_id) {
      loadIntegrationSettings();
    }
  }, [profile?.org_id, loadIntegrationSettings]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    loadUserProfile();
  };

  const saveTokens = async () => {
    if (!profile?.org_id) return;

    if (!tokenForm.consumerToken.trim() || !tokenForm.employeeToken.trim()) {
      toast({
        title: "Manglende tokens",
        description: "Både Consumer Token og Employee Token må fylles inn.",
        variant: "destructive",
      });
      return;
    }

    setLoadingState("saveTokens", true);
    try {
      const settings = {
        ...(integrationSettings?.settings || {}),
        consumer_token: tokenForm.consumerToken.trim(),
        employee_token: tokenForm.employeeToken.trim(),
        api_base_url: tokenForm.apiBaseUrl.trim(),
        nightly_sync: nightlySync,
      };

      const { error } = await supabase
        .from("integration_settings")
        .upsert(
          {
            org_id: profile.org_id,
            integration_type: "tripletex",
            settings,
            aktiv: true,
          },
          { onConflict: "org_id,integration_type" },
        );

      if (error) throw error;

      setIntegrationSettings((prev) => (prev ? { ...prev, settings, aktiv: true } : prev));

      toast({
        title: "Tokens lagret",
        description: "Tripletex API-tokens er oppdatert og lagret sikkert.",
      });

      checkTokenConfig();
    } catch (error: unknown) {
      toast({
        title: "Feil ved lagring av tokens",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    } finally {
      setLoadingState("saveTokens", false);
    }
  };

  const toggleNightlySync = async (enabled: boolean) => {
    if (!profile?.org_id) return;

    setLoadingState("nightly", true);
    try {
      const settings = {
        ...(integrationSettings?.settings || {}),
        nightly_sync: enabled,
        sync_time: "02:00",
      };

      const { error } = await supabase
        .from("integration_settings")
        .upsert(
          {
            org_id: profile.org_id,
            integration_type: "tripletex",
            settings,
            aktiv: enabled,
          },
          { onConflict: "org_id,integration_type" },
        );

      if (error) throw error;

      setNightlySync(enabled);
      setIntegrationSettings((prev) => (prev ? { ...prev, settings, aktiv: enabled } : prev));

      toast({
        title: enabled ? "Nattlig synkronisering aktivert" : "Nattlig synkronisering deaktivert",
        description: enabled
          ? "Data vil synkroniseres automatisk kl. 02:00 hver natt."
          : "Automatisk synkronisering er deaktivert.",
      });
    } catch (error: unknown) {
      toast({
        title: "Feil ved endring av innstillinger",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    } finally {
      setLoadingState("nightly", false);
    }
  };

  if (showOnboarding) {
    return <OnboardingDialog onComplete={handleOnboardingComplete} />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">Laster...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <h2 className="text-xl font-semibold">Profil mangler</h2>
          <p className="text-muted-foreground">
            Du må opprette en profil og være tilknyttet en organisasjon før du kan bruke integrasjoner.
          </p>
          <Button onClick={() => setShowOnboarding(true)}>Sett opp organisasjon</Button>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tripletex-integrasjon</h1>
            <p className="mt-1 text-muted-foreground">
              {profile.org?.name} - Administrer Tripletex API-tilkobling
            </p>
          </div>
          <Badge variant={integrationSettings?.aktiv ? "default" : "secondary"}>
            {integrationSettings?.aktiv ? "Aktiv" : "Inaktiv"}
          </Badge>
        </div>

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
                onChange={(event) => setTokenForm({ ...tokenForm, apiBaseUrl: event.target.value })}
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
                  onChange={(event) => setTokenForm({ ...tokenForm, consumerToken: event.target.value })}
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
                  onChange={(event) => setTokenForm({ ...tokenForm, employeeToken: event.target.value })}
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

            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="mb-1 font-medium">📋 Slik får du API-tokens fra Tripletex:</p>
              <p className="text-muted-foreground">
                1. Logg inn på Tripletex → Innstillinger → Integrasjoner
                <br />2. Opprett ny integrasjon → Velg &quot;Egendefinert integrasjon&quot;
                <br />3. Kopier Consumer Token og Employee Token herfra
              </p>
            </div>

            <Button onClick={saveTokens} disabled={loading.saveTokens} className="w-full">
              {loading.saveTokens ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Lagre API-konfigurasjon
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex itemsողների gap-2">
              <CheckCircle className="h-5 w-5" />
              API-tilkobling
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={testAPISession}
                disabled={loading.testSession || !tokenForm.consumerToken || !tokenForm.employeeToken}
                variant="outline"
                title={!tokenForm.consumerToken || !tokenForm.employeeToken ? "Fyll inn tokens først" : ""}
              >
                {loading.testSession ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
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
                      Utløper: {new Date(sessionInfo.expirationDate).toLocaleDateString("no-NO")}
                    </span>
                  )}
                  {sessionInfo.testedAt && (
                    <span className="text-sm text-muted-foreground">Sist testet {sessionInfo.testedAt}</span>
                  )}
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              Test om API-tokens er konfigurert riktig og kan nå Tripletex.
            </p>
          </CardContent>
        </Card>

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
                <Button onClick={() => syncData("employees")} disabled={loading.employees} className="w-full" variant="outline">
                  {loading.employees ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                  Synk ansatte
                </Button>
                <p className="text-xs text-muted-foreground">Henter ansatte fra Tripletex og lagrer i lokal cache.</p>
              </div>

              <div className="space-y-2">
                <Button onClick={() => syncData("projects")} disabled={loading.projects} className="w-full" variant="outline">
                  {loading.projects ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="mr-2 h-4 w-4" />
                  )}
                  Synk prosjekter
                </Button>
                <p className="text-xs text-muted-foreground">Henter prosjekter fra Tripletex og lagrer i lokal cache.</p>
              </div>

              <div className="space-y-2">
                <Button onClick={() => syncData("activities")} disabled={loading.activities} className="w-full" variant="outline">
                  {loading.activities ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="mr-2 h-4 w-4" />
                  )}
                  Synk aktiviteter
                </Button>
                <p className="text-xs text-muted-foreground">Henter aktiviteter fra Tripletex og lagrer i lokal cache.</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <Switch id="nightly-sync" checked={nightlySync} onCheckedChange={toggleNightlySync} disabled={loading.nightly} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrasjonsstatus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Consumer Token:</span>
              <Badge variant="outline">{tokenForm.consumerToken ? "✓ Konfigurert" : "✗ Mangler"}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Employee Token:</span>
              <Badge variant="outline">{tokenForm.employeeToken ? "✓ Konfigurert" : "✗ Mangler"}</Badge>
            </div>
            <div className="flex justify-between">
              <span>API Base URL:</span>
              <span className="text-sm text-muted-foreground">{tokenForm.apiBaseUrl}</span>
            </div>
            <div className="flex justify-between">
              <span>Sist synkronisert:</span>
              <span className="text-sm text-muted-foreground">
                {integrationSettings?.updated_at
                  ? new Date(integrationSettings.updated_at).toLocaleString("no-NO")
                  : "Aldri"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </ProtectedRoute>
  );
};

export default TripletexIntegrationPage;


