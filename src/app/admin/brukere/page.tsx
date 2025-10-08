"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Calendar,
  Shield,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  Key,
} from "lucide-react";
import { getWeekNumber } from "@/lib/displayNames";
import OnboardingDialog from "@/components/OnboardingDialog";
import UserInviteSystem from "@/components/UserInviteSystem";
import InviteCodeManager from "@/components/InviteCodeManager";
import ProtectedRoute from "@/components/ProtectedRoute";

interface Profile {
  id: string;
  org_id: string;
  user_id: string;
  created_at: string;
  role: string;
  org?: {
    id: string;
    name: string;
  } | null;
}

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
    forventet_dagstimer?: number | null;
  } | null;
}

interface PersonRecord {
  id: string;
  fornavn: string;
  etternavn: string;
  epost: string | null;
  aktiv: boolean;
  person_type: string | null;
  forventet_dagstimer: number | null;
}

const AdminBrukerePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "user",
    display_name: "",
  });
  const [showOnboarding, setShowOnboarding] = useState(false);

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
      setShowOnboarding(true);
    }
  }, [user]);

  const loadUsers = useCallback(async () => {
    if (!profile?.org_id) return;

    setLoading(true);
    try {
      const [profilesResponse, personsResponse] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, user_id, display_name, role, created_at")
          .eq("org_id", profile.org_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("person")
          .select("id, fornavn, etternavn, epost, aktiv, person_type, forventet_dagstimer")
          .eq("org_id", profile.org_id),
      ]);

      const { data, error } = profilesResponse;
      const { data: personData, error: personError } = personsResponse;

      if (error) throw error;
      if (personError) throw personError;

      const persons = (personData || []) as PersonRecord[];

      const normalizeName = (value: string | null | undefined) =>
        (value || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const personByEmail = new Map<string, PersonRecord>();
      const personByName = new Map<string, PersonRecord>();

      persons.forEach((person) => {
        if (person.epost) {
          personByEmail.set(person.epost.toLowerCase(), person);
        }
        const nameKey = normalizeName(`${person.fornavn} ${person.etternavn}`);
        if (nameKey) {
          personByName.set(nameKey, person);
        }
      });

      const usersWithDetails = (data || []).map((userProfile) => {
        let matchedPerson: PersonRecord | null = null;

        if (userProfile.display_name) {
          const displayNameKey = normalizeName(userProfile.display_name);
          if (displayNameKey) {
            matchedPerson = personByName.get(displayNameKey) ?? null;
          }
        }

        const enhancedProfile: UserProfile = {
          ...userProfile,
          role: userProfile.role ?? "user",
          user_email: matchedPerson?.epost ?? "Se auth-system",
          person: matchedPerson
            ? {
                id: matchedPerson.id,
                fornavn: matchedPerson.fornavn,
                etternavn: matchedPerson.etternavn,
                epost: matchedPerson.epost,
                aktiv: matchedPerson.aktiv,
                person_type: matchedPerson.person_type ?? "ansatt",
                forventet_dagstimer: matchedPerson.forventet_dagstimer,
              }
            : null,
        };

        return enhancedProfile;
      });

      setUsers(usersWithDetails);
    } catch (err) {
      console.error("Error loading users:", err);
      toast({
        title: "Feil ved lasting av brukere",
        description: "Kunne ikke laste brukerliste.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.org_id, toast]);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user, loadUserProfile]);

  useEffect(() => {
    if (profile) {
      loadUsers();
    }
  }, [profile, loadUsers]);

  const handleInviteUser = async () => {
    if (!profile?.org_id) return;

    try {
      toast({
        title: "Invitasjon sendt",
        description: `Invitasjon er sendt til ${inviteForm.email}`,
      });

      setShowInviteDialog(false);
      setInviteForm({ email: "", role: "user", display_name: "" });
    } catch (error: unknown) {
      toast({
        title: "Feil ved sending av invitasjon",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const newRole = currentStatus ? "inactive" : "user";

      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);

      if (error) throw error;

      toast({
        title: currentStatus ? "Bruker deaktivert" : "Bruker aktivert",
        description: `Brukeren er nå ${!currentStatus ? "aktiv" : "inaktiv"}.`,
      });

      loadUsers();
    } catch (error: unknown) {
      toast({
        title: "Feil ved endring av brukerstatus",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    }
  };

  const resetUserPassword = async (email: string, userName: string) => {
    try {
      // Use production URL for redirect, or current origin if not localhost
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const redirectUrl = isLocalhost 
        ? 'https://bemanningsliste.vercel.app/auth/reset-password'  // Production URL
        : `${window.location.origin}/auth/reset-password`;           // Current domain
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) throw error;

      toast({
        title: "✉️ Passord-reset sendt",
        description: `Reset-lenke er sendt til ${email}. ${userName} kan nå endre passordet sitt.`,
      });
    } catch (error: unknown) {
      toast({
        title: "Feil ved sending av reset-lenke",
        description: error instanceof Error ? error.message : "Kunne ikke sende reset-lenke.",
        variant: "destructive",
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);

      if (error) throw error;

      toast({
        title: "Rolle oppdatert",
        description: "Brukerens rolle er oppdatert.",
      });

      loadUsers();
    } catch (error: unknown) {
      toast({
        title: "Feil ved oppdatering av rolle",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive",
      });
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    loadUserProfile();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500">🛡️ Admin</Badge>;
      case "manager":
        return <Badge className="bg-blue-500">👨‍💼 Leder</Badge>;
      default:
        return <Badge variant="outline">👤 Bruker</Badge>;
    }
  };

  const getStatusBadge = (userProfile: UserProfile) => {
    if (userProfile.role === "inactive") {
      return <Badge variant="destructive">❌ Inaktiv</Badge>;
    }
    return <Badge className="bg-green-500">✅ Aktiv</Badge>;
  };

  const getPersonTypeBadge = (userProfile: UserProfile) => {
    if (userProfile.person?.person_type) {
      const type = userProfile.person.person_type.toLowerCase();
      if (type === "konsulent") {
        return <Badge className="bg-purple-500">🤝 Konsulent</Badge>;
      }
      if (type === "underleverandor") {
        return <Badge className="bg-orange-500">🏗️ Underleverandør</Badge>;
      }
      return <Badge variant="outline">👤 {userProfile.person.person_type}</Badge>;
    }

    if (userProfile.role === "admin") {
      return <Badge className="bg-red-500">🛡️ Administrator</Badge>;
    }
    return <Badge variant="outline">👤 Bruker</Badge>;
  };

  const handleSimulateUser = (userProfile: UserProfile) => {
    if (!userProfile.person) {
      toast({
        title: "Ingen ansattprofil funnet",
        description: "Knytt brukeren til en person før du kan simulere deres uke.",
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    const currentWeek = getWeekNumber(now);
    const currentYear = now.getFullYear();
    const formattedWeek = currentWeek.toString().padStart(2, "0");

    router.push(`/min/uke/${currentYear}/${formattedWeek}?simulatePersonId=${userProfile.person.id}`);
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (userProfile) =>
          userProfile.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          userProfile.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          userProfile.person?.fornavn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          userProfile.person?.etternavn?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [users, searchTerm],
  );

  if (showOnboarding) {
    return <OnboardingDialog onComplete={handleOnboardingComplete} />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
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
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Brukerhåndtering</h1>
            <p className="mt-1 text-muted-foreground">
              {profile.org?.name} - Administrer brukere og tilganger
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadUsers} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Oppdater
            </Button>
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
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
                      onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })}
                      placeholder="bruker@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Visningsnavn</Label>
                    <Input
                      id="display_name"
                      value={inviteForm.display_name}
                      onChange={(event) => setInviteForm({ ...inviteForm, display_name: event.target.value })}
                      placeholder="Fornavn Etternavn"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Rolle</Label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 border bg-background">
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
                  <p className="text-2xl font-bold">{users.filter((userProfile) => userProfile.role === "admin").length}</p>
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
                  <p className="text-2xl font-bold">
                    {users.filter((userProfile) => userProfile.person?.aktiv !== false).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Aktive brukere</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søk i brukere..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <UserInviteSystem orgId={profile.org_id} onUsersUpdated={loadUsers} />

        <InviteCodeManager orgId={profile.org_id} />

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
                <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
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
                          <div className="font-medium">{userProfile.display_name || "Ukjent navn"}</div>
                          <div className="text-sm text-muted-foreground">ID: {userProfile.user_id.slice(0, 8)}...</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {userProfile.person?.epost || userProfile.user_email || "Ikke tilgjengelig"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRoleBadge(userProfile.role)}
                          <Select value={userProfile.role} onValueChange={(value) => updateUserRole(userProfile.id, value)}>
                            <SelectTrigger className="h-auto w-auto border-none bg-transparent p-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-50 border bg-background">
                              <SelectItem value="user">Bruker</SelectItem>
                              <SelectItem value="manager">Leder</SelectItem>
                              <SelectItem value="admin">Administrator</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>{getPersonTypeBadge(userProfile)}</TableCell>
                      <TableCell>{getStatusBadge(userProfile)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(userProfile.created_at).toLocaleDateString("no-NO")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleUserStatus(userProfile.id, userProfile.role !== "inactive")}
                            title={userProfile.role !== "inactive" ? "Deaktiver bruker" : "Aktiver bruker"}
                          >
                            {userProfile.role !== "inactive" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const email = userProfile.person?.epost || userProfile.user_email;
                              const name = userProfile.display_name || "Brukeren";
                              if (email && confirm(`Send passord-reset e-post til ${email}?`)) {
                                resetUserPassword(email, name);
                              } else if (!email) {
                                toast({
                                  title: "Mangler e-post",
                                  description: "Kan ikke sende reset-lenke uten e-postadresse.",
                                  variant: "destructive"
                                });
                              }
                            }}
                            disabled={!userProfile.person?.epost && !userProfile.user_email}
                            title="Send passord-reset e-post"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSimulateUser(userProfile)}
                            disabled={!userProfile.person}
                            title={
                              userProfile.person
                                ? 'Åpne "Min uke" som denne personen'
                                : "Ingen tilknyttet ansatt funnet"
                            }
                          >
                            <UserCheck className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        {searchTerm ? "Ingen brukere funnet med søkekriteriene." : "Ingen brukere funnet."}
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
    </ProtectedRoute>
  );
};

export default AdminBrukerePage;


