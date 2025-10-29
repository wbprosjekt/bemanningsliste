/**
 * Admin Page: Refusjon modul-tilgang
 * Enable/disable refusjon access per employee
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from 'lucide-react';

type PricingPolicy = 'norgespris' | 'spot_med_stromstotte';

interface PolicySettingSnapshot {
  id: string;
  policy: PricingPolicy;
  effective_from: string | null;
  effective_to: string | null;
  default_area: string | null;
  terskel_nok_per_kwh: number | null;
  stotte_andel: number | null;
  net_profile_id?: string | null;
}

interface PendingPolicyChange {
  profileId: string;
  employeeName: string;
  newPolicy: PricingPolicy;
  previousPolicy: PricingPolicy;
  currentSetting?: PolicySettingSnapshot | null;
}

type PolicyStrategy = 'now' | 'schedule_tomorrow' | 'replace_today';

interface PolicyChangeContext {
  employeeName: string;
  previousPolicy: PricingPolicy;
  currentSetting?: PolicySettingSnapshot;
}

interface Employee {
  id: string;
  fornavn: string;
  etternavn: string;
  epost?: string;
  role?: string;
  isAdmin?: boolean;
  moduleAccess?: boolean;
  profileId?: string | null;
  pricingPolicy?: PricingPolicy;
  netProfileId?: string | null;
}

export default function RefusjonTilgangPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [pendingPolicyChange, setPendingPolicyChange] = useState<PendingPolicyChange | null>(null);
  const [policyActionLoading, setPolicyActionLoading] = useState(false);
  const [policyLoadingProfileId, setPolicyLoadingProfileId] = useState<string | null>(null);
  const [netProfiles, setNetProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [netProfileLoadingId, setNetProfileLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (profile?.org_id) {
        setOrgId(profile.org_id);
        
        // Load ALL profiles in the org (only those with user_id set)
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, display_name, user_id, role')
          .eq('org_id', profile.org_id)
          .not('user_id', 'is', null); // Only profiles with auth.users link
        
        // Load module access status for each profile
        const { data: moduleData } = await supabase
          .from('profile_modules')
          .select('profile_id, enabled')
          .eq('module_name', 'refusjon_hjemmelading');
        
        const accessMap = new Map(
          (moduleData || []).map(m => [m.profile_id, m.enabled])
        );

        // Load pricing policy and net profile for each profile from ref_employee_settings
        const [{ data: policyData }, { data: nettProfileData }] = await Promise.all([
          supabase
            .from('ref_employee_settings')
            .select('profile_id, policy, net_profile_id')
            .eq('org_id', profile.org_id)
            .is('effective_to', null), // Only current active settings
          supabase
            .from('ref_nett_profiles')
            .select('id, name')
            .eq('org_id', profile.org_id)
            .order('name', { ascending: true }),
        ]);
        
        setNetProfiles(
          ((nettProfileData || []) as unknown as Array<{ id: string; name: string }>).map(np => ({ id: np.id, name: np.name }))
        );
        
        const policyMap = new Map(
          ((policyData || []) as unknown as Array<{ profile_id: string; policy: string; net_profile_id: string | null }>).map(p => [p.profile_id, { policy: p.policy, netProfileId: p.net_profile_id }])
        );

        // Map profiles to employees (only show those with login)
        const empWithAccess = allProfiles
          ?.filter(prof => prof.user_id) // Only profiles with user_id
          ?.map(prof => {
            const moduleAccess = accessMap.get(prof.id) || false;
            
            // Split display_name more safely
            const nameParts = prof.display_name?.split(' ') || [];
            const fornavn = nameParts[0] || '';
            const etternavn = nameParts.slice(1).join(' ') || '';
            
            // Check if user is admin/økonomi (they always have access)
            const isAdmin = prof.role === 'admin' || prof.role === 'økonomi';
            const setting = policyMap.get(prof.id);
            const policy = setting?.policy || 'spot_med_stromstotte';
            
            return {
              id: prof.id, // This is profile.id
              fornavn,
              etternavn,
              role: prof.role || undefined,
              isAdmin,
              moduleAccess: isAdmin ? true : moduleAccess, // Admin always has access
              profileId: prof.id, // Store profile.id for toggle
              pricingPolicy: policy as 'norgespris' | 'spot_med_stromstotte',
              netProfileId: setting?.netProfileId ?? null,
            };
          }) || [];
        
        console.log('Loaded profiles:', allProfiles);
        console.log('Employees with access:', empWithAccess);

        setEmployees(empWithAccess);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste ansatte',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePolicySelection(employee: Employee, policy: PricingPolicy) {
    if (policy === employee.pricingPolicy) {
      return;
    }

    if (!orgId) {
      toast({
        title: 'Feil',
        description: 'Organisasjon-ID mangler',
        variant: 'destructive',
      });
      return;
    }

    const employeeName = [employee.fornavn, employee.etternavn].filter(Boolean).join(' ') || 'Ukjent';

    setPolicyLoadingProfileId(employee.id);

    try {
      const { data: settingData, error } = await supabase
        .from('ref_employee_settings')
        .select('id, policy, effective_from, effective_to, default_area, terskel_nok_per_kwh, stotte_andel, net_profile_id')
        .eq('profile_id', employee.id)
        .is('effective_to', null)
        .maybeSingle();

      if (error) throw error;

      const currentSetting = settingData as PolicySettingSnapshot | null;

      if (currentSetting && isSameDayIso(currentSetting.effective_from, new Date())) {
        setPendingPolicyChange({
          profileId: employee.id,
          employeeName,
          newPolicy: policy,
          previousPolicy: employee.pricingPolicy || 'spot_med_stromstotte',
          currentSetting,
        });
        setPolicyLoadingProfileId(null);
        return;
      }

      const success = await processPolicyChange(employee.id, policy, 'now', {
        employeeName,
        previousPolicy: employee.pricingPolicy || 'spot_med_stromstotte',
        currentSetting: currentSetting ?? undefined,
      });

      if (success) {
        setPendingPolicyChange(null);
      }
    } catch (error) {
      console.error('Error preparing policy change:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke forberede prisendringen',
        variant: 'destructive',
      });
      setPolicyLoadingProfileId(null);
    }
  }

  async function processPolicyChange(
    profileId: string,
    policy: PricingPolicy,
    strategy: PolicyStrategy,
    context: PolicyChangeContext,
  ): Promise<boolean> {
    const resolvedStrategy: PolicyStrategy =
      (strategy === 'replace_today' || strategy === 'schedule_tomorrow') && !context.currentSetting
        ? 'now'
        : strategy;

    setPolicyActionLoading(true);
    setPolicyLoadingProfileId(profileId);

    try {
      if (!orgId) {
        toast({
          title: 'Feil',
          description: 'Organisasjon-ID mangler',
          variant: 'destructive',
        });
        return false;
      }

      const nowIso = new Date().toISOString();
      const tomorrowIso = getStartOfTomorrowIso();
      const baseArea = context.currentSetting?.default_area || 'NO1';
      const baseThreshold = context.currentSetting?.terskel_nok_per_kwh ?? 0.75;
      const baseSupport = context.currentSetting?.stotte_andel ?? 0.9;
      const fastpris = policy === 'norgespris' ? 0.5 : null;

      if (resolvedStrategy === 'replace_today' && context.currentSetting?.id) {
        const { error } = await supabase
          .from('ref_employee_settings')
          .update({
            policy,
            fastpris_nok_per_kwh: fastpris,
            default_area: baseArea,
            terskel_nok_per_kwh: baseThreshold,
            stotte_andel: baseSupport,
          })
          .eq('id', context.currentSetting.id);

        if (error) throw error;

        setEmployees(prev =>
          prev.map(emp =>
            emp.id === profileId
              ? { ...emp, pricingPolicy: policy }
              : emp,
          ),
        );

        toast({
          title: 'Prisordning oppdatert',
          description: `${formatPolicyLabel(policy)} erstattet byttet som ble gjort tidligere i dag`,
        });
        return true;
      }

      if (context.currentSetting?.id) {
        const targetEffectiveTo = resolvedStrategy === 'schedule_tomorrow' ? tomorrowIso : nowIso;
        const { error: closeError } = await supabase
          .from('ref_employee_settings')
          .update({ effective_to: targetEffectiveTo })
          .eq('id', context.currentSetting.id);

        if (closeError) throw closeError;
      }

      const effectiveFromValue = resolvedStrategy === 'schedule_tomorrow' ? tomorrowIso : nowIso;

      const { error: insertError } = await supabase
        .from('ref_employee_settings')
        .insert({
          profile_id: profileId,
          org_id: orgId,
          policy,
          default_area: baseArea,
          fastpris_nok_per_kwh: fastpris,
          terskel_nok_per_kwh: baseThreshold,
          stotte_andel: baseSupport,
          net_profile_id: context.currentSetting?.net_profile_id ?? null,
          effective_from: effectiveFromValue,
          effective_to: null,
        });

      if (insertError) throw insertError;

      setEmployees(prev =>
        prev.map(emp => {
          if (emp.id !== profileId) return emp;

          if (resolvedStrategy === 'schedule_tomorrow') {
            return { ...emp, pricingPolicy: context.previousPolicy };
          }

          return { ...emp, pricingPolicy: policy };
        }),
      );

      if (resolvedStrategy === 'schedule_tomorrow') {
        toast({
          title: 'Bytte planlagt',
          description: `Ny pris "${formatPolicyLabel(policy)}" aktiveres ${formatDateTime(effectiveFromValue)}`,
        });
      } else {
        toast({
          title: 'Prisordning oppdatert',
          description: `${formatPolicyLabel(policy)} aktivert fra nå`,
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating policy:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke oppdatere prisordning',
        variant: 'destructive',
      });
      return false;
    } finally {
      setPolicyActionLoading(false);
      setPolicyLoadingProfileId(null);
    }
  }

  async function confirmPolicyChange(strategy: PolicyStrategy) {
    if (!pendingPolicyChange) return;

    const success = await processPolicyChange(
      pendingPolicyChange.profileId,
      pendingPolicyChange.newPolicy,
      strategy,
      {
        employeeName: pendingPolicyChange.employeeName,
        previousPolicy: pendingPolicyChange.previousPolicy,
        currentSetting: pendingPolicyChange.currentSetting || undefined,
      },
    );

    if (success) {
      setPendingPolicyChange(null);
    }
  }

  async function handleNetProfileChange(profileId: string, netProfileId: string | null) {
    setNetProfileLoadingId(profileId);
    try {
      if (!orgId) {
        toast({
          title: 'Feil',
          description: 'Organisasjon-ID mangler',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('ref_employee_settings')
        .update({ nett_profile_id: netProfileId } as any)
        .eq('profile_id', profileId)
        .is('effective_to', null);

      if (error) {
        throw error;
      }

      setEmployees(prev =>
        prev.map(emp =>
          emp.id === profileId ? { ...emp, netProfileId } : emp,
        ),
      );

      toast({
        title: 'Nettprofil oppdatert',
        description: netProfileId
          ? 'Nettprofil ble oppdatert for brukeren'
          : 'Nettprofil ble fjernet',
      });
    } catch (error) {
      console.error('Error updating net profile:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke oppdatere nettprofil',
        variant: 'destructive',
      });
    } finally {
      setNetProfileLoadingId(null);
    }
  }

  async function toggleAccess(profileId: string, enabled: boolean) {
    try {
      console.log('Toggling access for profile:', profileId, 'enabled:', enabled);
      
      // First verify that this profile exists and has user_id
      const { data: profileCheck, error: checkError } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, role')
        .eq('id', profileId)
        .not('user_id', 'is', null)
        .single();
      
      console.log('Profile check result:', profileCheck, checkError);
      
      if (checkError || !profileCheck) {
        console.error('Profile check failed:', checkError);
        const profileName = (profileCheck as any)?.display_name || profileId;
        toast({
          title: 'Feil',
          description: `Kunne ikke finne gyldig profil for ${profileName}`,
          variant: 'destructive',
        });
        return;
      }

      // Don't allow toggling access for admin/økonomi users
      if (profileCheck.role === 'admin' || profileCheck.role === 'økonomi') {
        toast({
          title: 'Ikke mulig',
          description: 'Admin og økonomi-brukere har alltid tilgang til refusjon-modulen',
          variant: 'default',
        });
        return;
      }

      // Upsert module access using profile_id directly
      const { error } = await supabase
        .from('profile_modules')
        .upsert({
          profile_id: profileId,
          module_name: 'refusjon_hjemmelading',
          enabled,
        }, {
          onConflict: 'profile_id,module_name',
        });

      if (error) {
        console.error('Failed to upsert module access:', error);
        throw error;
      }
      
      console.log('Successfully updated module access for profile:', profileId);

      // Update local state
      setEmployees(employees.map(emp => 
        emp.id === profileId ? { ...emp, moduleAccess: enabled } : emp
      ));

      toast({
        title: 'Tilgang oppdatert',
        description: enabled ? 'Refusjon tilgang aktivert' : 'Refusjon tilgang deaktivert',
      });
    } catch (error) {
      console.error('Error toggling access:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke oppdatere tilgang',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Modul-tilgang</h1>
        <p className="text-muted-foreground">
          Bestem hvilke ansatte som skal ha tilgang til refusjon-modulen
        </p>
      </div>

      <Dialog
        open={!!pendingPolicyChange}
        onOpenChange={(open) => {
          if (!open && !policyActionLoading) {
            setPendingPolicyChange(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flere prisbytter samme dag</DialogTitle>
            {pendingPolicyChange && (
              <DialogDescription>
                Det finnes allerede et bytte for {pendingPolicyChange.employeeName} i dag
                {pendingPolicyChange.currentSetting?.effective_from
                  ? ` (aktivert ${formatDateTime(pendingPolicyChange.currentSetting.effective_from)})`
                  : ''}. Velg hvordan du vil håndtere nytt bytte til {formatPolicyLabel(pendingPolicyChange.newPolicy)}.
              </DialogDescription>
            )}
          </DialogHeader>
          {pendingPolicyChange && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Hvis du velger <strong>Bytt nå</strong>, avsluttes dagens aktive pris og en ny rad opprettes med tidspunktet nå.
              </p>
              <p>
                <strong>Planlegg fra i morgen</strong> avslutter dagens pris ved midnatt (UTC) og aktiverer den nye fra
                {` ${formatDateTime(getStartOfTomorrowIso())}.`}
              </p>
              <p>
                <strong>Erstatt dagens bytte</strong> endrer raden som allerede ble opprettet i dag uten å legge til en ny historikk-rad.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPendingPolicyChange(null)}
              disabled={policyActionLoading}
            >
              Avbryt
            </Button>
            <Button
              variant="secondary"
              onClick={() => confirmPolicyChange('replace_today')}
              disabled={policyActionLoading || !pendingPolicyChange?.currentSetting}
            >
              Erstatt dagens bytte
            </Button>
            <Button
              variant="outline"
              onClick={() => confirmPolicyChange('schedule_tomorrow')}
              disabled={policyActionLoading}
            >
              Planlegg fra i morgen
            </Button>
            <Button
              onClick={() => confirmPolicyChange('now')}
              disabled={policyActionLoading}
            >
              Bytt nå
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Ansatte
          </CardTitle>
          <CardDescription>
            Aktiver eller deaktiver refusjon-tilgang og velg prisordning for hver ansatt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laster...
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen ansatte funnet
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {emp.fornavn} {emp.etternavn}
                        {emp.isAdmin && (
                          <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                            Admin
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {emp.isAdmin ? 'Har alltid tilgang' : emp.moduleAccess ? 'Har tilgang' : 'Ingen tilgang'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Switch
                      checked={emp.moduleAccess}
                      onCheckedChange={(checked) => toggleAccess(emp.id, checked)}
                      disabled={emp.isAdmin}
                      className={emp.isAdmin ? 'opacity-50' : ''}
                    />
                    {(emp.moduleAccess || emp.isAdmin) && (
                      <div className="flex flex-col items-end gap-2 w-52">
                        <Select
                          value={emp.pricingPolicy}
                          disabled={policyLoadingProfileId === emp.id || policyActionLoading || netProfileLoadingId === emp.id}
                          onValueChange={(value) => {
                            void handlePolicySelection(emp, value as PricingPolicy);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="norgespris">
                              Norgespris (0.50 kr/kWh)
                            </SelectItem>
                            <SelectItem value="spot_med_stromstotte">
                              Spot + støtte (90%)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {netProfiles.length > 0 ? (
                          <Select
                            value={emp.netProfileId || 'none'}
                            disabled={netProfileLoadingId === emp.id || policyActionLoading}
                            onValueChange={(value) => {
                              const nextValue = value === 'none' ? null : value;
                              void handleNetProfileChange(emp.id, nextValue);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Velg nettprofil" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ingen nettprofil</SelectItem>
                              {netProfiles.map(profileOption => (
                                <SelectItem key={profileOption.id} value={profileOption.id}>
                                  {profileOption.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ingen nettprofiler funnet</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatPolicyLabel(policy: PricingPolicy): string {
  return policy === 'norgespris'
    ? 'Norgespris (0.50 kr/kWh)'
    : 'Spot + støtte (90%)';
}

function isSameDayIso(iso: string | null, reference: Date): boolean {
  if (!iso) return false;
  const candidate = new Date(iso);
  if (Number.isNaN(candidate.getTime())) return false;
  return candidate.toISOString().slice(0, 10) === reference.toISOString().slice(0, 10);
}

function getStartOfTomorrowIso(): string {
  const now = new Date();
  const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrowUtc.toISOString();
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'ukjent tidspunkt';
  return date.toLocaleString('nb-NO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
