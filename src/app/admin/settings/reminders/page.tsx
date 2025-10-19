"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Save, Mail, Clock, Calendar, Users } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";

interface ReminderSettings {
  id?: string;
  org_id: string;
  payroll_enabled: boolean | null;
  payroll_days_before: number | null;
  payroll_day_of_month: number | null;
  weekly_enabled: boolean | null;
  weekly_day: number | null;
  weekly_time: string | null;
  send_to_all: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export default function ReminderSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const dayNames = [
    "Mandag", "Tirsdag", "Onsdag", "Torsdag", 
    "Fredag", "Lørdag", "Søndag"
  ];

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  useEffect(() => {
    if (user && profile) {
      loadSettings();
    }
  }, [user, profile]);

  const loadProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, org:org_id (id, name)")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error("Error loading profile:", err);
      toast({
        title: "Profil mangler",
        description: "Kunne ikke laste profil. Prøv å logge ut og inn igjen.",
        variant: "destructive",
      });
    }
  };

  const loadSettings = async () => {
    if (!profile?.org_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('org_id', profile.org_id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setSettings(data as any);
      } else {
        // Create default settings if none exist
        const defaultSettings: ReminderSettings = {
          org_id: profile.org_id,
          payroll_enabled: true,
          payroll_days_before: 3,
          payroll_day_of_month: 10,
          weekly_enabled: true,
          weekly_day: 5, // Friday
          weekly_time: '12:00',
          send_to_all: true,
        };
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error loading reminder settings:', error);
      toast({
        title: "Feil ved lasting av innstillinger",
        description: "Kunne ikke laste påminnelse-innstillinger.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings || !profile?.org_id) return;

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('reminder_settings')
        .upsert({
          ...settings,
          org_id: profile.org_id,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "✅ Innstillinger lagret!",
        description: "Påminnelse-innstillinger er oppdatert.",
      });
    } catch (error) {
      console.error('Error saving reminder settings:', error);
      toast({
        title: "Feil ved lagring",
        description: "Kunne ikke lagre påminnelse-innstillinger.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (updates: Partial<ReminderSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...updates });
  };

  const sendManualReminder = async (reminderType: 'weekly' | 'payroll') => {
    if (!profile?.org_id) return;

    try {
      setSendingTest(true);

      // Get current session for JWT token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const { data, error } = await supabase.functions.invoke('email-reminders', {
        body: { 
          action: reminderType === 'weekly' ? 'send-weekly-reminder' : 'send-payroll-reminder',
          orgId: profile.org_id
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: `✅ ${reminderType === 'weekly' ? 'Ukentlig' : 'Payroll'} påminnelse sendt!`,
          description: `Sendt til ${data.sent} mottakere`,
        });
      } else {
        throw new Error(data?.error || `Kunne ikke sende ${reminderType} påminnelse`);
      }
    } catch (error: unknown) {
      console.error(`Error sending ${reminderType} reminder:`, error);
      toast({
        title: `Feil ved sending av ${reminderType} påminnelse`,
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const sendTestEmail = async () => {
    if (!profile?.org_id) return;

    if (!testEmail.trim()) {
      toast({
        title: "Mangler e-post adresse",
        description: "Vennligst skriv inn e-post adressen du vil sende test til.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingTest(true);

      // Get current session for JWT token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const { data, error } = await supabase.functions.invoke('email-reminders', {
        body: { 
          action: 'send-test',
          orgId: profile.org_id,
          testEmail: testEmail.trim()
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "✅ Test-e-post sendt!",
          description: `Test-påminnelse er sendt til ${data.sentTo}`,
        });
      } else {
        throw new Error(data?.error || 'Kunne ikke sende test-e-post');
      }
    } catch (error: unknown) {
      console.error('Error sending test email:', error);
      toast({
        title: "Feil ved sending av test-e-post",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-muted-foreground">Laster innstillinger...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Kunne ikke laste innstillinger.</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredRole="any-admin">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Påminnelse-innstillinger</h1>
            <p className="text-muted-foreground">
              Konfigurer påminnelser for timeføring og lønnskjøring
            </p>
          </div>
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Lagrer..." : "Lagre innstillinger"}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Lønnspåminnelse */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Lønnspåminnelse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="payroll-enabled">Aktiver lønnspåminnelse</Label>
                <Switch
                  id="payroll-enabled"
                  checked={settings.payroll_enabled ?? false}
                  onCheckedChange={(checked) => updateSettings({ payroll_enabled: checked })}
                />
              </div>

              {settings.payroll_enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="payroll-days-before">Antall arbeidsdager før lønnskjøring</Label>
                    <Input
                      id="payroll-days-before"
                      type="number"
                      min="1"
                      max="14"
                      value={settings.payroll_days_before ?? 3}
                      onChange={(e) => updateSettings({ payroll_days_before: parseInt(e.target.value) || 3 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payroll-day-of-month">Lønnskjøring dag i måneden</Label>
                    <Input
                      id="payroll-day-of-month"
                      type="number"
                      min="1"
                      max="31"
                      value={settings.payroll_day_of_month ?? 1}
                      onChange={(e) => updateSettings({ payroll_day_of_month: parseInt(e.target.value) || 10 })}
                    />
                    <p className="text-sm text-muted-foreground">
                      Eksempel: 10 = 10. hver måned
                    </p>
                  </div>
                  
                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.open('/admin/settings/templates', '_blank')}
                    >
                      Rediger Email Template
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Ukentlig påminnelse */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Ukentlig påminnelse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="weekly-enabled">Aktiver ukentlig påminnelse</Label>
                <Switch
                  id="weekly-enabled"
                  checked={settings.weekly_enabled ?? false}
                  onCheckedChange={(checked) => updateSettings({ weekly_enabled: checked })}
                />
              </div>

              {settings.weekly_enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="weekly-day">Dag i uken</Label>
                    <Select
                      value={settings.weekly_day?.toString() ?? '1'}
                      onValueChange={(value) => updateSettings({ weekly_day: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dayNames.map((day, index) => (
                          <SelectItem key={index} value={(index + 1).toString()}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weekly-time">Tidspunkt</Label>
                    <Input
                      id="weekly-time"
                      type="time"
                      value={settings.weekly_time ?? '09:00'}
                      onChange={(e) => updateSettings({ weekly_time: e.target.value })}
                    />
                  </div>
                  
                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.open('/admin/settings/templates', '_blank')}
                    >
                      Rediger Email Template
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Mottakere */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mottakere
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="send-to-all">Send til alle ansatte</Label>
                <p className="text-sm text-muted-foreground">
                  Inkluder ledere og administratorer i påminnelser
                </p>
              </div>
              <Switch
                id="send-to-all"
                checked={settings.send_to_all ?? false}
                onCheckedChange={(checked) => updateSettings({ send_to_all: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Manuell påminnelse */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Manuell påminnelse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send påminnelser manuelt til alle brukere i organisasjonen
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                onClick={() => sendManualReminder('weekly')}
                disabled={sendingTest}
                className="flex items-center gap-2"
                variant="outline"
              >
                <Mail className="h-4 w-4" />
                Send ukentlig påminnelse
              </Button>
              
              <Button 
                onClick={() => sendManualReminder('payroll')}
                disabled={sendingTest}
                className="flex items-center gap-2"
                variant="outline"
              >
                <Mail className="h-4 w-4" />
                Send payroll påminnelse
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="test-email">Send test-påminnelse til</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="din@email.com"
              />
              <p className="text-xs text-muted-foreground">
                Skriv inn e-post adressen du vil sende test-påminnelse til
              </p>
            </div>
            <Button 
              onClick={sendTestEmail}
              disabled={sendingTest || !testEmail.trim()}
              className="flex items-center gap-2 w-full"
            >
              <Mail className="h-4 w-4" />
              {sendingTest ? "Sender test-påminnelse..." : "Send test-påminnelse"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
