/**
 * Settings Page: Refusjon hjemmelading
 * Configure RFID keys, chargers, net profiles, and pricing policies
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Key, Zap, Settings, Plus, Trash2, TestTube } from 'lucide-react';

export default function RefusjonSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  // RFID Keys
  const [rfidKeys, setRfidKeys] = useState<any[]>([]);
  const [newRfidKey, setNewRfidKey] = useState({ value: '', description: '' });

  // Chargers
  const [chargers, setChargers] = useState<any[]>([]);
  const [newCharger, setNewCharger] = useState({ 
    name: '', 
    address: '', 
    area: 'NO1', 
    timezone: 'Europe/Oslo' 
  });

  // Net Profiles
  const [netProfiles, setNetProfiles] = useState<any[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [touWindows, setTouWindows] = useState<any[]>([]);

  // Test
  const [testStatus, setTestStatus] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [netTestStatus, setNetTestStatus] = useState<string>('');
  const [testingNet, setTestingNet] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string>('');
  const [fetchingPrices, setFetchingPrices] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadTouWindows = async (profileId: string) => {
    const { data, error } = await supabase
      .from('ref_nett_windows')
      .select('*')
      .eq('profile_id', profileId)
      .order('dow', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error loading TOU windows:', error);
      setTouWindows([]);
    } else {
      setTouWindows(data || []);
    }
  };

  useEffect(() => {
    if (selectedProfileId) {
      loadTouWindows(selectedProfileId);
    }
  }, [selectedProfileId]);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get org_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.org_id) {
        setError('Organisasjon ikke funnet');
        return;
      }

      setOrgId(profile.org_id);

      // Load RFID keys
      const { data: keys, error: keysError } = await supabase
        .from('ref_rfid_keys')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false });

      if (keysError) console.error('Error loading RFID keys:', keysError);
      setRfidKeys(keys || []);

      // Load chargers
      const { data: chargerData, error: chargerError } = await supabase
        .from('ref_chargers')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false });

      if (chargerError) console.error('Error loading chargers:', chargerError);
      setChargers(chargerData || []);

      // Load net profiles
      const { data: profileData, error: profileError } = await supabase
        .from('ref_nett_profiles')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false });

      if (profileError) console.error('Error loading net profiles:', profileError);
      setNetProfiles(profileData || []);
      
      // If a profile was created and we have profiles, select the first one
      if (profileData && profileData.length > 0 && !selectedProfileId) {
        setSelectedProfileId(profileData[0].id);
        loadTouWindows(profileData[0].id);
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Feil ved lasting av data');
    } finally {
      setLoading(false);
    }
  }

  const addRfidKey = async () => {
    if (!newRfidKey.value.trim() || !orgId) return;

    try {
      const { data, error } = await supabase
        .from('ref_rfid_keys')
        .insert({
          org_id: orgId,
          rfid_value: newRfidKey.value.trim(),
          description: newRfidKey.description.trim() || null,
          is_company_key: false, // Default to private
        })
        .select()
        .single();

      if (error) throw error;

      setRfidKeys([data, ...rfidKeys]);
      setNewRfidKey({ value: '', description: '' });
      
      toast({
        title: 'RFID-nøkkel lagt til',
        description: 'Nøkkel er nå tilgjengelig i systemet',
      });
    } catch (err: any) {
      console.error('Error adding RFID key:', err);
      toast({
        title: 'Feil',
        description: err.message || 'Kunne ikke legge til RFID-nøkkel',
        variant: 'destructive',
      });
    }
  };

  const addCharger = async () => {
    if (!newCharger.name.trim() || !orgId) return;

    try {
      const { data, error } = await supabase
        .from('ref_chargers')
        .insert({
          org_id: orgId,
          name: newCharger.name.trim(),
          address: newCharger.address.trim() || null,
          price_area: newCharger.area,
          timezone: newCharger.timezone,
        })
        .select()
        .single();

      if (error) throw error;

      setChargers([data, ...chargers]);
      setNewCharger({ name: '', address: '', area: 'NO1', timezone: 'Europe/Oslo' });
      
      toast({
        title: 'Ladeboks lagt til',
        description: 'Ladeboks er nå tilgjengelig i systemet',
      });
    } catch (err: any) {
      console.error('Error adding charger:', err);
      toast({
        title: 'Feil',
        description: err.message || 'Kunne ikke legge til ladeboks',
        variant: 'destructive',
      });
    }
  };

  const testSpotPriceAPI = async () => {
    setTesting(true);
    setTestStatus('Testing Hva Koster Strømmen API...');
    
    try {
      // Test yesterday's price - correct format: 2025/10-25_NO1.json
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, '0');
      const day = String(yesterday.getDate()).padStart(2, '0');
      const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_NO1.json`;
      
      setTestStatus(`Testing: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        setTestStatus(`❌ API returned ${response.status}: ${response.statusText}\nURL: ${url}`);
        return;
      }
      
      const data = await response.json();
      const hours = Object.keys(data).length;
      
      if (hours > 0) {
        const samplePrice = data[0]; // First hour
        setTestStatus(`✅ API FUNGERER! Hentet ${hours} timer\nSample: ${samplePrice} øre/kWh`);
      } else {
        setTestStatus(`⚠️ API returnerte data, men ingen timer funnet`);
      }
      
      toast({
        title: 'Test fullført',
        description: `Hentet ${hours} timer fra API`,
      });
    } catch (err: any) {
      console.error('Error testing API:', err);
      setTestStatus(`❌ Feil: ${err.message}`);
      toast({
        title: 'Test feilet',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const testNettleie = async () => {
    setTestingNet(true);
    setNetTestStatus('Testing nettleie konfigurasjon...');
    
    try {
      if (!orgId) {
        setNetTestStatus('❌ Ingen organisasjon');
        return;
      }

      // Check if any net profiles exist
      const { data: profiles, error: profilesError } = await supabase
        .from('ref_nett_profiles')
        .select('id, name')
        .eq('org_id', orgId);

      if (profilesError) {
        setNetTestStatus(`❌ Feil ved henting av nettprofiler: ${profilesError.message}`);
        return;
      }

      if (!profiles || profiles.length === 0) {
        setNetTestStatus(`⚠️ Ingen nettprofiler konfigurert. Opprett en profil først.`);
        return;
      }

      const profile = profiles[0];
      
      // Check if net profile has TOU windows
      const { data: windows, error: windowsError } = await supabase
        .from('ref_nett_windows')
        .select('*')
        .eq('profile_id', profile.id);

      if (windowsError) {
        setNetTestStatus(`❌ Feil ved henting av TOU-vinduer: ${windowsError.message}`);
        return;
      }

      if (!windows || windows.length === 0) {
        setNetTestStatus(`⚠️ Nettprofil "${profile.name}" har ingen TOU-vinduer.`);
        return;
      }

      setNetTestStatus(`✅ Nettleie konfigurert:\n- Profil: ${profile.name}\n- ${windows.length} TOU-vinduer\n- Vinduer: ${windows.map((w: any) => `${w.name || w.window_name || 'Vindu'}`).join(', ')}`);

      toast({
        title: 'Test fullført',
        description: `${windows.length} TOU-vinduer konfigurert`,
      });
    } catch (err: any) {
      console.error('Error testing nettleie:', err);
      setNetTestStatus(`❌ Feil: ${err.message}`);
      toast({
        title: 'Test feilet',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setTestingNet(false);
    }
  };

  const fetchHistoricalPrices = async () => {
    setFetchingPrices(true);
    setFetchStatus('Henter historiske priser...');
    
    try {
      if (!orgId) {
        setFetchStatus('❌ Ingen organisasjon');
        return;
      }

      const today = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const from = threeMonthsAgo.toISOString().split('T')[0];
      const to = today.toISOString().split('T')[0];

      setFetchStatus(`Henter ${from} → ${to}...`);

      const response = await fetch('/api/admin/refusjon/priser/fetch-historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: 'NO1',
          from,
          to,
          orgId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFetchStatus(`❌ Feil: ${data.error}`);
        toast({
          title: 'Feil',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      setFetchStatus(`✅ Hentet ${data.count} time-priser fra ${from} til ${to}`);
      toast({
        title: 'Priser lastet',
        description: `${data.count} time-priser lagret i databasen`,
      });
    } catch (err: any) {
      console.error('Error fetching prices:', err);
      setFetchStatus(`❌ Feil: ${err.message}`);
      toast({
        title: 'Feil',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setFetchingPrices(false);
    }
  };

  const createNetProfile = async () => {
    if (!newProfileName.trim() || !orgId) return;

    try {
      // Create profile
      const { data: profile, error: profileError } = await supabase
        .from('ref_nett_profiles')
        .insert({
          org_id: orgId,
          name: newProfileName.trim(),
          timezone: 'Europe/Oslo',
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // If it's "Elvia standard", create default windows
      if (newProfileName.trim().toLowerCase().includes('elvia')) {
        const windows = [
          // Dag: mandag-fredag 07:00-22:00 = 43,15 øre/kWh
          { profile_id: profile.id, dow: 0, start_time: '07:00', end_time: '22:00', energy_ore_per_kwh: 43.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 1, start_time: '07:00', end_time: '22:00', energy_ore_per_kwh: 43.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 2, start_time: '07:00', end_time: '22:00', energy_ore_per_kwh: 43.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 3, start_time: '07:00', end_time: '22:00', energy_ore_per_kwh: 43.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 4, start_time: '07:00', end_time: '22:00', energy_ore_per_kwh: 43.15, time_ore_per_kwh: 0 },
          // Natt: mandag-fredag 22:00-07:00 = 33,15 øre/kWh
          { profile_id: profile.id, dow: 0, start_time: '22:00', end_time: '23:59', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 0, start_time: '00:00', end_time: '07:00', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 1, start_time: '22:00', end_time: '23:59', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 1, start_time: '00:00', end_time: '07:00', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 2, start_time: '22:00', end_time: '23:59', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 2, start_time: '00:00', end_time: '07:00', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 3, start_time: '22:00', end_time: '23:59', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 3, start_time: '00:00', end_time: '07:00', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 4, start_time: '22:00', end_time: '23:59', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 4, start_time: '00:00', end_time: '07:00', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
          // Helg: lørdag og søndag hele dagen = 33,15 øre/kWh
          { profile_id: profile.id, dow: 5, start_time: '00:00', end_time: '23:59', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
          { profile_id: profile.id, dow: 6, start_time: '00:00', end_time: '23:59', energy_ore_per_kwh: 33.15, time_ore_per_kwh: 0 },
        ];

        const { error: windowsError } = await supabase
          .from('ref_nett_windows')
          .insert(windows);

        if (windowsError) {
          console.error('Error creating TOU windows:', windowsError);
          toast({
            title: 'Profil opprettet',
            description: 'Men kunne ikke opprette time-vinduer',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Nettprofil opprettet',
            description: 'Elvia-standard med dag/natt-innstillinger',
          });
        }
      } else {
        toast({
          title: 'Nettprofil opprettet',
          description: 'Du kan nå legge til time-vinduer',
        });
      }

      setNetProfiles([profile, ...netProfiles]);
      setNewProfileName('');
      
      // Auto-select the new profile
      setSelectedProfileId(profile.id);
      await loadTouWindows(profile.id);
    } catch (err: any) {
      console.error('Error creating net profile:', err);
      toast({
        title: 'Feil',
        description: err.message || 'Kunne ikke opprette nettprofil',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <p>Laster innstillinger...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Innstillinger - Refusjon hjemmelading</h1>
        <p className="text-muted-foreground">
          Konfigurer RFID-nøkler, ladebokser, nettprofiler og prispolicy
        </p>
      </div>

      <Tabs defaultValue="rfid" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rfid">
            <Key className="mr-2 h-4 w-4" />
            RFID-nøkler
          </TabsTrigger>
          <TabsTrigger value="chargers">
            <Zap className="mr-2 h-4 w-4" />
            Ladebokser
          </TabsTrigger>
          <TabsTrigger value="test">
            <TestTube className="mr-2 h-4 w-4" />
            Test API
          </TabsTrigger>
          <TabsTrigger value="net">
            <Settings className="mr-2 h-4 w-4" />
            Nettprofiler
          </TabsTrigger>
        </TabsList>

        {/* RFID Keys Tab */}
        <TabsContent value="rfid" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>RFID-nøkler</CardTitle>
              <CardDescription>
                Administrer RFID-nøkler for å skille firmalading og privat lading
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new RFID key */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <Label htmlFor="rfid-value">RFID-verdi</Label>
                  <Input
                    id="rfid-value"
                    placeholder="ABC123-DEF456"
                    value={newRfidKey.value}
                    onChange={(e) => setNewRfidKey({ ...newRfidKey, value: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="rfid-description">Beskrivelse</Label>
                  <Input
                    id="rfid-description"
                    placeholder="Firma RFID-nøkkel"
                    value={newRfidKey.description}
                    onChange={(e) => setNewRfidKey({ ...newRfidKey, description: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Button onClick={addRfidKey}>
                    <Plus className="mr-2 h-4 w-4" />
                    Legg til RFID-nøkkel
                  </Button>
                </div>
              </div>

              {/* List existing RFID keys */}
              <div className="space-y-2">
                {rfidKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen RFID-nøkler registrert</p>
                ) : (
                  rfidKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{key.rfid_value}</p>
                        {key.description && (
                          <p className="text-sm text-muted-foreground">{key.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {key.is_company_key ? 'Firma-nøkkel' : 'Privat nøkkel'}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chargers Tab */}
        <TabsContent value="chargers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ladebokser</CardTitle>
              <CardDescription>
                Administrer ladebokser og deres adresser/områder
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new charger */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <Label htmlFor="charger-name">Navn</Label>
                  <Input
                    id="charger-name"
                    placeholder="Hjemmelading"
                    value={newCharger.name}
                    onChange={(e) => setNewCharger({ ...newCharger, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="charger-address">Adresse</Label>
                  <Input
                    id="charger-address"
                    placeholder="Oslo"
                    value={newCharger.address}
                    onChange={(e) => setNewCharger({ ...newCharger, address: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Button onClick={addCharger}>
                    <Plus className="mr-2 h-4 w-4" />
                    Legg til ladeboks
                  </Button>
                </div>
              </div>

              {/* List existing chargers */}
              <div className="space-y-2">
                {chargers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen ladebokser registrert</p>
                ) : (
                  chargers.map((charger) => (
                    <div key={charger.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{charger.name}</p>
                        {charger.address && (
                          <p className="text-sm text-muted-foreground">{charger.address}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Område: {charger.price_area}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test API Tab */}
        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test API-integrasjon</CardTitle>
              <CardDescription>
                Test om strømpris-API og database-integrasjon fungerer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Spotpris API</Label>
                  <p className="text-sm text-muted-foreground">
                    Test om vi kan hente spotpriser fra ekstern API
                  </p>
                  <Button 
                    onClick={testSpotPriceAPI}
                    disabled={testing}
                    variant="default"
                  >
                    {testing ? 'Tester...' : 'Test spotpris API'}
                  </Button>
                  {testStatus && (
                    <Alert className="mt-2">
                      <AlertDescription className="whitespace-pre-line">{testStatus}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label>Nettleie konfigurasjon</Label>
                  <p className="text-sm text-muted-foreground">
                    Test om nettprofiler og TOU-vinduer er konfigurert
                  </p>
                  <Button 
                    onClick={testNettleie}
                    disabled={testingNet}
                    variant="default"
                  >
                    {testingNet ? 'Tester...' : 'Test nettleie'}
                  </Button>
                  {netTestStatus && (
                    <Alert className="mt-2">
                      <AlertDescription className="whitespace-pre-line">{netTestStatus}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label>Hent historiske spotpriser</Label>
                  <p className="text-sm text-muted-foreground">
                    Last ned 3 måneders spotpriser fra Hva Koster Strømmen og lagre i databasen
                  </p>
                  <Button 
                    onClick={fetchHistoricalPrices}
                    disabled={fetchingPrices}
                    variant="default"
                  >
                    {fetchingPrices ? 'Henter...' : 'Hent 3 måneders priser'}
                  </Button>
                  {fetchStatus && (
                    <Alert className="mt-2">
                      <AlertDescription className="whitespace-pre-line">{fetchStatus}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <Label>Database Status</Label>
                  <p className="text-sm text-muted-foreground mt-2">
                    Organisasjon: {orgId ? 'Lastet' : 'Ikke lastet'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Net Profiles Tab */}
        <TabsContent value="net" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nettprofiler</CardTitle>
              <CardDescription>
                Konfigurer tid-differensierte nettprofiler for nettleie-beregning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="mb-4">
                <AlertDescription>
                  <strong>Hva er nettleie?</strong><br />
                  Nettleie er kostnaden for å frakte strømmen gjennom nettet. Elvia har to prisnivåer:<br />
                  • <strong>Dag:</strong> 07:00-22:00 = 43,15 øre/kWh<br />
                  • <strong>Natt/helg:</strong> 22:00-07:00 + helg = 33,15 øre/kWh
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Opprett nettprofil</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="F.eks. Elvia standard" 
                      className="max-w-xs"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                    />
                    <Button onClick={createNetProfile}>Lag profil</Button>
                  </div>
                  <Button 
                    variant="outline" 
                    className="text-sm"
                    onClick={() => {
                      setNewProfileName('Elvia standard');
                      createNetProfile();
                    }}
                  >
                    📋 Opprett Elvia-standard profil med dag/natt-innstillinger
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Prisene hentes fra nettleverandøren (ikke fra API)
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t space-y-4">
                <Label>Eksisterende profiler</Label>
                {netProfiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">
                    Ingen profiler opprettet ennå.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {netProfiles.map((profile) => (
                      <div 
                        key={profile.id} 
                        className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedProfileId === profile.id ? 'border-blue-500 bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedProfileId(profile.id)}
                      >
                        <p className="font-medium">{profile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Opprettet {new Date(profile.created_at).toLocaleDateString('no')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Show TOU windows for selected profile */}
                {selectedProfileId && touWindows.length > 0 && (
                  <div className="space-y-2">
                    <Label>Time-vinduer for valgt profil</Label>
                    <div className="space-y-1">
                      {touWindows.map((window) => {
                        const dayNames = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
                        return (
                          <div key={window.id} className="text-sm p-2 bg-gray-50 rounded">
                            {dayNames[window.dow]} {window.start_time}-{window.end_time}: {window.energy_ore_per_kwh} øre/kWh
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

