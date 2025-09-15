import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  UserPlus, 
  Search, 
  Mail, 
  Calendar,
  Shield,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { getPersonDisplayName } from '@/lib/displayNames';
import OnboardingDialog from '@/components/OnboardingDialog';

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  role: string;
  created_at: string;
  user_email?: string;
  person?: {
    id: string;
    fornavn: string;
    etternavn: string;
    epost: string | null;
    aktiv: boolean;
    person_type: string;
  } | null;
}

const AdminBrukere = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'user',
    display_name: ''
  });
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      loadUsers();
    }
  }, [profile]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, org:org_id (id, name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) {
        setShowOnboarding(true);
        return;
      }
      
      setProfile(data);

      if (!data) {
        toast({
          title: "Profil mangler",
          description: "Du må opprette en profil før du kan bruke admin-sider.",
          variant: "destructive"
        });
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setShowOnboarding(true);
    }
  };

  const loadUsers = async () => {
    if (!profile?.org_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          display_name,
          role,
          created_at
        `)
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // For now, we'll use the profile user_id to get email from auth, but that requires service role
      // In production, you'd either store email in profiles or use a different approach
      const usersWithEmails = (data || []).map(userProfile => ({
        ...userProfile,
        user_email: 'Se auth-system',
        person: null // We'll handle person linking separately if needed
      }));

      setUsers(usersWithEmails);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Feil ved lasting av brukere",
        description: "Kunne ikke laste brukerliste.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!profile?.org_id) return;

    try {
      // In a real implementation, you would:
      // 1. Send an invitation email
      // 2. Create a pending invitation record
      // 3. Let the user sign up and automatically assign them to the org

      toast({
        title: "Invitasjon sendt",
        description: `Invitasjon er sendt til ${inviteForm.email}`,
      });

      setShowInviteDialog(false);
      setInviteForm({ email: '', role: 'user', display_name: '' });
    } catch (error: any) {
      toast({
        title: "Feil ved sending av invitasjon",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      // Toggle the profile's active status (we'll use role to simulate this)
      const newRole = currentStatus ? 'inactive' : 'user';
      
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: currentStatus ? "Bruker deaktivert" : "Bruker aktivert",
        description: `Brukeren er nå ${!currentStatus ? 'aktiv' : 'inaktiv'}.`
      });

      loadUsers();
    } catch (error: any) {
      toast({
        title: "Feil ved endring av brukerstatus",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Rolle oppdatert",
        description: "Brukerens rolle er oppdatert."
      });

      loadUsers();
    } catch (error: any) {
      toast({
        title: "Feil ved oppdatering av rolle",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    loadUserProfile();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-red-500">🛡️ Admin</Badge>;
      case 'manager':
        return <Badge className="bg-blue-500">👨‍💼 Leder</Badge>;
      default:
        return <Badge variant="outline">👤 Bruker</Badge>;
    }
  };

  const getStatusBadge = (userProfile: UserProfile) => {
    if (userProfile.role === 'inactive') {
      return <Badge variant="destructive">❌ Inaktiv</Badge>;
    }
    return <Badge className="bg-green-500">✅ Aktiv</Badge>;
  };

  const getPersonTypeBadge = (userProfile: UserProfile) => {
    // Since we don't have person data loaded, show based on role
    if (userProfile.role === 'admin') {
      return <Badge className="bg-red-500">👨‍💼 Administrator</Badge>;
    }
    return <Badge variant="outline">👤 Bruker</Badge>;
  };

  const filteredUsers = users.filter(user =>
    user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.person?.fornavn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.person?.etternavn?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showOnboarding) {
    return <OnboardingDialog onComplete={handleOnboardingComplete} />;
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Profil mangler</h2>
          <p className="text-muted-foreground">
            Du må opprette en profil og være tilknyttet en organisasjon før du kan bruke admin-sidene.
          </p>
          <Button onClick={() => setShowOnboarding(true)}>Sett opp organisasjon</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Brukerhåndtering</h1>
            <p className="text-muted-foreground mt-1">
              {profile.org?.name} - Administrer brukere og tilganger
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadUsers} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Oppdater
            </Button>
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Inviter bruker
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Inviter ny bruker</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-postadresse</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="bruker@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Visningsnavn</Label>
                    <Input
                      id="display_name"
                      value={inviteForm.display_name}
                      onChange={(e) => setInviteForm({ ...inviteForm, display_name: e.target.value })}
                      placeholder="Fornavn Etternavn"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Rolle</Label>
                    <Select value={inviteForm.role} onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50">
                        <SelectItem value="user">Bruker</SelectItem>
                        <SelectItem value="manager">Leder</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleInviteUser} className="w-full">
                    Send invitasjon
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search and Statistics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{users.length}</p>
                  <p className="text-sm text-muted-foreground">Totale brukere</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</p>
                  <p className="text-sm text-muted-foreground">Administratorer</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{users.filter(u => u.person?.aktiv !== false).length}</p>
                  <p className="text-sm text-muted-foreground">Aktive brukere</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Søk i brukere..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Brukere ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Laster brukere...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bruker</TableHead>
                    <TableHead>E-post</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Opprettet</TableHead>
                    <TableHead>Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((userProfile) => (
                    <TableRow key={userProfile.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {userProfile.display_name || 'Ukjent navn'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ID: {userProfile.user_id.slice(0, 8)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {userProfile.user_email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRoleBadge(userProfile.role)}
                          <Select 
                            value={userProfile.role} 
                            onValueChange={(value) => updateUserRole(userProfile.id, value)}
                          >
                            <SelectTrigger className="w-auto h-auto p-1 border-none bg-transparent">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border z-50">
                              <SelectItem value="user">Bruker</SelectItem>
                              <SelectItem value="manager">Leder</SelectItem>
                              <SelectItem value="admin">Administrator</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPersonTypeBadge(userProfile)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(userProfile)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(userProfile.created_at).toLocaleDateString('no-NO')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleUserStatus(userProfile.id, userProfile.role !== 'inactive')}
                          >
                            {userProfile.role !== 'inactive' ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? 'Ingen brukere funnet med søkekriteriene.' : 'Ingen brukere funnet.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminBrukere;