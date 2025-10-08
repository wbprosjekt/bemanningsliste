import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { KeyRound, Plus, Copy, Trash2, Clock, Users as UsersIcon } from 'lucide-react';

interface InviteCode {
  id: string;
  code: string;
  role: string;
  expires_at: string;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  created_at: string;
}

interface InviteCodeManagerProps {
  orgId: string;
}

export default function InviteCodeManager({ orgId }: InviteCodeManagerProps) {
  const { toast } = useToast();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [newCodeParams, setNewCodeParams] = useState({
    role: 'user',
    maxUses: 1,
    expiresInDays: 7
  });

  useEffect(() => {
    if (orgId) {
      loadInviteCodes();
    }
  }, [orgId]);

  const loadInviteCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInviteCodes(data || []);
    } catch (error) {
      console.error('Error loading invite codes:', error);
      toast({
        title: 'Feil ved lasting',
        description: 'Kunne ikke laste invitasjonskoder',
        variant: 'destructive'
      });
    }
  };

  const generateInviteCode = async () => {
    setLoading(true);
    try {
      // Generate unique code
      const { data: codeData, error: codeError } = await supabase.rpc('generate_invite_code');
      
      if (codeError) throw codeError;

      const code = codeData;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + newCodeParams.expiresInDays);

      // Insert invite code
      const { error: insertError } = await supabase
        .from('invite_codes')
        .insert({
          org_id: orgId,
          code: code,
          role: newCodeParams.role,
          max_uses: newCodeParams.maxUses,
          expires_at: expiresAt.toISOString(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (insertError) throw insertError;

      toast({
        title: 'Invitasjonskode opprettet!',
        description: `Kode: ${code}`,
      });

      setShowDialog(false);
      loadInviteCodes();
    } catch (error) {
      console.error('Error generating invite code:', error);
      toast({
        title: 'Feil ved opprettelse',
        description: error instanceof Error ? error.message : 'Kunne ikke opprette invitasjonskode',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'Kopiert!',
      description: `Invitasjonskode ${code} er kopiert til utklippstavlen`,
    });
  };

  const deactivateCode = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invite_codes')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Kode deaktivert',
        description: 'Invitasjonskoden kan ikke lenger brukes',
      });

      loadInviteCodes();
    } catch (error) {
      console.error('Error deactivating code:', error);
      toast({
        title: 'Feil ved deaktivering',
        description: 'Kunne ikke deaktivere invitasjonskode',
        variant: 'destructive'
      });
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const isFullyUsed = (code: InviteCode) => {
    return code.current_uses >= code.max_uses;
  };

  const getStatusBadge = (code: InviteCode) => {
    if (!code.is_active) {
      return <Badge variant="secondary">Deaktivert</Badge>;
    }
    if (isExpired(code.expires_at)) {
      return <Badge variant="destructive">Utløpt</Badge>;
    }
    if (isFullyUsed(code)) {
      return <Badge variant="secondary">Brukt opp</Badge>;
    }
    return <Badge variant="default">Aktiv</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Invitasjonskoder
            </CardTitle>
            <CardDescription>
              Generer koder for å invitere nye brukere til organisasjonen
            </CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ny kode
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generer invitasjonskode</DialogTitle>
                <DialogDescription>
                  Opprett en ny invitasjonskode for å invitere brukere
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Rolle</Label>
                  <Select
                    value={newCodeParams.role}
                    onValueChange={(value) => setNewCodeParams({ ...newCodeParams, role: value })}
                  >
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Bruker</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxUses">Maks bruk</Label>
                  <Input
                    id="maxUses"
                    type="number"
                    min="1"
                    max="100"
                    value={newCodeParams.maxUses}
                    onChange={(e) => setNewCodeParams({ ...newCodeParams, maxUses: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Hvor mange ganger koden kan brukes
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiresInDays">Utløper om (dager)</Label>
                  <Input
                    id="expiresInDays"
                    type="number"
                    min="1"
                    max="365"
                    value={newCodeParams.expiresInDays}
                    onChange={(e) => setNewCodeParams({ ...newCodeParams, expiresInDays: parseInt(e.target.value) || 7 })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Antall dager før koden utløper
                  </p>
                </div>

                <Button onClick={generateInviteCode} disabled={loading} className="w-full">
                  {loading ? 'Genererer...' : 'Generer kode'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {inviteCodes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <KeyRound className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Ingen invitasjonskoder opprettet enda</p>
            <p className="text-sm">Klikk "Ny kode" for å opprette din første invitasjonskode</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Bruk</TableHead>
                <TableHead>Utløper</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inviteCodes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell className="font-mono">{code.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{code.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UsersIcon className="h-4 w-4" />
                      {code.current_uses} / {code.max_uses}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {new Date(code.expires_at).toLocaleDateString('no-NO')}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(code)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(code.code)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {code.is_active && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deactivateCode(code.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

