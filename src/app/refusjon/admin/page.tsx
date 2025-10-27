/**
 * Admin Page: Refusjon hjemmelading
 * CSV upload, analysis, and report generation
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUp, AlertCircle, Download, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function RefusjonAdminPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [periodMonth, setPeriodMonth] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleParse = async () => {
    if (!file || !employeeId || !periodMonth) {
      toast({
        title: 'Mangler informasjon',
        description: 'Du må velge fil, ansatt og periode',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employee_id', employeeId);
      formData.append('period_month', periodMonth);

      const response = await fetch('/api/admin/refusjon/csv/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 422 && data.error_code === 'MISSING_RFID_COLUMN') {
          setError(
            'Denne filen mangler RFID-nøkkel. Eksporter en "Easee Key Detailed Report" fra Easee Control for å kunne skille firmalading og privat lading.'
          );
        } else {
          setError(data.error || 'Feil ved parsing av CSV');
        }
        return;
      }

      setAnalysis(data.data);
      toast({
        title: 'CSV parset',
        description: `${data.data.summary.valid_rows} økter funnet`,
      });
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError('Uventet feil ved parsing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Refusjon hjemmelading</h1>
        <p className="text-muted-foreground">
          Last opp Easee CSV og generer refusjonsrapporter
        </p>
      </div>

      <div className="space-y-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Last opp CSV</CardTitle>
            <CardDescription>
              Velg ansatt, periode og Easee Key Detailed Report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Ansatt</Label>
              <Input
                id="employee"
                placeholder="Søk etter ansatt..."
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="period">Periode (måned)</Label>
              <Input
                id="period"
                type="month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">CSV-fil (Easee Key Detailed Report)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                />
                {file && (
                  <span className="text-sm text-muted-foreground">
                    {file.name}
                  </span>
                )}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Feil</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleParse}
              disabled={!file || !employeeId || !periodMonth || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parser CSV...
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Parse CSV
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysis && (
          <Card>
            <CardHeader>
              <CardTitle>Sammendrag</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Totalt økter</p>
                  <p className="text-2xl font-bold">{analysis.summary.valid_rows}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Med RFID</p>
                  <p className="text-2xl font-bold">
                    {analysis.summary.rows_with_rfid}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Uten RFID</p>
                  <p className="text-2xl font-bold">
                    {analysis.summary.rows_without_rfid}
                  </p>
                </div>
              </div>

              {/* TODO: Add Analyser and Generer buttons */}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

