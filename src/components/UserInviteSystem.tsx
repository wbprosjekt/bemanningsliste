import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, Mail, UserPlus, RefreshCw } from 'lucide-react';

interface UserInviteSystemProps {
  orgId: string;
  onUsersUpdated: () => void;
}

const UserInviteSystem = ({ orgId, onUsersUpdated }: UserInviteSystemProps) => {
  const [tripletexEmployees, setTripletexEmployees] = useState<any[]>([]);
  const [loadingTripletexSync, setLoadingTripletexSync] = useState(false);
  const [showTripletexDialog, setShowTripletexDialog] = useState(false);
  const { toast } = useToast();

  const syncTripletexEmployees = async () => {
    setLoadingTripletexSync(true);
    try {
      const { data, error } = await supabase.functions.invoke('tripletex-api', {
        body: { 
          action: 'sync-employees',
          orgId: orgId
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Tripletex synkronisering fullført",
          description: `${data.data?.employees || 0} ansatte synkronisert, ${data.data?.profilesCreated || 0} nye profiler opprettet`
        });
        
        // Load the synced employees for display
        loadTripletexEmployees();
        onUsersUpdated();
      } else {
        throw new Error(data?.error || 'Synkronisering feilet');
      }
    } catch (error: any) {
      toast({
        title: "Synkronisering feilet",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingTripletexSync(false);
    }
  };

  const loadTripletexEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('ttx_employee_cache')
        .select('*')
        .eq('org_id', orgId)
        .eq('aktiv', true)
        .order('fornavn');

      if (error) throw error;
      setTripletexEmployees(data || []);
    } catch (error) {
      console.error('Error loading Tripletex employees:', error);
    }
  };

  const createUserFromEmployee = async (employee: any) => {
    if (!employee.epost) {
      toast({
        title: "Mangler e-post",
        description: "Kan ikke opprette bruker uten e-postadresse",
        variant: "destructive"
      });
      return;
    }

    try {
      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('org_id', orgId)
        .eq('display_name', `${employee.fornavn} ${employee.etternavn}`)
        .single();

      if (existingProfile) {
        toast({
          title: "Bruker eksisterer allerede",
          description: `${employee.fornavn} ${employee.etternavn} har allerede en profil`,
          variant: "destructive"
        });
        return;
      }

      // Create profile placeholder
      const profileId = crypto.randomUUID();
      
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: profileId,
          user_id: profileId, // Temporary until actual signup
          org_id: orgId,
          display_name: `${employee.fornavn} ${employee.etternavn}`,
          role: 'user'
        });

      if (profileError) throw profileError;

      toast({
        title: "Profil opprettet",
        description: `Profil opprettet for ${employee.fornavn} ${employee.etternavn}. De kan nå logge inn med e-post: ${employee.epost}`
      });

      onUsersUpdated();
      setShowTripletexDialog(false);
    } catch (error: any) {
      toast({
        title: "Feil ved oppretting",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Tripletex Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Tripletex Ansatt-synkronisering
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Synkroniser ansatte fra Tripletex og opprett automatisk brukerprofiler.
          </p>
          
          <div className="flex gap-2">
            <Button 
              onClick={syncTripletexEmployees}
              disabled={loadingTripletexSync}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {loadingTripletexSync ? 'Synkroniserer...' : 'Synkroniser fra Tripletex'}
            </Button>
            
            <Dialog open={showTripletexDialog} onOpenChange={setShowTripletexDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={loadTripletexEmployees}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Se Tripletex ansatte
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Tripletex Ansatte</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Ansatte synkronisert fra Tripletex. Klikk for å opprette brukerprofil.
                  </p>
                  
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {tripletexEmployees.map(employee => (
                      <div 
                        key={employee.id}
                        className="flex items-center justify-between p-3 border rounded"
                      >
                        <div>
                          <div className="font-medium">
                            {employee.fornavn} {employee.etternavn}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {employee.epost || 'Ingen e-post'}
                          </div>
                          <Badge variant={employee.aktiv ? 'default' : 'secondary'}>
                            {employee.aktiv ? 'Aktiv' : 'Inaktiv'}
                          </Badge>
                        </div>
                        
                        <Button
                          size="sm"
                          onClick={() => createUserFromEmployee(employee)}
                          disabled={!employee.epost || !employee.aktiv}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Opprett bruker
                        </Button>
                      </div>
                    ))}
                    
                    {tripletexEmployees.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Ingen ansatte funnet. Kjør synkronisering først.
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserInviteSystem;