import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  Plus, 
  Search, 
  Mail, 
  Phone,
  MapPin,
  Eye,
  EyeOff,
  Edit,
  RefreshCw,
  DollarSign,
  FileText
} from 'lucide-react';

interface Profile {
  id: string;
  org_id: string;
  user_id: string;
  created_at: string;
}

interface Underleverandor {
  id: string;
  navn: string;
  kontaktperson: string | null;
  epost: string | null;
  telefon: string | null;
  adresse: string | null;
  organisasjonsnummer: string | null;
  timepris: number | null;
  aktiv: boolean;
  notater: string | null;
  created_at: string;
  updated_at: string;
}

const AdminUnderleverandorer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [underleverandorer, setUnderleverandorer] = useState<Underleverandor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    navn: '',
    kontaktperson: '',
    epost: '',
    telefon: '',
    adresse: '',
    org_id: ''
  });

  const loadUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, org:org_id (id, name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [user]);

  const loadUnderleverandorer = useCallback(async () => {
    if (!profile?.org_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('underleverandorer')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUnderleverandorer(data || []);
    } catch (error) {
      console.error('Error loading underleverandorer:', error);
      toast({
        title: "Feil ved lasting av underleverandører",
        description: "Kunne ikke laste underleverandører.",
        variant: "destructive"
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
      loadUnderleverandorer();
    }
  }, [profile, loadUnderleverandorer]);

  const resetForm = () => {
    setFormData({
      navn: '',
      kontaktperson: '',
      epost: '',
      telefon: '',
      adresse: '',
      organisasjonsnummer: '',
      timepris: '',
      notater: ''
    });
    setEditingId(null);
  };

  const openEditDialog = (underleverandor: Underleverandor) => {
    setFormData({
      navn: underleverandor.navn,
      kontaktperson: underleverandor.kontaktperson || '',
      epost: underleverandor.epost || '',
      telefon: underleverandor.telefon || '',
      adresse: underleverandor.adresse || '',
      organisasjonsnummer: underleverandor.organisasjonsnummer || '',
      timepris: underleverandor.timepris?.toString() || '',
      notater: underleverandor.notater || ''
    });
    setEditingId(underleverandor.id);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!profile?.org_id) return;

    if (!formData.navn.trim()) {
      toast({
        title: "Navn påkrevd",
        description: "Du må fylle inn navn på underleverandør.",
        variant: "destructive"
      });
      return;
    }

    try {
      const saveData = {
        org_id: profile.org_id,
        navn: formData.navn.trim(),
        kontaktperson: formData.kontaktperson.trim() || null,
        epost: formData.epost.trim() || null,
        telefon: formData.telefon.trim() || null,
        adresse: formData.adresse.trim() || null,
        organisasjonsnummer: formData.organisasjonsnummer.trim() || null,
        timepris: formData.timepris ? parseFloat(formData.timepris) : null,
        notater: formData.notater.trim() || null
      };

      if (editingId) {
        const { error } = await supabase
          .from('underleverandorer')
          .update(saveData)
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: "Underleverandør oppdatert",
          description: "Informasjonen er oppdatert."
        });
      } else {
        const { error } = await supabase
          .from('underleverandorer')
          .insert(saveData);

        if (error) throw error;

        toast({
          title: "Underleverandør opprettet",
          description: "Ny underleverandør er lagt til."
        });
      }

      setShowDialog(false);
      resetForm();
      loadUnderleverandorer();
    } catch (error: unknown) {
      toast({
        title: editingId ? "Feil ved oppdatering" : "Feil ved opprettelse",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive"
      });
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('underleverandorer')
        .update({ aktiv: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: currentStatus ? "Underleverandør deaktivert" : "Underleverandør aktivert",
        description: `Underleverandøren er nå ${!currentStatus ? 'aktiv' : 'inaktiv'}.`
      });

      loadUnderleverandorer();
    } catch (error: unknown) {
      toast({
        title: "Feil ved endring av status",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive"
      });
    }
  };

  const createPersonForUnderleverandor = async (underleverandor: Underleverandor) => {
    try {
      const { error } = await supabase
        .from('person')
        .insert({
          org_id: profile.org_id,
          fornavn: underleverandor.kontaktperson || underleverandor.navn,
          etternavn: '', // Underleverandører kan ha kun ett navn
          epost: underleverandor.epost,
          person_type: 'underleverandor',
          underleverandor_id: underleverandor.id,
          aktiv: underleverandor.aktiv
        });

      if (error) throw error;

      toast({
        title: "Person opprettet",
        description: "Underleverandøren kan nå brukes i bemanningslisten."
      });
    } catch (error: unknown) {
      toast({
        title: "Feil ved opprettelse av person",
        description: error instanceof Error ? error.message : "En uventet feil oppstod",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (aktiv: boolean) => {
    return aktiv ? 
      <Badge className="bg-green-500">✅ Aktiv</Badge> : 
      <Badge variant="destructive">❌ Inaktiv</Badge>;
  };

  const filteredUnderleverandorer = underleverandorer.filter(ul =>
    ul.navn.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ul.kontaktperson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ul.epost?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ul.organisasjonsnummer?.includes(searchTerm)
  );

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Laster...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Underleverandører</h1>
            <p className="text-muted-foreground mt-1">
              {profile.org?.name} - Administrer underleverandører for bemanningslisten
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadUnderleverandorer} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Oppdater
            </Button>
            <Dialog open={showDialog} onOpenChange={(open) => {
              setShowDialog(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Ny underleverandør
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? 'Rediger underleverandør' : 'Ny underleverandør'}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="navn">Navn *</Label>
                      <Input
                        id="navn"
                        value={formData.navn}
                        onChange={(e) => setFormData({ ...formData, navn: e.target.value })}
                        placeholder="Firmanavn"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kontaktperson">Kontaktperson</Label>
                      <Input
                        id="kontaktperson"
                        value={formData.kontaktperson}
                        onChange={(e) => setFormData({ ...formData, kontaktperson: e.target.value })}
                        placeholder="Fornavn Etternavn"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="epost">E-post</Label>
                      <Input
                        id="epost"
                        type="email"
                        value={formData.epost}
                        onChange={(e) => setFormData({ ...formData, epost: e.target.value })}
                        placeholder="post@firma.no"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefon">Telefon</Label>
                      <Input
                        id="telefon"
                        value={formData.telefon}
                        onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                        placeholder="+47 12 34 56 78"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adresse">Adresse</Label>
                    <Input
                      id="adresse"
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      placeholder="Gateadresse, postnummer og sted"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="organisasjonsnummer">Organisasjonsnummer</Label>
                      <Input
                        id="organisasjonsnummer"
                        value={formData.organisasjonsnummer}
                        onChange={(e) => setFormData({ ...formData, organisasjonsnummer: e.target.value })}
                        placeholder="123456789"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timepris">Timepris (NOK)</Label>
                      <Input
                        id="timepris"
                        type="number"
                        step="0.01"
                        value={formData.timepris}
                        onChange={(e) => setFormData({ ...formData, timepris: e.target.value })}
                        placeholder="850.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notater">Notater</Label>
                    <Textarea
                      id="notater"
                      value={formData.notater}
                      onChange={(e) => setFormData({ ...formData, notater: e.target.value })}
                      placeholder="Interne notater om underleverandøren..."
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowDialog(false)}>
                      Avbryt
                    </Button>
                    <Button onClick={handleSave}>
                      {editingId ? 'Oppdater' : 'Opprett'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Statistics and Search */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{underleverandorer.length}</p>
                  <p className="text-sm text-muted-foreground">Totalt</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{underleverandorer.filter(u => u.aktiv).length}</p>
                  <p className="text-sm text-muted-foreground">Aktive</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {Math.round(underleverandorer
                      .filter(u => u.timepris && u.aktiv)
                      .reduce((sum, u) => sum + (u.timepris || 0), 0) / 
                      Math.max(1, underleverandorer.filter(u => u.timepris && u.aktiv).length)
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">Snitt timepris</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Søk i underleverandører..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Underleverandorer Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Underleverandører ({filteredUnderleverandorer.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Laster underleverandører...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Kontaktperson</TableHead>
                    <TableHead>Kontaktinfo</TableHead>
                    <TableHead>Org.nr</TableHead>
                    <TableHead className="text-right">Timepris</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnderleverandorer.map((ul) => (
                    <TableRow key={ul.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <div className="font-medium">{ul.navn}</div>
                          {ul.notater && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {ul.notater.slice(0, 50)}...
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {ul.kontaktperson || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {ul.epost && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {ul.epost}
                            </div>
                          )}
                          {ul.telefon && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {ul.telefon}
                            </div>
                          )}
                          {ul.adresse && (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              {ul.adresse.slice(0, 30)}...
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {ul.organisasjonsnummer || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {ul.timepris ? `${ul.timepris.toLocaleString('no-NO')} kr` : '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(ul.aktiv)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(ul)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleStatus(ul.id, ul.aktiv)}
                          >
                            {ul.aktiv ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => createPersonForUnderleverandor(ul)}
                            title="Legg til i bemanningsliste"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {filteredUnderleverandorer.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? 'Ingen underleverandører funnet med søkekriteriene.' : 'Ingen underleverandører registrert ennå.'}
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

export default AdminUnderleverandorer;