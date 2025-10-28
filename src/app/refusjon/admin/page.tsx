/**
 * Admin Page: Refusjon hjemmelading
 * CSV upload, analysis, and report generation
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Download, Loader2, History, Settings, UserPlus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { loadEmployeesOptimized } from '@/lib/databaseOptimized';

interface RefusjonEmployeeOption {
  personId: string;
  profileId: string;
  displayName: string;
  fornavn: string;
  etternavn: string;
}

// Helper to get previous month in YYYY-MM format
function getPreviousMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const prevDate = new Date(year, month - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1; // 1-12
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

export default function RefusjonAdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        router.push('/refusjon/min');
        return;
      }

      // Check if admin or økonomi
      const isAdmin = profile.role === 'admin' || profile.role === 'økonomi';
      
      if (!isAdmin) {
        // Not admin - check module access
        const { data: moduleAccess } = await supabase
          .from('profile_modules')
          .select('enabled')
          .eq('profile_id', profile.id)
          .eq('module_name', 'refusjon_hjemmelading')
          .maybeSingle();

        if (!moduleAccess?.enabled) {
          toast({
            title: 'Ingen tilgang',
            description: 'Du har ikke tilgang til refusjon-modulen',
            variant: 'destructive',
          });
          router.push('/refusjon/min');
          return;
        }
      }
      // Admin/økonomi users always have access - no need to check module access
      
      setHasAccess(true);
    } catch (error) {
      console.error('Error checking access:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }
  
  const [periodMonth, setPeriodMonth] = useState(getPreviousMonth());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<RefusjonEmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [downloadLinks, setDownloadLinks] = useState<{ pdf?: string; csv?: string } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [reportSummary, setReportSummary] = useState<any>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's org_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (profile?.org_id) {
        const [personList, profileRows, moduleRows] = await Promise.all([
          loadEmployeesOptimized(profile.org_id),
          supabase
            .from('profiles')
            .select('id, display_name, role, user_id')
            .eq('org_id', profile.org_id)
            .not('user_id', 'is', null),
          supabase
            .from('profile_modules')
            .select('profile_id, enabled')
            .eq('module_name', 'refusjon_hjemmelading'),
        ]);

        if (profileRows.error) throw profileRows.error;
        if (moduleRows.error) throw moduleRows.error;

        const activeProfileIds = new Set<string>();
        moduleRows.data
          ?.filter(row => row.enabled)
          .forEach(row => activeProfileIds.add(row.profile_id));

        profileRows.data
          ?.filter(row => row.role === 'admin' || row.role === 'økonomi')
          .forEach(row => activeProfileIds.add(row.id));

        const normalizeName = (value: string | null | undefined) =>
          value ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';

        const personByName = new Map<string, (Awaited<ReturnType<typeof loadEmployeesOptimized>>[number])>();
        personList.forEach(person => {
          const norm = normalizeName(`${person.fornavn} ${person.etternavn}`);
          if (norm) {
            personByName.set(norm, person);
          }
        });

        const options: RefusjonEmployeeOption[] = [];
        profileRows.data
          ?.filter(profileRow => activeProfileIds.has(profileRow.id))
          .forEach(profileRow => {
            const displayName = profileRow.display_name || '';
            const norm = normalizeName(displayName);
            const matchedPerson = personByName.get(norm);

            if (!matchedPerson) {
              console.warn('Fant ingen Tripletex-ansatt for profil', profileRow.id, displayName);
              return;
            }

            options.push({
              personId: matchedPerson.id,
              profileId: profileRow.id,
              displayName: displayName || `${matchedPerson.fornavn} ${matchedPerson.etternavn}`,
              fornavn: matchedPerson.fornavn,
              etternavn: matchedPerson.etternavn,
            });
          });

        options.sort((a, b) => a.displayName.localeCompare(b.displayName, 'nb'));
        setEmployees(options);

        if (employeeId) {
          const current = options.find(opt => opt.personId === employeeId);
          if (current) {
            setSelectedProfileId(current.profileId);
          } else {
            setEmployeeId('');
            setSelectedProfileId(null);
          }
        }
      }
    } catch (err) {
      console.error('Error loading employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  // All-in-one function: Parse + Analyse + Generate
  const handleGenererRefusjon = async () => {
    if (!file || !employeeId || !periodMonth || !selectedProfileId) {
      toast({
        title: 'Mangler informasjon',
        description: 'Du må velge fil, ansatt og periode',
        variant: 'destructive',
      });
      return;
    }

    // Check if reimbursement already exists
    const periodDate = `${periodMonth}-01`;
    const { data: existing } = await supabase
      .from('ref_reimbursements')
      .select('*')
      .eq('employee_id', selectedProfileId)
      .eq('period_month', periodDate)
      .maybeSingle();

    if (existing) {
      // Show confirmation dialog
      setPendingAction(() => () => executeGeneration());
      setShowConfirmDialog(true);
      return;
    }

    // No existing reimbursement, proceed
    await executeGeneration();
  };

  const executeGeneration = async () => {
    setShowConfirmDialog(false);
    setPendingAction(null);
    
    setGenerating(true);
    setError(null);
    setDownloadLinks(null);
    setReportSummary(null);

    if (!file || !selectedProfileId) {
      setGenerating(false);
      toast({
        title: 'Mangler informasjon',
        description: 'Velg ansatt og fil før du genererer rapport',
        variant: 'destructive',
      });
      return;
    }

    const profileId = selectedProfileId;

    try {
      // Step 1: Parse
      toast({ title: 'Parser CSV...', description: 'Analyserer filen' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employee_id', employeeId);
      formData.append('period_month', periodMonth);
      formData.append('profile_id', profileId);

      const parseRes = await fetch('/api/admin/refusjon/csv/parse', {
        method: 'POST',
        body: formData,
      });
      const parseData = await parseRes.json();

      if (!parseRes.ok) {
        if (parseRes.status === 422 && parseData.error_code === 'MISSING_RFID_COLUMN') {
          setError('Denne filen mangler RFID-nøkkel. Eksporter en "Easee Key Detailed Report" fra Easee Control.');
        } else {
          setError(parseData.error || 'Feil ved parsing');
        }
        return;
      }

      // Step 2: Analyse
      toast({ title: 'Beregner priser...', description: 'Finner spotpriser og beregner refusjon' });
      const analyseRes = await fetch('/api/admin/refusjon/csv/analyser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed_data: parseData.data,
          employee_id: employeeId,
          profile_id: profileId,
          period_month: periodMonth,
        }),
      });
      const analyseData = await analyseRes.json();

      if (!analyseRes.ok) {
        setError(analyseData.error || 'Feil ved beregning');
        return;
      }

      // Step 3: Generate
      toast({ title: 'Genererer rapport...', description: 'Oppretter PDF og CSV' });
      const genererRes = await fetch('/api/admin/refusjon/csv/generer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_data: analyseData,
          employee_id: employeeId,
          profile_id: profileId,
          period_month: periodMonth,
        }),
      });
      const genererData = await genererRes.json();

      if (!genererRes.ok) {
        setError(genererData.error || 'Feil ved generering');
        return;
      }

      // Get employee name for display
      const selectedEmployee = employees.find(e => e.personId === employeeId);
      const employeeName = selectedEmployee?.displayName || 'Ukjent ansatt';

      // Success! Store summary for display
      setReportSummary({
        summary: analyseData.summary,
        policy: analyseData.analysis?.policy_snapshot?.policy || 'spot_med_stromstotte',
        periodMonth,
        employeeName,
      });

      setDownloadLinks({
        pdf: genererData.reimbursement?.pdf_url,
        csv: genererData.reimbursement?.csv_url,
      });

      toast({
        title: 'Rapport klar!',
        description: `Total refusjon: ${analyseData.summary?.total_refund?.toFixed(2) || '0'} kr`,
      });
    } catch (err) {
      console.error('Error:', err);
      setError('Uventet feil');
    } finally {
      setGenerating(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Sjekker tilgang...</p>
        </div>
      </div>
    );
  }

  // No access - don't render (should have redirected)
  if (!hasAccess) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Refusjon hjemmelading</h1>
          <p className="text-muted-foreground">
            Last opp Easee CSV og generer refusjonsrapporter
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/refusjon/admin/historikk')}
          >
            <History className="mr-2 h-4 w-4" />
            Historikk
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/refusjon/admin/tilgang')}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Tilgang
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/refusjon/settings')}
          >
            <Settings className="mr-2 h-4 w-4" />
            Innstillinger
          </Button>
        </div>
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
              {loadingEmployees ? (
                <div className="text-sm text-muted-foreground">Laster ansatte...</div>
              ) : (
                <Select
                  value={employeeId}
                  onValueChange={(value) => {
                    setEmployeeId(value);
                    const matched = employees.find(emp => emp.personId === value);
                    setSelectedProfileId(matched?.profileId || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Velg ansatt..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.personId} value={emp.personId}>
                        {emp.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
              onClick={handleGenererRefusjon}
              disabled={!file || !employeeId || !periodMonth || generating}
              size="lg"
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Genererer refusjon...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generer refusjon
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Report Summary */}
        {reportSummary && downloadLinks && (downloadLinks.pdf || downloadLinks.csv) && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📊</span>
                Rapportsammendrag
              </CardTitle>
              <CardDescription>
                {reportSummary.employeeName} - {new Date(reportSummary.periodMonth + '-01').toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Prisordning</p>
                  <p className="text-lg font-semibold">
                    {reportSummary.policy === 'norgespris' ? '📍 Norgespris' : '⚡ Spot + støtte'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total forbruk</p>
                  <p className="text-lg font-semibold">
                    {reportSummary.summary?.total_kwh?.toFixed(1) || '0.0'} kWh
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total refusjon</p>
                  <p className="text-2xl font-bold text-green-600">
                    {reportSummary.summary?.total_refund?.toFixed(2) || '0.00'} kr
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Snitt pris/kWh</p>
                  <p className="text-lg font-semibold">
                    {(() => {
                      const kwh = reportSummary.summary?.total_kwh || 0;
                      const amount = reportSummary.summary?.total_refund || 0;
                      return kwh > 0 ? (amount / kwh).toFixed(2) : '0.00';
                    })()} kr/kWh
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Download Links */}
        {downloadLinks && (downloadLinks.pdf || downloadLinks.csv) && (
          <Card>
            <CardHeader>
              <CardTitle>Nedlasting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {downloadLinks.pdf && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">PDF-rapport</p>
                      <p className="text-sm text-muted-foreground">
                        Refusjonsrapport i PDF-format
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(downloadLinks.pdf, '_blank')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Last ned
                    </Button>
                  </div>
                )}
                {downloadLinks.csv && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">CSV-data</p>
                      <p className="text-sm text-muted-foreground">
                        Detaljert data i CSV-format
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(downloadLinks.csv, '_blank')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Last ned
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refusjon finnes allerede</DialogTitle>
            <DialogDescription>
              Det finnes allerede en refusjon for denne ansatte i {periodMonth}. Ønsker du å erstatte den med en ny?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Avbryt
            </Button>
            <Button
              onClick={() => pendingAction?.()}
              variant="destructive"
            >
              Erstatt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
