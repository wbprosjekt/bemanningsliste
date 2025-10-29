/**
 * Admin Page: Refusjon historikk
 * View all generated reimbursement reports
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Calendar, User, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { loadEmployeesOptimized } from '@/lib/databaseOptimized';

interface Reimbursement {
  id: string;
  employee_id: string;
  period_month: string;
  total_kwh: number;
  total_amount_nok: number;
  pdf_url: string | null;
  csv_url: string | null;
  created_at: string;
  employee?: { fornavn: string; etternavn: string };
}

export default function RefusjonHistorikkPage() {
  const { toast } = useToast();
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [allReimbursements, setAllReimbursements] = useState<Reimbursement[]>([]);

  useEffect(() => {
    loadEmployees();
    loadReimbursements();
  }, []);

  useEffect(() => {
    // Filter reimbursements based on search query
    if (!searchQuery.trim()) {
      setReimbursements(allReimbursements);
      return;
    }

    const filtered = allReimbursements.filter(r => {
      const name = `${r.employee?.fornavn || ''} ${r.employee?.etternavn || ''}`.toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    });
    
    setReimbursements(filtered);
  }, [searchQuery, allReimbursements]);

  async function loadEmployees() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.org_id) return;

      const emp = await loadEmployeesOptimized(profile.org_id);
      setEmployees(emp);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  }

  async function loadReimbursements() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's org_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Query all reimbursements for this org
      const { data, error } = await supabase
        .from('ref_reimbursements')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch employee names (employee_id is now profiles.id, not person.id)
      const reimbursementsWithNames = await Promise.all(
        (data || []).map(async (r) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', r.employee_id)
            .maybeSingle();

          // Parse display_name to fornavn/etternavn
          const nameParts = profile?.display_name?.split(' ') || [];
          const emp = {
            fornavn: nameParts[0] || '',
            etternavn: nameParts.slice(1).join(' ') || '',
          };

          return {
            ...r,
            employee: emp,
          };
        })
      );

      setAllReimbursements(reimbursementsWithNames);
      setReimbursements(reimbursementsWithNames);
    } catch (error) {
      console.error('Error loading reimbursements:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste refusjonshistorikk',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr);
    return new Intl.DateTimeFormat('no-NO', { year: 'numeric', month: 'long' }).format(date);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('no-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  async function deleteReimbursement(reimbursementId: string) {
    if (!confirm('Er du sikker på at du vil slette denne refusjonsrapporten?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ref_reimbursements')
        .delete()
        .eq('id', reimbursementId);

      if (error) throw error;

      // Remove from state
      setAllReimbursements(allReimbursements.filter(r => r.id !== reimbursementId));
      setReimbursements(reimbursements.filter(r => r.id !== reimbursementId));

      toast({
        title: 'Rapport slettet',
        description: 'Refusjonsrapporten er slettet',
      });
    } catch (error) {
      console.error('Error deleting reimbursement:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke slette rapport',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Refusjon historikk</h1>
        <p className="text-muted-foreground">
          Se og last ned tidligere refusjonsrapporter
        </p>
      </div>

      {/* Search Filter */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Søk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="search">Søk etter ansatt</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Skriv navn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchQuery && (
              <p className="text-sm text-muted-foreground">
                Viser {reimbursements.length} av {allReimbursements.length} rapporter
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reimbursements List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground">Laster...</div>
        </div>
      ) : reimbursements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Ingen refusjonsrapporter funnet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reimbursements.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {r.employee?.fornavn} {r.employee?.etternavn}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <Calendar className="h-4 w-4" />
                      {formatMonth(r.period_month)}
                      <span className="ml-4">
                        Generert: {formatDate(r.created_at)}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total kWh</p>
                    <p className="text-2xl font-bold">{r.total_kwh.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total refusjon</p>
                    <p className="text-2xl font-bold text-green-600">
                      {r.total_amount_nok.toFixed(2)} kr
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Snitt per kWh</p>
                    <p className="text-2xl font-bold">
                      {(r.total_amount_nok / r.total_kwh).toFixed(2)} kr
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 items-center justify-between">
                  <div className="flex gap-2">
                    {r.pdf_url && (
                      <Button
                        variant="outline"
                        onClick={() => window.open(r.pdf_url!, '_blank')}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Last ned PDF
                      </Button>
                    )}
                    {r.csv_url && (
                      <Button
                        variant="outline"
                        onClick={() => window.open(r.csv_url!, '_blank')}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Last ned CSV
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteReimbursement(r.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Slett
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

