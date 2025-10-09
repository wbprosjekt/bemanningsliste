import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building2, User, CheckCircle, KeyRound, LogOut } from 'lucide-react';

interface OnboardingDialogProps {
  onComplete: () => void;
}

const OnboardingDialog = ({ onComplete }: OnboardingDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [formData, setFormData] = useState({
    orgName: '',
    orgNumber: '',
    displayName: '',
    role: 'admin'
  });
  const [inviteCode, setInviteCode] = useState('');

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: 'Feil ved utlogging',
        description: 'Kunne ikke logge ut. Prøv igjen.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateOrg = async () => {
    if (!user || !formData.orgName.trim() || !formData.displayName.trim()) {
      toast({
        title: "Manglende informasjon",
        description: "Vennligst fyll inn organisasjonsnavn og ditt navn.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('onboarding-setup', {
        body: {
          orgName: formData.orgName.trim(),
          orgNumber: formData.orgNumber.trim() || null,
          displayName: formData.displayName.trim(),
          role: formData.role,
        },
      });

      if (error) throw error;

      if (!data?.ok) {
        throw new Error(data?.message || 'Kunne ikke fullføre oppsett');
      }

      toast({
        title: 'Velkommen!',
        description: `${formData.orgName} er opprettet og du er nå klar til å bruke systemet.`,
      });

      onComplete();
    } catch (error: unknown) {
      console.error('Setup error:', error);
      toast({
        title: 'Feil ved oppsett',
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrg = async () => {
    if (!user || !inviteCode.trim()) {
      toast({
        title: "Manglende informasjon",
        description: "Vennligst skriv inn invitasjonskoden.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-invite-code', {
        body: {
          code: inviteCode.trim(),
        },
      });

      if (error) throw error;

      if (!data?.valid) {
        throw new Error(data?.error_message || 'Ugyldig invitasjonskode');
      }

      toast({
        title: 'Velkommen!',
        description: `Du er nå medlem av ${data.org_name}.`,
      });

      onComplete();
    } catch (error: unknown) {
      console.error('Join error:', error);
      toast({
        title: 'Feil ved innmelding',
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md relative">
        {/* Logout button - escape hatch for users */}
        <div className="absolute top-4 right-4 z-10">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
            title="Logg ut og bruk en annen bruker"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Logg ut
          </Button>
        </div>

        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <CheckCircle className="h-6 w-6 text-primary" />
            Velkommen!
          </CardTitle>
          <p className="text-muted-foreground">
            Opprett ny organisasjon eller bli med i eksisterende
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'create' | 'join')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="create">
                <Building2 className="h-4 w-4 mr-2" />
                Opprett ny
              </TabsTrigger>
              <TabsTrigger value="join">
                <KeyRound className="h-4 w-4 mr-2" />
                Bli med
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organisasjonsnavn *
            </Label>
            <Input
              id="orgName"
              value={formData.orgName}
              onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
              placeholder="Min Bedrift AS"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="orgNumber">Organisasjonsnummer (valgfritt)</Label>
            <Input
              id="orgNumber"
              value={formData.orgNumber}
              onChange={(e) => setFormData({ ...formData, orgNumber: e.target.value })}
              placeholder="123456789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Ditt navn *
            </Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="Fornavn Etternavn"
            />
          </div>

          <div className="bg-muted/50 p-3 rounded-lg text-sm">
            <h4 className="font-medium mb-2">🔄 Tripletex-integrasjon</h4>
            <p className="text-muted-foreground">
              Etter oppsettet kan du koble til Tripletex via Admin → Integrasjoner. 
              Dette synkroniserer ansatte, prosjekter og aktiviteter automatisk.
            </p>
          </div>

              <Button 
                onClick={handleCreateOrg} 
                disabled={loading}
                className="w-full"
              >
                {loading ? "Oppretter..." : "Opprett organisasjon"}
              </Button>
            </TabsContent>

            <TabsContent value="join" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Invitasjonskode
                </Label>
                <Input
                  id="inviteCode"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Skriv inn 8-siffret kode"
                  maxLength={8}
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  Få invitasjonskoden fra din organisasjons administrator
                </p>
              </div>

              <Button
                onClick={handleJoinOrg}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Kobler til..." : "Bli med i organisasjon"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingDialog;