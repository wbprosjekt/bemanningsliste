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
import { Save, Mail, TestTube, CheckCircle, XCircle, Clock, Eye, EyeOff } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";

interface EmailSettings {
  id?: string;
  org_id: string;
  provider: string;
  api_key: string;
  from_email: string;
  from_name: string;
  site_url: string;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_username?: string | null;
  smtp_password?: string | null;
  smtp_secure?: boolean | null;
  is_active: boolean | null;
  last_tested_at?: string | null;
  test_status?: string | null;
  test_error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export default function EmailSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testEmail, setTestEmail] = useState('');

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
    if (!profile?.org_id) {
      console.log('No org_id found in profile:', profile);
      return;
    }

    try {
      setLoading(true);
      console.log('Loading email settings for org_id:', profile.org_id);
      
      const { data, error } = await supabase
        .from('email_settings')
        .select('*')
        .eq('org_id', profile.org_id)
        .single();

      console.log('Email settings query result:', { data, error });

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Email settings query error:', error);
        throw error;
      }

      if (data) {
        setSettings(data as any);
      } else {
        // Create default settings if none exist
        const defaultSettings: EmailSettings = {
          org_id: profile.org_id,
          provider: 'resend',
          api_key: '',
          from_email: 'noreply@wbprosjekt.no',
          from_name: 'Bemanningsliste',
          site_url: 'https://bemanningsliste.vercel.app',
          is_active: false,
        };
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error loading email settings:', error);
      toast({
        title: "Feil ved lasting av innstillinger",
        description: "Kunne ikke laste e-post innstillinger.",
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
        .from('email_settings')
        .upsert({
          ...settings,
          org_id: profile.org_id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'org_id'
        });

      if (error) throw error;

      toast({
        title: "✅ Innstillinger lagret!",
        description: "E-post innstillinger er oppdatert.",
      });
    } catch (error) {
      console.error('Error saving email settings:', error);
      toast({
        title: "Feil ved lagring",
        description: "Kunne ikke lagre e-post innstillinger.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testEmailSettings = async () => {
    if (!settings || !profile?.org_id) return;

    if (!testEmail.trim()) {
      toast({
        title: "Mangler e-post adresse",
        description: "Vennligst skriv inn e-post adressen du vil sende test til.",
        variant: "destructive",
      });
      return;
    }

    try {
      setTesting(true);

      // Update test status to pending
      setSettings(prev => prev ? { ...prev, test_status: 'pending' } : null);

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
        // Update settings with success and save to database
        const updatedSettings = { 
          ...settings, 
          test_status: 'success',
          last_tested_at: new Date().toISOString(),
          test_error_message: null
        };
        
        setSettings(updatedSettings);
        
        // Save test status to database
        await supabase
          .from('email_settings')
          .upsert({
            ...updatedSettings,
            org_id: profile.org_id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'org_id'
          });

        toast({
          title: "✅ Test vellykket!",
          description: `Test-e-post sendt til ${data.sentTo}`,
        });
      } else {
        // Update settings with failure and save to database
        const updatedSettings = { 
          ...settings, 
          test_status: 'failed',
          last_tested_at: new Date().toISOString(),
          test_error_message: data?.error || 'Ukjent feil'
        };
        
        setSettings(updatedSettings);
        
        // Save test status to database
        await supabase
          .from('email_settings')
          .upsert({
            ...updatedSettings,
            org_id: profile.org_id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'org_id'
          });

        throw new Error(data?.error || 'Kunne ikke sende test-e-post');
      }
    } catch (error: unknown) {
      console.error('Error testing email settings:', error);
      
      // Update settings with failure and save to database
      const updatedSettings = { 
        ...settings, 
        test_status: 'failed',
        last_tested_at: new Date().toISOString(),
        test_error_message: error instanceof Error ? error.message : 'Ukjent feil'
      };
      
      setSettings(updatedSettings);
      
      // Save test status to database
      try {
        await supabase
          .from('email_settings')
          .upsert({
            ...updatedSettings,
            org_id: profile.org_id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'org_id'
          });
      } catch (dbError) {
        console.error('Error saving test status to database:', dbError);
      }

      toast({
        title: "Test feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const updateSettings = (updates: Partial<EmailSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...updates });
  };

  const getTestStatusIcon = () => {
    if (!settings?.test_status) return null;
    
    switch (settings.test_status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getTestStatusText = () => {
    if (!settings?.test_status) return 'Ikke testet';
    
    switch (settings.test_status) {
      case 'success':
        return 'Test vellykket';
      case 'failed':
        return 'Test feilet';
      case 'pending':
        return 'Tester...';
      default:
        return 'Ikke testet';
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
            <h1 className="text-3xl font-bold tracking-tight">E-post innstillinger</h1>
            <p className="text-muted-foreground">
              Konfigurer e-post service for påminnelser og notifikasjoner
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveSettings} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Lagrer..." : "Lagre innstillinger"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Grunnleggende innstillinger */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Grunnleggende innstillinger
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="is-active">Aktiver e-post sending</Label>
                <Switch
                  id="is-active"
                  checked={settings.is_active ?? false}
                  onCheckedChange={(checked) => updateSettings({ is_active: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">E-post service</Label>
                <Select
                  value={settings.provider}
                  onValueChange={(value) => updateSettings({ provider: value as 'resend' | 'sendgrid' | 'smtp' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resend">Resend (Anbefalt)</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="smtp">Egendefinert SMTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="from-email">Fra e-post</Label>
                <Input
                  id="from-email"
                  type="email"
                  value={settings.from_email}
                  onChange={(e) => updateSettings({ from_email: e.target.value })}
                  placeholder="noreply@wbprosjekt.no"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="from-name">Fra navn</Label>
                <Input
                  id="from-name"
                  value={settings.from_name}
                  onChange={(e) => updateSettings({ from_name: e.target.value })}
                  placeholder="Bemanningsliste"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="site-url">Nettside URL</Label>
                <Input
                  id="site-url"
                  value={settings.site_url}
                  onChange={(e) => updateSettings({ site_url: e.target.value })}
                  placeholder="https://bemanningsliste.vercel.app"
                />
              </div>
            </CardContent>
          </Card>

          {/* API konfigurasjon */}
          <Card>
            <CardHeader>
              <CardTitle>API konfigurasjon</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">API nøkkel</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showApiKey ? "text" : "password"}
                    value={settings.api_key}
                    onChange={(e) => updateSettings({ api_key: e.target.value })}
                    placeholder="re_..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.provider === 'resend' && 'Få API nøkkel fra resend.com'}
                  {settings.provider === 'sendgrid' && 'Få API nøkkel fra sendgrid.com'}
                  {settings.provider === 'smtp' && 'SMTP passord for autentisering'}
                </p>
              </div>

              {/* SMTP innstillinger (kun for SMTP provider) */}
              {settings.provider === 'smtp' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-host">SMTP server</Label>
                    <Input
                      id="smtp-host"
                      value={settings.smtp_host || ''}
                      onChange={(e) => updateSettings({ smtp_host: e.target.value })}
                      placeholder="smtp.gmail.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">SMTP port</Label>
                    <Input
                      id="smtp-port"
                      type="number"
                      value={settings.smtp_port || 587}
                      onChange={(e) => updateSettings({ smtp_port: parseInt(e.target.value) || 587 })}
                      placeholder="587"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-username">SMTP brukernavn</Label>
                    <Input
                      id="smtp-username"
                      value={settings.smtp_username || ''}
                      onChange={(e) => updateSettings({ smtp_username: e.target.value })}
                      placeholder="din@email.com"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="smtp-secure">Sikker tilkobling (TLS)</Label>
                    <Switch
                      id="smtp-secure"
                      checked={settings.smtp_secure ?? true}
                      onCheckedChange={(checked) => updateSettings({ smtp_secure: checked })}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Test e-post */}
        <Card>
          <CardHeader>
            <CardTitle>Test e-post</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Send test e-post til</Label>
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
              onClick={testEmailSettings} 
              disabled={testing || !settings.api_key || !settings.from_email || !testEmail.trim()}
              className="w-full"
            >
              <TestTube className="mr-2 h-4 w-4" />
              {testing ? "Sender test e-post..." : "Send test e-post"}
            </Button>
          </CardContent>
        </Card>

        {/* Test status */}
        <Card>
          <CardHeader>
            <CardTitle>Test status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getTestStatusIcon()}
                <span>{getTestStatusText()}</span>
              </div>
              {settings.last_tested_at && (
                <span className="text-sm text-muted-foreground">
                  Sist testet: {new Date(settings.last_tested_at).toLocaleString('no-NO')}
                </span>
              )}
            </div>
            {settings.test_error_message && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{settings.test_error_message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
