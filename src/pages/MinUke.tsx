import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { ChevronLeft, ChevronRight, Calendar, Eye, Users, BarChart3, Clock, Target, CheckCircle, AlertCircle, Download, Send, Copy } from 'lucide-react';
import { getDateFromWeek, getWeekNumber, getPersonDisplayName, formatTimeValue } from '@/lib/displayNames';
import DayCard from '@/components/DayCard';

import OnboardingDialog from '@/components/OnboardingDialog';

type PersonRow = Database['public']['Tables']['person']['Row'];

interface Profile {
  id: string;
  user_id: string;
  org_id: string;
  org?: {
    name: string;
  };
}

type Person = Pick<
  PersonRow,
  'id' | 'fornavn' | 'etternavn' | 'forventet_dagstimer' | 'epost' | 'aktiv' | 'person_type'
>;

interface WeeklySummary {
  totalHours: number;
  totalOvertime: number;
  totalExpected: number;
  completionPercentage: number;
  daysCompleted: number;
  daysWithEntries: number;
  totalDays: number;
  status: 'complete' | 'partial' | 'missing' | 'empty';
  projects: Array<{
    project_name: string;
    project_number: number;
    totalHours: number;
    days: number;
  }>;
}

const MinUke = () => {
  const { year, week } = useParams<{ year: string; week: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [showFullWeek, setShowFullWeek] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isSimulation, setIsSimulation] = useState(false);
  const [simulatedPersonName, setSimulatedPersonName] = useState<string | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [calendarDays, setCalendarDays] = useState<Array<{
    dato: string;
    is_holiday: boolean;
    is_weekend: boolean;
    holiday_name: string | null;
  }>>([]);

  const currentYear = parseInt(year || new Date().getFullYear().toString());
  const currentWeek = parseInt(week || getWeekNumber(new Date()).toString());
  const formattedWeek = currentWeek.toString().padStart(2, '0');
  const simulatePersonId = searchParams.get('simulatePersonId');

  const getWeeksInYear = (targetYear: number) => {
    // Use ISO week calculation to get the correct number of weeks
    const dec28 = new Date(targetYear, 11, 28); // December 28th is always in the last week
    return getWeekNumber(dec28);
  };

  // Define getWeekDays early to avoid initialization issues
  const getWeekDays = useCallback(() => {
    const startDate = getDateFromWeek(currentYear, currentWeek);
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    
    return days;
  }, [currentYear, currentWeek]);

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      const toPerson = (data: PersonRow): Person => ({
        id: data.id,
        fornavn: data.fornavn,
        etternavn: data.etternavn,
        forventet_dagstimer: data.forventet_dagstimer ?? null,
        epost: data.epost ?? null,
        aktiv: data.aktiv ?? undefined,
        person_type: data.person_type ?? null
      });

      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, org:org_id (name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (!profileData) {
        console.warn('No profile found for user');
        setShowOnboarding(true);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      setIsSimulation(false);
      setSimulatedPersonName(null);

      if (simulatePersonId) {
        if (!['admin', 'manager'].includes(profileData.role)) {
          toast({
            title: 'Manglende tilgang',
            description: 'Bare administratorer eller ledere kan simulere andre personer.',
            variant: 'destructive'
          });
        } else {
          const { data: simulatedPerson, error: simulatedPersonError } = await supabase
            .from('person')
            .select('*')
            .eq('id', simulatePersonId)
            .eq('org_id', profileData.org_id)
            .maybeSingle();

          if (simulatedPersonError && simulatedPersonError.code !== 'PGRST116') {
            console.warn('Error loading simulated person', simulatePersonId, simulatedPersonError);
          } else if (!simulatedPerson) {
            toast({
              title: 'Fant ikke ansatt',
              description: 'Kunne ikke finne personen du forsøker å simulere.',
              variant: 'destructive'
            });
          } else {
            setPerson(toPerson(simulatedPerson));
            setIsSimulation(true);
            setSimulatedPersonName(
              getPersonDisplayName(simulatedPerson.fornavn, simulatedPerson.etternavn)
            );
            return;
          }
        }
      }

      if (user.email) {
        const normalizedEmail = user.email.toLowerCase();

        const { data: personData, error: personError } = await supabase
          .from('person')
          .select('*')
          .eq('org_id', profileData.org_id)
          .ilike('epost', normalizedEmail)
          .maybeSingle();

        if (personError && personError.code !== 'PGRST116') {
          console.warn('Error loading person for email', normalizedEmail, personError);
        } else {
          setPerson(personData ? toPerson(personData) : null);
        }
      } else {
        setPerson(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setShowOnboarding(true);
    } finally {
      setLoading(false);
    }
  }, [user, simulatePersonId, toast]);

  const loadWeeklySummary = useCallback(async () => {
    if (!person?.id || !profile?.org_id) {
      setWeeklySummary(null);
      return;
    }

    setLoadingSummary(true);
    try {
      const startDate = getDateFromWeek(currentYear, currentWeek);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      // Load all vakt entries for the week
      const { data: vakter, error } = await supabase
        .from('vakt')
        .select(`
          id,
          dato,
          project_id,
          ttx_project_cache:project_id (
            project_name,
            project_number,
            tripletex_project_id
          ),
          vakt_timer (
            id,
            timer,
            status,
            is_overtime,
            lonnstype
          )
        `)
        .eq('org_id', profile.org_id)
        .eq('person_id', person.id)
        .gte('dato', startDate.toISOString().split('T')[0])
        .lte('dato', endDate.toISOString().split('T')[0]);

      if (error) throw error;

      // Calculate summary
      let totalHours = 0;
      let totalOvertime = 0;
      let totalExpected = 0;
      let daysCompleted = 0;
      let daysWithEntries = 0;
      const projectMap = new Map<string, { project_name: string; project_number: number; totalHours: number; days: number }>();

      // Generate week days directly to avoid initialization issues
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        weekDays.push(date);
      }
      
      const workingDays = weekDays.filter(day => {
        const dayOfWeek = day.getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
      });

      weekDays.forEach(day => {
        const dayStr = day.toISOString().split('T')[0];
        const dayVakter = vakter?.filter(v => v.dato === dayStr) || [];
        
        if (dayVakter.length > 0) {
          daysWithEntries++;
          
          let dayHours = 0;
          let dayOvertime = 0;
          let dayExpected = person.forventet_dagstimer || 8.0;
          
          // Check if it's a weekend or holiday
          const dayOfWeek = day.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            dayExpected = 0; // Weekend
          }
          
          dayVakter.forEach(vakt => {
            vakt.vakt_timer.forEach(timer => {
              dayHours += timer.timer;
              if (timer.is_overtime) {
                dayOvertime += timer.timer;
              }
              
              // Track project hours
              if (vakt.ttx_project_cache) {
                const projectKey = vakt.ttx_project_cache.tripletex_project_id.toString();
                const existing = projectMap.get(projectKey) || {
                  project_name: vakt.ttx_project_cache.project_name,
                  project_number: vakt.ttx_project_cache.project_number,
                  totalHours: 0,
                  days: 0
                };
                existing.totalHours += timer.timer;
                if (!projectMap.has(projectKey)) {
                  existing.days = 1;
                  projectMap.set(projectKey, existing);
                }
              }
            });
          });
          
          totalHours += dayHours;
          totalOvertime += dayOvertime;
          totalExpected += dayExpected;
          
          if (dayHours >= dayExpected && dayExpected > 0) {
            daysCompleted++;
          }
        }
      });

      const completionPercentage = totalExpected > 0 ? Math.round((totalHours / totalExpected) * 100) : 0;
      
      let status: WeeklySummary['status'] = 'empty';
      if (daysWithEntries === 0) {
        status = 'empty';
      } else if (completionPercentage >= 100) {
        status = 'complete';
      } else if (completionPercentage >= 50) {
        status = 'partial';
      } else {
        status = 'missing';
      }

      setWeeklySummary({
        totalHours,
        totalOvertime,
        totalExpected,
        completionPercentage,
        daysCompleted,
        daysWithEntries,
        totalDays: workingDays.length,
        status,
        projects: Array.from(projectMap.values()).sort((a, b) => b.totalHours - a.totalHours)
      });
    } catch (error) {
      console.error('Error loading weekly summary:', error);
      toast({
        title: "Kunne ikke laste ukessammendrag",
        description: "Det oppstod en feil ved lasting av ukestatistikk.",
        variant: "destructive"
      });
    } finally {
      setLoadingSummary(false);
    }
  }, [person?.id, profile?.org_id, currentYear, currentWeek, toast]);

  const loadCalendarDays = useCallback(async () => {
    if (!profile?.org_id) return;

    try {
      const startDate = getDateFromWeek(currentYear, currentWeek);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      const { data, error } = await supabase
        .from('kalender_dag')
        .select('dato, is_holiday, is_weekend, holiday_name')
        .eq('org_id', profile.org_id)
        .gte('dato', startDate.toISOString().split('T')[0])
        .lte('dato', endDate.toISOString().split('T')[0]);

      if (error) throw error;
      setCalendarDays(data || []);
    } catch (error) {
      console.error('Error loading calendar days:', error);
      // Don't show error toast for calendar days as it's not critical
    }
  }, [profile?.org_id, currentYear, currentWeek]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user, loadUserData]);

  useEffect(() => {
    if (person && profile) {
      loadWeeklySummary();
    }
  }, [person, profile, loadWeeklySummary]);

  useEffect(() => {
    if (profile) {
      loadCalendarDays();
    }
  }, [profile, loadCalendarDays]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    loadUserData();
  };

  const navigateWeek = (delta: number) => {
    let newYear = currentYear;
    let newWeek = currentWeek + delta;
    let weeksInYear = getWeeksInYear(newYear);

    while (newWeek > weeksInYear) {
      newWeek -= weeksInYear;
      newYear += 1;
      weeksInYear = getWeeksInYear(newYear);
    }

    while (newWeek < 1) {
      newYear -= 1;
      weeksInYear = getWeeksInYear(newYear);
      newWeek += weeksInYear;
    }

    navigate(`/min/uke/${newYear}/${newWeek.toString().padStart(2, '0')}`);
  };

  const exitSimulation = () => {
    navigate(`/min/uke/${currentYear}/${formattedWeek}`, { replace: true });
  };

  // Get weekDays directly to avoid initialization issues
  const weekDays = getWeekDays();

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (showOnboarding) {
    return <OnboardingDialog onComplete={handleOnboardingComplete} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">Laster...</div>
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
              <h2 className="text-xl font-semibold">Profil mangler</h2>
              <p className="text-muted-foreground">
                Du må opprette en profil og være tilknyttet en organisasjon for å bruke "Min uke".
              </p>
              <Button onClick={() => setShowOnboarding(true)}>
                Sett opp organisasjon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  const missingPersonRecord = !person;

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold">Min uke</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {profile.org?.name}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Uke {currentWeek}, {currentYear}
              {person && ` - ${getPersonDisplayName(person.fornavn, person.etternavn)}`}
            </p>
            {isSimulation && simulatedPersonName && (
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <Badge className="w-fit bg-blue-100 text-blue-800" variant="secondary">
                  Simulerer {simulatedPersonName}
                </Badge>
                <Button 
                  variant="outline"
                  size="sm"
                  className="mt-2 sm:mt-0"
                  onClick={exitSimulation}
                >
                  Avslutt simulering
                </Button>
              </div>
            )}
          </div>

          {missingPersonRecord && (
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 text-sm text-amber-900">
                <p className="font-medium">Ingen ansattprofil funnet</p>
                <p className="mt-1">
                  Vi fant ingen registrert ansatt med e-postadressen {user?.email}. Be administratoren knytte Tripletex-ansatte til brukere,
                  eller legg inn e-post på riktig person i bemanningssystemet.
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Mobile Action Buttons */}
          <div className="flex flex-col sm:hidden space-y-2">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1"
                onClick={() => setShowFullWeek(!showFullWeek)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showFullWeek ? 'Kompakt' : 'Hele uka'}
              </Button>
              {isSimulation && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={exitSimulation}
                >
                  Avslutt simulering
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1"
                onClick={() => {
                  const currentYear = new Date().getFullYear();
                  const currentWeek = getWeekNumber(new Date());
                  navigate(`/admin/bemanningsliste/${currentYear}/${currentWeek.toString().padStart(2, '0')}`);
                }}
              >
                <Users className="h-4 w-4 mr-1" />
                Planlegg
              </Button>
            </div>
            <div className="flex justify-center">
              <Badge variant="outline" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                {new Date().toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' })}
              </Badge>
            </div>
          </div>

          {/* Desktop Action Buttons */}
          <div className="hidden sm:flex items-center justify-between">
            <div></div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowFullWeek(!showFullWeek)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showFullWeek ? 'Kompakt visning' : 'Vis hele uka'}
              </Button>
              {isSimulation && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={exitSimulation}
                >
                  Avslutt simulering
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const currentYear = new Date().getFullYear();
                  const currentWeek = getWeekNumber(new Date());
                  navigate(`/admin/bemanningsliste/${currentYear}/${currentWeek.toString().padStart(2, '0')}`);
                }}
              >
                <Users className="h-4 w-4 mr-1" />
                Planlegg prosjekter
              </Button>
              <Badge variant="outline">
                <Calendar className="h-3 w-3 mr-1" />
                {new Date().toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </Badge>
            </div>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigateWeek(-1)}
            className="flex-shrink-0"
          >
            <ChevronLeft className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Forrige uke</span>
          </Button>
          <div className="text-sm sm:text-lg font-medium text-center px-2">
            <div className="sm:hidden">Uke {currentWeek}</div>
            <div className="hidden sm:block">Uke {currentWeek}, {currentYear}</div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigateWeek(1)}
            className="flex-shrink-0"
          >
            <span className="hidden sm:inline">Neste uke</span>
            <ChevronRight className="h-4 w-4 sm:ml-1" />
          </Button>
        </div>

        {/* Weekly Summary */}
        {person && weeklySummary && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5" />
                Ukessammendrag
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {formatTimeValue(weeklySummary.totalHours)}
                  </div>
                  <div className="text-sm text-muted-foreground">Timer ført</div>
                  {weeklySummary.totalOvertime > 0 && (
                    <div className="text-xs text-yellow-600 mt-1">
                      +{formatTimeValue(weeklySummary.totalOvertime)} overtid
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {formatTimeValue(weeklySummary.totalExpected)}
                  </div>
                  <div className="text-sm text-muted-foreground">Forventet</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {weeklySummary.completionPercentage}%
                  </div>
                  <div className="text-sm text-muted-foreground">Fullført</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Ukesfremgang</span>
                  <span>{weeklySummary.daysCompleted}/{weeklySummary.totalDays} dager</span>
                </div>
                <Progress 
                  value={weeklySummary.completionPercentage} 
                  className="h-2"
                />
              </div>

              {/* Status Badge */}
              <div className="flex justify-center">
                {weeklySummary.status === 'complete' && (
                  <Badge className="bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Uke fullført
                  </Badge>
                )}
                {weeklySummary.status === 'partial' && (
                  <Badge className="bg-yellow-500 text-white">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Delvis fullført
                  </Badge>
                )}
                {weeklySummary.status === 'missing' && (
                  <Badge className="bg-red-500 text-white">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Mangler timer
                  </Badge>
                )}
                {weeklySummary.status === 'empty' && (
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    Ingen timer ført
                  </Badge>
                )}
              </div>

              {/* Project Breakdown */}
              {weeklySummary.projects.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Prosjekter denne uken:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {weeklySummary.projects.map((project, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                        <div>
                          <div className="font-medium">{project.project_number}</div>
                          <div className="text-muted-foreground text-xs truncate">
                            {project.project_name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatTimeValue(project.totalHours)}</div>
                          <div className="text-muted-foreground text-xs">{project.days} dager</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Week View */}
        {!person ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Ingen ansatt-profil funnet</h3>
                <p className="text-sm mb-4">
                  Din brukerkonto er ikke koblet til en ansatt-profil i systemet.
                </p>
                <p className="text-xs text-muted-foreground">
                  Kontakt administrator for å få tilgang til timeføring.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : showFullWeek ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 sm:gap-4">
            {weekDays.map((date, index) => (
              <div key={index} className={isToday(date) ? 'ring-2 ring-primary rounded-lg' : ''}>
                <DayCard
                  date={date}
                  orgId={profile.org_id}
                  personId={person?.id}
                  forventetTimer={person?.forventet_dagstimer || 8.0}
                  calendarDays={calendarDays}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            {weekDays
              .filter(date => {
                // Show today and upcoming days, plus previous 2 days
                const today = new Date();
                const daysDiff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return daysDiff >= -2 && daysDiff <= 7;
              })
              .map((date, index) => (
                <div key={index} className={isToday(date) ? 'ring-2 ring-primary rounded-lg' : ''}>
                  <DayCard
                    date={date}
                    orgId={profile.org_id}
                    personId={person?.id}
                    forventetTimer={person?.forventet_dagstimer || 8.0}
                    calendarDays={calendarDays}
                  />
                </div>
              ))}
          </div>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Hurtighandlinger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs sm:text-sm"
                onClick={() => {
                  if (weeklySummary) {
                    toast({
                      title: "Ukessammendrag",
                      description: `Du har ført ${formatTimeValue(weeklySummary.totalHours)} timer denne uken (${weeklySummary.completionPercentage}% fullført)`,
                    });
                  }
                }}
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                Ukeoversikt
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs sm:text-sm"
                onClick={() => {
                  toast({
                    title: "Kopier uke",
                    description: "Funksjonen kommer snart!",
                  });
                }}
              >
                <Copy className="h-3 w-3 mr-1" />
                Kopier uka
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs sm:text-sm"
                onClick={() => {
                  toast({
                    title: "Send til godkjenning",
                    description: "Funksjonen kommer snart!",
                  });
                }}
              >
                <Send className="h-3 w-3 mr-1" />
                Send til godkjenning
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs sm:text-sm"
                onClick={() => {
                  toast({
                    title: "Eksporter",
                    description: "Funksjonen kommer snart!",
                  });
                }}
              >
                <Download className="h-3 w-3 mr-1" />
                Eksporter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MinUke;
