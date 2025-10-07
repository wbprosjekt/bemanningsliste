"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Save, Mail, Eye, FileText, Calendar, Clock } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";

interface EmailTemplate {
  id?: string;
  org_id: string;
  template_type: string;
  subject: string;
  body_html: string;
  body_text: string;
  variables: string[];
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_TEMPLATES = {
  payroll: {
    subject: "Påminnelse: Timeføring før lønnskjøring",
    body_html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Påminnelse om timeføring</h2>
        <p>Hei {{navn}},</p>
        <p>Dette er en påminnelse om at lønnskjøring skjer <strong>{{frist}}</strong>.</p>
        <p>Vennligst sørg for at alle timer for denne perioden er ført inn i systemet.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Viktig:</strong></p>
          <ul>
            <li>Følg inn alle timer før {{frist}}</li>
            <li>Kontroller at alle prosjekter er korrekte</li>
            <li>Ta kontakt hvis du har spørsmål</li>
          </ul>
        </div>
        <p>Du kan følge inn timer her: <a href="{{link}}" style="color: #2563eb;">{{link}}</a></p>
        <p>Med vennlig hilsen,<br>HR-avdelingen</p>
      </div>
    `,
    body_text: `
Påminnelse om timeføring

Hei {{navn}},

Dette er en påminnelse om at lønnskjøring skjer {{frist}}.

Vennligst sørg for at alle timer for denne perioden er ført inn i systemet.

Viktig:
- Følg inn alle timer før {{frist}}
- Kontroller at alle prosjekter er korrekte
- Ta kontakt hvis du har spørsmål

Du kan følge inn timer her: {{link}}

Med vennlig hilsen,
HR-avdelingen
    `,
    variables: ['navn', 'frist', 'link']
  },
  weekly: {
    subject: "Ukentlig påminnelse: Timeføring",
    body_html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Ukentlig påminnelse</h2>
        <p>Hei {{navn}},</p>
        <p>Dette er din ukentlige påminnelse om å føre inn timer for uke {{uke}}.</p>
        <p>Husk å følge inn alle timer jevnlig for å unngå problemer ved lønnskjøring.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Tips for timeføring:</strong></p>
          <ul>
            <li>Følg inn timer daglig</li>
            <li>Velg riktig prosjekt</li>
            <li>Legg til kommentarer ved behov</li>
          </ul>
        </div>
        <p>Du kan følge inn timer her: <a href="{{link}}" style="color: #2563eb;">{{link}}</a></p>
        <p>Med vennlig hilsen,<br>HR-avdelingen</p>
      </div>
    `,
    body_text: `
Ukentlig påminnelse

Hei {{navn}},

Dette er din ukentlige påminnelse om å føre inn timer for uke {{uke}}.

Husk å følge inn alle timer jevnlig for å unngå problemer ved lønnskjøring.

Tips for timeføring:
- Følg inn timer daglig
- Velg riktig prosjekt
- Legg til kommentarer ved behov

Du kan følge inn timer her: {{link}}

Med vennlig hilsen,
HR-avdelingen
    `,
    variables: ['navn', 'uke', 'link']
  },
  test: {
    subject: "Test-påminnelse",
    body_html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Test-påminnelse</h2>
        <p>Hei {{navn}},</p>
        <p>Dette er en test-påminnelse for å verifisere at email-systemet fungerer korrekt.</p>
        <p>Dato: {{dato}}</p>
        <p>Denne meldingen ble sendt som en del av systemtesting.</p>
        <p>Med vennlig hilsen,<br>HR-avdelingen</p>
      </div>
    `,
    body_text: `
Test-påminnelse

Hei {{navn}},

Dette er en test-påminnelse for å verifisere at email-systemet fungerer korrekt.

Dato: {{dato}}

Denne meldingen ble sendt som en del av systemtesting.

Med vennlig hilsen,
HR-avdelingen
    `,
    variables: ['navn', 'dato']
  }
};

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'payroll' | 'weekly' | 'test'>('payroll');

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  useEffect(() => {
    if (user && profile) {
      loadTemplates();
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

  const loadTemplates = async () => {
    if (!profile?.org_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('org_id', profile.org_id);

      if (error) throw error;

      if (data && data.length > 0) {
        setTemplates(data);
      } else {
        // Create default templates if none exist
        const defaultTemplates: EmailTemplate[] = Object.entries(DEFAULT_TEMPLATES).map(([type, template]) => ({
          org_id: profile.org_id,
          template_type: type as 'payroll' | 'weekly' | 'test',
          subject: template.subject,
          body_html: template.body_html,
          body_text: template.body_text,
          variables: template.variables
        }));
        setTemplates(defaultTemplates);
      }
    } catch (error) {
      console.error('Error loading email templates:', error);
      toast({
        title: "Feil ved lasting av templates",
        description: "Kunne ikke laste email templates.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async (templateType: 'payroll' | 'weekly' | 'test') => {
    if (!profile?.org_id) return;

    const template = templates.find(t => t.template_type === templateType);
    if (!template) return;

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('email_templates')
        .upsert({
          ...template,
          org_id: profile.org_id,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "✅ Template lagret!",
        description: `${templateType === 'payroll' ? 'Lønnspåminnelse' : templateType === 'weekly' ? 'Ukentlig påminnelse' : 'Test'} template er oppdatert.`,
      });
    } catch (error) {
      console.error('Error saving email template:', error);
      toast({
        title: "Feil ved lagring",
        description: "Kunne ikke lagre email template.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = (templateType: 'payroll' | 'weekly' | 'test', updates: Partial<EmailTemplate>) => {
    setTemplates(prev => prev.map(t => 
      t.template_type === templateType 
        ? { ...t, ...updates }
        : t
    ));
  };

  const getCurrentTemplate = () => {
    return templates.find(t => t.template_type === activeTab) || DEFAULT_TEMPLATES[activeTab];
  };

  const getTemplateIcon = (type: string) => {
    switch (type) {
      case 'payroll': return <Calendar className="h-5 w-5" />;
      case 'weekly': return <Clock className="h-5 w-5" />;
      case 'test': return <Mail className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getTemplateTitle = (type: string) => {
    switch (type) {
      case 'payroll': return 'Lønnspåminnelse';
      case 'weekly': return 'Ukentlig påminnelse';
      case 'test': return 'Test-påminnelse';
      default: return 'Template';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-muted-foreground">Laster templates...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredRole="any-admin">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
            <p className="text-muted-foreground">
              Rediger email templates for påminnelser
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'payroll' | 'weekly' | 'test')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="payroll" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Lønnspåminnelse
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Ukentlig
            </TabsTrigger>
            <TabsTrigger value="test" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Test
            </TabsTrigger>
          </TabsList>

          {(['payroll', 'weekly', 'test'] as const).map((templateType) => {
            const template = getCurrentTemplate();
            return (
              <TabsContent key={templateType} value={templateType} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getTemplateIcon(templateType)}
                      {getTemplateTitle(templateType)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Subject */}
                    <div className="space-y-2">
                      <Label htmlFor={`subject-${templateType}`}>Emne</Label>
                      <Input
                        id={`subject-${templateType}`}
                        value={template.subject}
                        onChange={(e) => updateTemplate(templateType, { subject: e.target.value })}
                        placeholder="Email emne..."
                      />
                    </div>

                    {/* Variables Info */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-900 mb-2">Tilgjengelige variabler:</h4>
                      <div className="flex flex-wrap gap-2">
                        {template.variables.map((variable) => (
                          <span key={variable} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                            {`{{${variable}}}`}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-blue-700 mt-2">
                        Bruk disse variablene i emne og innhold for å personalisere meldingene.
                      </p>
                    </div>

                    {/* HTML Content */}
                    <div className="space-y-2">
                      <Label htmlFor={`html-${templateType}`}>HTML Innhold</Label>
                      <Textarea
                        id={`html-${templateType}`}
                        value={template.body_html}
                        onChange={(e) => updateTemplate(templateType, { body_html: e.target.value })}
                        placeholder="HTML innhold..."
                        rows={15}
                        className="font-mono text-sm"
                      />
                    </div>

                    {/* Text Content */}
                    <div className="space-y-2">
                      <Label htmlFor={`text-${templateType}`}>Tekst Innhold</Label>
                      <Textarea
                        id={`text-${templateType}`}
                        value={template.body_text}
                        onChange={(e) => updateTemplate(templateType, { body_text: e.target.value })}
                        placeholder="Tekst innhold..."
                        rows={10}
                        className="font-mono text-sm"
                      />
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <Button 
                        onClick={() => saveTemplate(templateType)} 
                        disabled={saving}
                        className="flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {saving ? "Lagrer..." : "Lagre template"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}


