/**
 * Employee Page: Refusjon hjemmelading
 * View and download own reimbursement reports
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Calendar, DollarSign, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Reimbursement {
  id: string;
  period_month: string;
  total_kwh: number;
  total_amount_nok: number;
  pdf_url?: string;
  csv_url?: string;
  created_at: string;
}

export default function RefusjonPage() {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReimbursements();
  }, []);

  async function loadReimbursements() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ref_reimbursements')
        .select('*')
        .eq('employee_id', user.id)
        .order('period_month', { ascending: false });

      if (error) {
        console.error('Error loading reimbursements:', error);
        return;
      }

      setReimbursements(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Laster...</div>
      </div>
    );
  }

  if (reimbursements.length === 0) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Mine refusjoner</h1>
          <p className="text-muted-foreground">Refusjoner for hjemmelading</p>
        </div>

        <Alert>
          <AlertDescription>
            Du har ingen refusjoner ennå. Når admin har generert rapporter for deg, vil de vises her.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Zap className="h-8 w-8 text-primary" />
          Mine refusjoner
        </h1>
        <p className="text-muted-foreground">Refusjoner for hjemmelading</p>
      </div>

      <div className="space-y-4">
        {reimbursements.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {new Date(report.period_month).toLocaleDateString('nb-NO', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </CardTitle>
                  <CardDescription>
                    Generert {new Date(report.created_at).toLocaleDateString('nb-NO')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Totalt kWh</p>
                  <p className="text-2xl font-bold">{report.total_kwh.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Beløp</p>
                  <p className="text-2xl font-bold">
                    {report.total_amount_nok.toLocaleString('nb-NO', {
                      style: 'currency',
                      currency: 'NOK',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {report.pdf_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(report.pdf_url, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Last ned PDF
                  </Button>
                )}
                {report.csv_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(report.csv_url, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Last ned CSV
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

