"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Calendar, User, FileText } from "lucide-react";
import { getPersonDisplayName, formatTimeValue } from "@/lib/displayNames";

type PersonRow = Database['public']['Tables']['person']['Row'];

interface Profile {
  id: string;
  user_id: string;
  org_id: string;
  role: string;
  org?: {
    name: string;
  };
}

interface ProjectEntry {
  project_number: number;
  project_name: string;
  regularHours: number;
  totalHours: number;
  overtime_100: number;
  overtime_50: number;
  entries: Array<{
    date: string;
    day: string;
    regularHours: number;
    overtime_100: number;
    overtime_50: number;
  }>;
}

interface MonthlySummary {
  month: string;
  monthNumber: number;
  regularHours: number;
  overtime_100: number;
  overtime_50: number;
  totalHours: number;
}

interface MonthlyReportData {
  employee: {
    id: string;
    name: string;
  };
  period: {
    month: string;
    year: number;
    startDate: string;
    endDate: string;
    isYearly: boolean;
  };
  projects?: ProjectEntry[];
  monthlySummary?: MonthlySummary[];
  totals: {
    regularTotal: number;
    overtimeTotal_100: number;
    overtimeTotal_50: number;
    grandTotal: number;
  };
}

const MonthlyReportPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<MonthlyReportData | null>(null);
  
  // Filter states - default to previous month for payroll
  const getPreviousMonth = () => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return previousMonth.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
  };

  const getPreviousMonthYear = () => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return previousMonth.getFullYear();
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getPreviousMonth().toString());
  const [selectedYear, setSelectedYear] = useState<number>(getPreviousMonthYear());
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");

  // Month options
  const months = [
    { value: "1", label: "Januar" },
    { value: "2", label: "Februar" },
    { value: "3", label: "Mars" },
    { value: "4", label: "April" },
    { value: "5", label: "Mai" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
    { value: "all", label: "📊 Alle måneder" },
  ];

  // Year options (current year ± 2)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      console.log('Loading user data for:', user.email);
      
      // Check if user has admin/manager role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, org:org_id (name)')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('Profile data:', profileData, 'Error:', profileError);

      if (profileError) throw profileError;
      if (!profileData) throw new Error('No profile found');

      console.log('User role:', profileData.role);

      // Check role permissions - temporarily allow all roles for testing
      // if (!['admin', 'manager'].includes(profileData.role || '')) {
      //   throw new Error('Insufficient permissions. Only administrators and managers can access reports.');
      // }

      setProfile(profileData);

      // Load employees for the organization
      const { data: employeesData, error: employeesError } = await supabase
        .from('person')
        .select('*')
        .eq('org_id', profileData.org_id)
        .eq('aktiv', true)
        .order('fornavn');

      console.log('Employees data:', employeesData, 'Error:', employeesError);

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

    } catch (error) {
      console.error('Error loading user data:', error);
      toast({
        title: "Feil ved lasting",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const loadMonthlyReport = useCallback(async () => {
    console.log('loadMonthlyReport called with:', {
      hasProfile: !!profile,
      orgId: profile?.org_id,
      selectedEmployee,
      selectedMonth,
      selectedYear
    });

    if (!profile?.org_id || !selectedEmployee || !selectedMonth) {
      console.log('Missing required data, returning null');
      setReportData(null);
      return;
    }

    setReportLoading(true);

    try {
      // Calculate date range - either single month or entire year
      const isYearly = selectedMonth === 'all';
      let startDateStr: string;
      let endDateStr: string;

      if (isYearly) {
        // Entire year - use string format to avoid timezone issues
        startDateStr = `${selectedYear}-01-01`;
        endDateStr = `${selectedYear}-12-31`;
      } else {
        // Single month - use string format to avoid timezone issues
        const monthNum = parseInt(selectedMonth);
        const paddedMonth = monthNum.toString().padStart(2, '0');
        const lastDay = new Date(selectedYear, monthNum, 0).getDate(); // Last day of month
        startDateStr = `${selectedYear}-${paddedMonth}-01`;
        endDateStr = `${selectedYear}-${paddedMonth}-${lastDay.toString().padStart(2, '0')}`;
      }


      // Load all time entries for the employee in the selected month
      const { data: timeEntries, error } = await supabase
        .from('vakt_timer')
        .select(`
          id,
          timer,
          is_overtime,
          status,
          lonnstype,
          vakt!inner (
            id,
            dato,
            person_id,
            ttx_project_cache:project_id (
              project_number,
              project_name,
              tripletex_project_id
            )
          )
        `)
        .eq('vakt.person_id', selectedEmployee)
        .eq('vakt.org_id', profile.org_id)
        .gte('vakt.dato', startDateStr)
        .lte('vakt.dato', endDateStr)
        .in('status', ['godkjent', 'sendt']); // Only approved/sent hours

      if (error) {
        console.error('Error loading time entries:', error);
        throw error;
      }

      let regularTotal = 0;
      let overtimeTotal_100 = 0;
      let overtimeTotal_50 = 0;

      if (isYearly) {
        // Process yearly data - group by month
        const monthlyMap = new Map<number, MonthlySummary>();

        // Initialize all months
        for (let i = 1; i <= 12; i++) {
          monthlyMap.set(i, {
            month: months[i - 1].label,
            monthNumber: i,
            regularHours: 0,
            overtime_100: 0,
            overtime_50: 0,
            totalHours: 0
          });
        }

        timeEntries?.forEach(entry => {
          const hours = entry.timer || 0;
          const date = entry.vakt.dato;
          const monthNumber = new Date(date).getMonth() + 1;
          const monthData = monthlyMap.get(monthNumber);

          if (!monthData) return;

          if (entry.is_overtime) {
            // Overtime - determine if 100% or 50% based on lonnstype
            const is100Percent = entry.lonnstype === '100%' || !entry.lonnstype; // Default to 100%
            
            if (is100Percent) {
              monthData.overtime_100 += hours;
              overtimeTotal_100 += hours;
            } else {
              monthData.overtime_50 += hours;
              overtimeTotal_50 += hours;
            }
          } else {
            // Regular hours
            monthData.regularHours += hours;
            regularTotal += hours;
          }

          monthData.totalHours = monthData.regularHours + monthData.overtime_100 + monthData.overtime_50;
        });

        const selectedEmployeeData = employees.find(emp => emp.id === selectedEmployee);

        const reportData: MonthlyReportData = {
          employee: {
            id: selectedEmployee,
            name: selectedEmployeeData ? getPersonDisplayName(selectedEmployeeData.fornavn, selectedEmployeeData.etternavn) : 'Ukjent ansatt'
          },
          period: {
            month: 'Alle måneder',
            year: selectedYear,
            startDate: startDateStr,
            endDate: endDateStr,
            isYearly: true
          },
          monthlySummary: Array.from(monthlyMap.values()),
          totals: {
            regularTotal,
            overtimeTotal_100,
            overtimeTotal_50,
            grandTotal: regularTotal + overtimeTotal_100 + overtimeTotal_50
          }
        };

        console.log('Yearly report data generated:', reportData);
        setReportData(reportData);

      } else {
        // Process monthly data - group by project and date (existing logic)
        const projectMap = new Map<string, ProjectEntry>();

        timeEntries?.forEach(entry => {
          const project = entry.vakt.ttx_project_cache;
          if (!project) return;

          const projectKey = `${project.project_number}-${project.project_name}`;
          const hours = entry.timer || 0;
          const date = entry.vakt.dato;
          const dayName = new Date(date).toLocaleDateString('no-NO', { weekday: 'short' });
          

          // Initialize project if not exists
          if (!projectMap.has(projectKey)) {
            projectMap.set(projectKey, {
              project_number: project.project_number || 0,
              project_name: project.project_name || 'Ukjent prosjekt',
              regularHours: 0,
              totalHours: 0,
              overtime_100: 0,
              overtime_50: 0,
              entries: []
            });
          }

          const projectEntry = projectMap.get(projectKey)!;

          // Find or create date entry
          let dateEntry = projectEntry.entries.find(e => e.date === date);
          if (!dateEntry) {
            dateEntry = {
              date,
              day: dayName,
              regularHours: 0,
              overtime_100: 0,
              overtime_50: 0
            };
            projectEntry.entries.push(dateEntry);
          }

          if (entry.is_overtime) {
            // Overtime - determine if 100% or 50% based on lonnstype
            const is100Percent = entry.lonnstype === '100%' || !entry.lonnstype; // Default to 100%
            
            if (is100Percent) {
              dateEntry.overtime_100 += hours;
              projectEntry.overtime_100 += hours;
              overtimeTotal_100 += hours;
            } else {
              dateEntry.overtime_50 += hours;
              projectEntry.overtime_50 += hours;
              overtimeTotal_50 += hours;
            }
          } else {
            // Regular hours
            dateEntry.regularHours += hours;
            projectEntry.regularHours += hours;
            regularTotal += hours;
          }

          // Update total hours for the project
          projectEntry.totalHours = projectEntry.regularHours + projectEntry.overtime_100 + projectEntry.overtime_50;
        });

        // Sort entries by date within each project
        projectMap.forEach(project => {
          project.entries.sort((a, b) => a.date.localeCompare(b.date));
        });

        const selectedEmployeeData = employees.find(emp => emp.id === selectedEmployee);
        const selectedMonthData = months.find(m => m.value === selectedMonth);

        const reportData: MonthlyReportData = {
          employee: {
            id: selectedEmployee,
            name: selectedEmployeeData ? getPersonDisplayName(selectedEmployeeData.fornavn, selectedEmployeeData.etternavn) : 'Ukjent ansatt'
          },
          period: {
            month: selectedMonthData?.label || '',
            year: selectedYear,
            startDate: startDateStr,
            endDate: endDateStr,
            isYearly: false
          },
          projects: Array.from(projectMap.values()).sort((a, b) => a.project_number - b.project_number),
          totals: {
            regularTotal,
            overtimeTotal_100,
            overtimeTotal_50,
            grandTotal: regularTotal + overtimeTotal_100 + overtimeTotal_50
          }
        };

        setReportData(reportData);
      }

    } catch (error) {
      console.error('Error loading monthly report:', error);
      toast({
        title: "Feil ved lasting av rapport",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
    } finally {
      setReportLoading(false);
    }
  }, [profile?.org_id, selectedEmployee, selectedMonth, selectedYear, employees, months, toast]);

  const generatePDF = () => {
    // TODO: Implement PDF generation
    toast({
      title: "PDF-generering",
      description: "PDF-funksjonen kommer snart!",
    });
  };

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user, loadUserData]);

  useEffect(() => {
    if (selectedEmployee && selectedMonth && selectedYear && profile?.org_id) {
      loadMonthlyReport();
    }
  }, [selectedEmployee, selectedMonth, selectedYear, profile?.org_id]); // Only trigger when filters or profile changes

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="text-xl font-semibold mb-2">Laster rapport-side...</div>
            <div className="text-muted-foreground">
              Bruker: {user?.email || 'Ikke innlogget'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <h2 className="text-xl font-semibold">Ingen tilgang</h2>
              <p className="text-muted-foreground">
                Kun administratorer og ledere har tilgang til rapporter.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Månedlige rapporter</h1>
            <p className="text-muted-foreground">
              Generer lønnsrapporter for ansatte
            </p>
          </div>
        </div>

        {/* Filter Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Rapport-filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Month Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Måned</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Velg måned" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">År</label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Velg år" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Ansatt</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Velg ansatt" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {getPersonDisplayName(employee.fornavn, employee.etternavn)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Display */}
        {reportLoading ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground">Laster rapport...</div>
            </CardContent>
          </Card>
        ) : reportData ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {reportData.employee.name}
                  </CardTitle>
                  <p className="text-muted-foreground mt-1">
                    {reportData.period.month} {reportData.period.year}
                  </p>
                </div>
                <Button onClick={generatePDF} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Generer PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Report Content - Different layouts for monthly vs yearly */}
              <div className="space-y-6">
                {reportData.period.isYearly ? (
                  /* Yearly Report Layout */
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Årsoversikt
                    </h3>
                    <div className="space-y-2">
                      {reportData.monthlySummary?.map((month, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                          <div className="font-medium">
                            {month.month}:
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatTimeValue(month.totalHours)}</div>
                            {(month.overtime_100 > 0 || month.overtime_50 > 0) && (
                              <div className="text-xs text-muted-foreground">
                                (100%: {formatTimeValue(month.overtime_100)}, 50%: {formatTimeValue(month.overtime_50)})
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Monthly Report Layout */
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Prosjektdetaljer
                    </h3>
                    <div className="space-y-4">
                      {reportData.projects?.map((project, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          {/* Project Header */}
                          <div className="flex justify-between items-center mb-3">
                            <div className="font-medium">
                              {project.project_number} {project.project_name}
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{formatTimeValue(project.totalHours)}</div>
                              {(project.overtime_100 > 0 || project.overtime_50 > 0) && (
                                <div className="text-xs text-muted-foreground">
                                  (Overtid 100%: {formatTimeValue(project.overtime_100)}, 50%: {formatTimeValue(project.overtime_50)})
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Date Entries */}
                          <div className="ml-4 space-y-1">
                            {project.entries.map((entry, entryIndex) => (
                              <div key={entryIndex} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">
                                    {entry.date.split('-').reverse().join('.')} ({entry.day}):
                                  </span>
                                  <span>{formatTimeValue(entry.regularHours)}</span>
                                  {(entry.overtime_100 > 0 || entry.overtime_50 > 0) && (
                                    <span className="text-xs text-muted-foreground">
                                      (100%: {formatTimeValue(entry.overtime_100)}, 50%: {formatTimeValue(entry.overtime_50)})
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Project Total */}
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <div className="flex justify-between items-center text-sm font-medium">
                              <span>Total:</span>
                              <span>{formatTimeValue(project.totalHours)}</span>
                            </div>
                            {(project.overtime_100 > 0 || project.overtime_50 > 0) && (
                              <div className="text-xs text-muted-foreground text-right">
                                (Overtid 100%: {formatTimeValue(project.overtime_100)}, 50%: {formatTimeValue(project.overtime_50)})
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="pt-4 border-t-2 border-gray-300 space-y-2">
                  <div className="flex justify-between items-center font-semibold">
                    <span>TOTALT VANLIGE TIMER:</span>
                    <span>{formatTimeValue(reportData.totals.regularTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center font-semibold">
                    <span>TOTALT OVERTID 100%:</span>
                    <span>{formatTimeValue(reportData.totals.overtimeTotal_100)}</span>
                  </div>
                  <div className="flex justify-between items-center font-semibold">
                    <span>TOTALT OVERTID 50%:</span>
                    <span>{formatTimeValue(reportData.totals.overtimeTotal_50)}</span>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="pt-4 border-t-2 border-gray-400">
                  <div className="text-center">
                    <div className="text-xl font-bold">
                      {reportData.period.isYearly ? 'TOTALT ÅRET' : 'TOTALT LØNNSGRUNNLAG'}: {formatTimeValue(reportData.totals.grandTotal)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground">
                Velg måned og ansatt for å generere rapport
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MonthlyReportPage;
