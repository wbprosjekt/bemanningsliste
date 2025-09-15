import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building2, User, CheckCircle } from 'lucide-react';

interface OnboardingDialogProps {
  onComplete: () => void;
}

const OnboardingDialog = ({ onComplete }: OnboardingDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    orgName: '',
    orgNumber: '',
    displayName: '',
    role: 'admin'
  });

  const handleSetup = async () => {
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
    } catch (error: any) {
      console.error('Setup error:', error);
      toast({
        title: 'Feil ved oppsett',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <CheckCircle className="h-6 w-6 text-primary" />
            Velkommen!
          </CardTitle>
          <p className="text-muted-foreground">
            La oss sette opp din organisasjon og profil
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
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
            onClick={handleSetup} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Oppretter..." : "Opprett organisasjon"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingDialog;