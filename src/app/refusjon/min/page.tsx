/**
 * Employee Page: Mine refusjonsrapporter
 * Shows only the logged-in employee's reimbursement reports
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Reimbursement {
  id: string;
  period_month: string;
  total_kwh: number;
  total_amount_nok: number;
  pdf_url: string | null;
  csv_url: string | null;
  created_at: string;
}

export default function MineRefusjonerPage() {
  const { toast } = useToast();
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    loadMyReports();
  }, []);

  async function loadMyReports() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get employee_id from person table (linked to auth.users via user_id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        toast({
          title: 'Ingen ansattprofil',
          description: 'Du må være tilknyttet en ansatt for å se refusjoner',
          variant: 'destructive',
        });
        return;
      }

      // Check module access
      const { data: moduleAccess } = await supabase
        .from('profile_modules')
        .select('enabled')
        .eq('profile_id', profile.id)
        .eq('module_name', 'refusjon_hjemmelading')
        .single();

      if (!moduleAccess?.enabled) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      setHasAccess(true);

      // Query reimbursements for this employee
      const { data, error } = await supabase
        .from('ref_reimbursements')
        .select('*')
        .eq('employee_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReimbursements(data || []);
    } catch (error) {
      console.error('Error loading my reports:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste refusjonsrapporter',
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
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Laster rapporter...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Ingen tilgang</h2>
            <p className="text-muted-foreground">Du har ikke tilgang til refusjon-modulen</p>
            <p className="text-sm text-muted-foreground mt-2">
              Ta kontakt med administratoren for å få tilgang
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Mine refusjoner</h1>
        <p className="text-muted-foreground">
          Se og last ned dine refusjonsrapporter for hjemmelading
        </p>
      </div>

      {reimbursements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Ingen refusjonsrapporter funnet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Ta kontakt med administrasjon for å få generert refusjonsrapporter
            </p>
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
                      <Calendar className="h-5 w-5" />
                      {formatMonth(r.period_month)}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Generert: {formatDate(r.created_at)}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

